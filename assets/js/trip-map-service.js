import { GOOGLE_MAPS_CONFIG } from "./maps-config.js";
import { ITINERARY_ITEM_KIND, normalizeItineraryItemKind } from "./trip-schema-service.js";

const MAPS_SCRIPT_ID = "travel-google-maps-js";
const COORD_CACHE_KEY = "travel-map-coordinate-cache-v1";
const COORD_CACHE_MAX = 240;
const COORD_CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
let mapsLoadPromise = null;
let mapsLibrariesPromise = null;
let routesLibraryPromise = null;
const transitRouteMemoryCache = new Map();

function clean(value) { return String(value ?? "").trim(); }
function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function configuredKey() {
  const key = clean(GOOGLE_MAPS_CONFIG?.apiKey);
  if (!key || key.includes("REPLACE_WITH_")) return "";
  return key;
}
function storageAvailable() {
  try {
    const probe = "__travel_map_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch (_) { return false; }
}
function readCoordCache() {
  if (!storageAvailable()) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(COORD_CACHE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) { return {}; }
}
function writeCoordCache(cache) {
  if (!storageAvailable()) return;
  try {
    const rows = Object.entries(cache || {})
      .filter(([, value]) => value && finiteNumber(value.lat) != null && finiteNumber(value.lng) != null)
      .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
      .slice(0, COORD_CACHE_MAX);
    localStorage.setItem(COORD_CACHE_KEY, JSON.stringify(Object.fromEntries(rows)));
  } catch (_) {}
}
function cacheLookup(key) {
  if (!key) return null;
  const cache = readCoordCache();
  const row = cache[key];
  if (!row) return null;
  const updatedAt = Number(row.updatedAt || 0);
  if (!updatedAt || Date.now() - updatedAt > COORD_CACHE_TTL_MS) return null;
  const lat = finiteNumber(row.lat), lng = finiteNumber(row.lng);
  if (lat == null || lng == null) return null;
  return {
    lat,
    lng,
    formattedAddress: clean(row.formattedAddress),
    placeId: clean(row.placeId),
    source: "local-cache"
  };
}
function cacheStore(key, value) {
  if (!key || !value) return;
  const lat = finiteNumber(value.lat), lng = finiteNumber(value.lng);
  if (lat == null || lng == null) return;
  const cache = readCoordCache();
  cache[key] = {
    lat,
    lng,
    formattedAddress: clean(value.formattedAddress),
    placeId: clean(value.placeId),
    updatedAt: Date.now()
  };
  writeCoordCache(cache);
}

export function googleMapsConfigured() { return !!configuredKey(); }
export function googleMapsConfigStatus() {
  return {
    configured: googleMapsConfigured(),
    mapId: clean(GOOGLE_MAPS_CONFIG?.mapId) || "DEMO_MAP_ID",
    apiKeyPresent: !!configuredKey()
  };
}

function scriptUrl(callbackName) {
  const params = new URLSearchParams({
    key: configuredKey(),
    v: clean(GOOGLE_MAPS_CONFIG?.version) || "weekly",
    loading: "async",
    callback: callbackName
  });
  const language = clean(GOOGLE_MAPS_CONFIG?.language);
  const region = clean(GOOGLE_MAPS_CONFIG?.region);
  if (language) params.set("language", language);
  if (region) params.set("region", region);
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}

export async function loadGoogleMapsLibraries() {
  if (!googleMapsConfigured()) {
    const error = new Error("Google Maps browser key is not configured");
    error.code = "maps-not-configured";
    throw error;
  }
  if (!mapsLoadPromise) {
    mapsLoadPromise = new Promise((resolve, reject) => {
      if (window.google?.maps?.importLibrary) { resolve(window.google.maps); return; }
      const existing = document.getElementById(MAPS_SCRIPT_ID);
      const callbackName = `__travelGoogleMapsReady_${Date.now().toString(36)}`;
      const cleanup = () => { try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; } };
      window[callbackName] = () => { cleanup(); resolve(window.google?.maps); };
      if (existing) {
        const waitStart = Date.now();
        const poll = () => {
          if (window.google?.maps?.importLibrary) { cleanup(); resolve(window.google.maps); return; }
          if (Date.now() - waitStart > 12000) { cleanup(); reject(new Error("Google Maps script did not become ready")); return; }
          setTimeout(poll, 80);
        };
        poll();
        return;
      }
      const script = document.createElement("script");
      script.id = MAPS_SCRIPT_ID;
      script.async = true;
      script.defer = true;
      script.src = scriptUrl(callbackName);
      script.onerror = () => { cleanup(); mapsLoadPromise = null; reject(new Error("Google Maps JavaScript API failed to load")); };
      document.head.appendChild(script);
    });
  }
  await mapsLoadPromise;
  if (!mapsLibrariesPromise) {
    mapsLibrariesPromise = Promise.all([
      window.google.maps.importLibrary("maps"),
      window.google.maps.importLibrary("marker"),
      window.google.maps.importLibrary("geocoding"),
      window.google.maps.importLibrary("core")
    ]).then(([maps, marker, geocoding, core]) => ({ maps, marker, geocoding, core }));
  }
  return mapsLibrariesPromise;
}
async function loadGoogleRoutesLibrary() {
  await loadGoogleMapsLibraries();
  if (!routesLibraryPromise) {
    routesLibraryPromise = window.google.maps.importLibrary("routes").catch(error => {
      routesLibraryPromise = null;
      throw error;
    });
  }
  return routesLibraryPromise;
}

function coordsFromLocation(location = {}) {
  const lat = finiteNumber(location?.latitude ?? location?.lat);
  const lng = finiteNumber(location?.longitude ?? location?.lng ?? location?.lon);
  return lat == null || lng == null ? null : { lat, lng };
}
function mapsQueryFromUrl(input) {
  const raw = clean(input);
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.href);
    const query = clean(url.searchParams.get("query") || url.searchParams.get("q"));
    if (query) return query.replace(/\+/g, " ");
    const path = decodeURIComponent(url.pathname || "");
    const placeMatch = path.match(/\/place\/([^/]+)/i);
    if (placeMatch?.[1]) return clean(placeMatch[1].replace(/\+/g, " "));
  } catch (_) {}
  return "";
}
function pointResolveSpec(record = {}) {
  const location = record?.location && typeof record.location === "object" ? record.location : {};
  const coords = coordsFromLocation(location) || coordsFromLocation(record);
  const placeId = clean(location.placeId || record.googlePlaceId || record.googleMapsPlaceId);
  const address = clean(location.address || record.address);
  const mapsUrl = clean(location.mapsUrl || record.maps || record.mapsUrl || record.googleMapsUrl);
  const query = mapsQueryFromUrl(mapsUrl) || address;
  if (coords) return { type: "coords", coords, key: `c:${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}` };
  if (placeId) return { type: "placeId", value: placeId, key: `p:${placeId}` };
  if (query) return { type: "query", value: query, key: `q:${query.toLowerCase()}` };
  return { type: "none", key: "" };
}

function orderedPreviewImages(record = {}) {
  const images = Array.isArray(record?.images) ? record.images.filter(Boolean) : [];
  if (images.length) {
    return images.slice().sort((a, b) => Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0));
  }
  const gallery = Array.isArray(record?.gallery) ? record.gallery.filter(Boolean) : (record?.gallery ? [record.gallery] : []);
  if (gallery.length) return gallery;
  const bookingGallery = Array.isArray(record?.booking?.gallery) ? record.booking.gallery.filter(Boolean) : (record?.booking?.gallery ? [record.booking.gallery] : []);
  return bookingGallery;
}
function previewImagesFromRecord(record = {}) { return orderedPreviewImages(record); }
function previewImageFromRecord(record = {}) { return previewImagesFromRecord(record)[0] || null; }
function regionLabelFromSavedPlace(place = {}) {
  const explicit = clean(place?.region || place?.district || place?.city);
  if (explicit) return explicit;
  const area = clean(place?.area);
  if (area) {
    const first = clean(area.split(/[\s/／·・|]+/)[0]);
    if (first) return first;
  }
  const tags = Array.isArray(place?.tags) ? place.tags.map(clean).filter(Boolean) : [];
  return tags[0] || "其他";
}

export const MAP_ROUTE_MODE = Object.freeze({
  WALKING: "WALKING",
  DRIVING: "DRIVING",
  BICYCLING: "BICYCLING",
  TRANSIT: "TRANSIT",
  FLIGHT: "FLIGHT",
  UNKNOWN: "UNKNOWN"
});
function normalizeRouteModeValue(value) {
  const raw = clean(value).toLowerCase();
  if (!raw) return "";
  if (["walk", "walking", "foot", "pedestrian"].includes(raw)) return MAP_ROUTE_MODE.WALKING;
  if (["drive", "driving", "car", "taxi", "uber"].includes(raw)) return MAP_ROUTE_MODE.DRIVING;
  if (["bike", "bicycle", "bicycling", "cycling"].includes(raw)) return MAP_ROUTE_MODE.BICYCLING;
  if (["transit", "train", "rail", "subway", "metro", "bus", "tram", "ferry"].includes(raw)) return MAP_ROUTE_MODE.TRANSIT;
  if (["flight", "air", "plane", "airplane"].includes(raw)) return MAP_ROUTE_MODE.FLIGHT;
  return "";
}
function routeModeFromItineraryItem(item = {}) {
  const explicit = [item?.routeMode, item?.travelMode, item?.mode, item?.transport?.mode, item?.transit?.mode]
    .map(normalizeRouteModeValue).find(Boolean);
  if (explicit) return explicit;
  const icon = clean(item?.icon);
  if (/🚶|🥾/.test(icon)) return MAP_ROUTE_MODE.WALKING;
  if (/🚲|🚴/.test(icon)) return MAP_ROUTE_MODE.BICYCLING;
  if (/🚗|🚕|🚙|🚐/.test(icon)) return MAP_ROUTE_MODE.DRIVING;
  if (/✈️|🛫|🛬/.test(icon)) return MAP_ROUTE_MODE.FLIGHT;
  if (/🚆|🚄|🚅|🚇|🚈|🚊|🚋|🚌|🚎|⛴️|🚢/.test(icon)) return MAP_ROUTE_MODE.TRANSIT;
  const text = `${clean(item?.title)} ${clean(item?.note)} ${clean(item?.detail)}`.toLowerCase();
  if (/\b(walk|walking)\b|步行|徒歩/.test(text)) return MAP_ROUTE_MODE.WALKING;
  if (/\b(taxi|drive|driving|car|uber)\b|的士|計程車|駕車|自駕/.test(text)) return MAP_ROUTE_MODE.DRIVING;
  if (/\b(bicycle|bike|cycling)\b|單車|自行車/.test(text)) return MAP_ROUTE_MODE.BICYCLING;
  if (/\b(flight|plane|airline)\b|航班|飛機/.test(text)) return MAP_ROUTE_MODE.FLIGHT;
  if (/\b(train|rail|metro|subway|bus|transit|tram|ferry)\b|火車|鐵路|地鐵|巴士|公車|電車|渡輪|特急|新幹線/.test(text)) return MAP_ROUTE_MODE.TRANSIT;
  return normalizeItineraryItemKind(item) === ITINERARY_ITEM_KIND.TRANSIT ? MAP_ROUTE_MODE.TRANSIT : MAP_ROUTE_MODE.UNKNOWN;
}

export function itineraryMapPoints(trip, activeDayId = "") {
  const days = Array.isArray(trip?.days) ? trip.days : [];
  const wanted = clean(activeDayId);
  const day = days.find(row => clean(row?.dayId) === wanted) || days[0] || null;
  if (!day) return [];

  const candidates = (Array.isArray(day.items) ? day.items : []).map((item, index) => {
    const spec = pointResolveSpec(item);
    const time = clean(item?.time);
    const note = clean(item?.note);
    const detail = clean(item?.detail);
    const itemKind = normalizeItineraryItemKind(item);
    return {
      kind: "itinerary",
      itemKind,
      routeEligible: itemKind === ITINERARY_ITEM_KIND.STOP,
      routeMode: itemKind === ITINERARY_ITEM_KIND.TRANSIT ? routeModeFromItineraryItem(item) : MAP_ROUTE_MODE.UNKNOWN,
      identity: `item:${clean(day.dayId)}:${clean(item?.itemId) || index}`,
      dayId: clean(day.dayId),
      itemId: clean(item?.itemId),
      // `order` remains the raw itinerary order for sorting / Team sequence.
      // `displayOrder` is a separate contiguous Map stop number.
      order: index + 1,
      displayOrder: null,
      who: clean(item?.who) || "all",
      icon: clean(item?.icon) || (itemKind === ITINERARY_ITEM_KIND.TRANSIT ? "↗︎" : "•"),
      title: clean(item?.title) || (itemKind === ITINERARY_ITEM_KIND.TRANSIT ? "交通" : `行程 ${index + 1}`),
      subtitle: [time, note].filter(Boolean).join(" · "),
      meta: time || (itemKind === ITINERARY_ITEM_KIND.TRANSIT ? "交通" : "行程地點"),
      detail: note || detail,
      previewImages: previewImagesFromRecord(item),
      previewImage: previewImageFromRecord(item),
      mapsUrl: clean(item?.location?.mapsUrl || item?.maps || item?.mapsUrl),
      resolve: spec
    };
  }).filter(point => point.resolve.type !== "none");

  let stopOrder = 0;
  return candidates.map(point => ({
    ...point,
    displayOrder: point.itemKind === ITINERARY_ITEM_KIND.STOP ? ++stopOrder : null
  }));
}

export function savedPlaceMapPoints(trip) {
  const raw = trip?.snacks;
  const rows = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  return rows.map((place, index) => {
    const spec = pointResolveSpec(place);
    const area = clean(place?.area);
    const category = clean(place?.category);
    const note = clean(place?.note || place?.must);
    return {
      kind: "saved",
      identity: `saved:${clean(place?.placeId) || index}`,
      placeId: clean(place?.placeId),
      order: index + 1,
      icon: "★",
      title: clean(place?.title || place?.name) || `收藏 ${index + 1}`,
      subtitle: [area, category].filter(Boolean).join(" · ") || note,
      meta: [area, category].filter(Boolean).join(" · ") || "收藏地點",
      detail: note,
      region: regionLabelFromSavedPlace(place),
      previewImages: previewImagesFromRecord(place),
      previewImage: previewImageFromRecord(place),
      mapsUrl: clean(place?.location?.mapsUrl || place?.maps || place?.mapsUrl),
      resolve: spec
    };
  }).filter(point => point.resolve.type !== "none");
}

async function geocodeOne(geocoder, point) {
  const spec = point.resolve || {};
  if (spec.type === "coords") return { ...point, position: spec.coords, resolveSource: "canonical", placeId: "" };
  const cached = cacheLookup(spec.key);
  if (cached) return {
    ...point,
    position: { lat: cached.lat, lng: cached.lng },
    formattedAddress: cached.formattedAddress,
    placeId: cached.placeId,
    resolveSource: cached.source
  };
  let response;
  if (spec.type === "placeId") response = await geocoder.geocode({ placeId: spec.value });
  else if (spec.type === "query") response = await geocoder.geocode({ address: spec.value });
  else return null;
  const result = response?.results?.[0];
  const lat = finiteNumber(result?.geometry?.location?.lat?.());
  const lng = finiteNumber(result?.geometry?.location?.lng?.());
  if (lat == null || lng == null) return null;
  const resolved = {
    lat,
    lng,
    formattedAddress: clean(result?.formatted_address),
    placeId: clean(result?.place_id)
  };
  cacheStore(spec.key, resolved);
  return {
    ...point,
    position: { lat, lng },
    formattedAddress: resolved.formattedAddress,
    placeId: resolved.placeId,
    resolveSource: "geocoder"
  };
}

export async function resolveMapPoints(points, { concurrency = 3, onProgress = null } = {}) {
  const list = Array.isArray(points) ? points : [];
  if (!list.length) return { resolved: [], unresolved: [] };
  const { geocoding } = await loadGoogleMapsLibraries();
  const geocoder = new geocoding.Geocoder();
  const resolved = [], unresolved = [];
  let cursor = 0, completed = 0;
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= list.length) return;
      const point = list[index];
      try {
        const row = await geocodeOne(geocoder, point);
        if (row?.position) resolved.push(row); else unresolved.push(point);
      } catch (_) { unresolved.push(point); }
      completed += 1;
      try { onProgress?.({ completed, total: list.length, resolved: resolved.length, unresolved: unresolved.length }); } catch (_) {}
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, list.length)) }, worker));
  resolved.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  return { resolved, unresolved };
}

function transitVehicleIcon(vehicleType = "", fallbackMode = "TRANSIT") {
  const raw = clean(vehicleType).toUpperCase();
  if (/SUBWAY|METRO/.test(raw)) return "🚇";
  if (/BUS|TROLLEYBUS/.test(raw)) return "🚌";
  if (/TRAM|LIGHT_RAIL/.test(raw)) return "🚊";
  if (/RAIL|TRAIN|COMMUTER|HIGH_SPEED|HEAVY_RAIL|MONORAIL/.test(raw)) return "🚆";
  if (/FERRY|BOAT/.test(raw)) return "⛴️";
  if (clean(fallbackMode).toUpperCase() === "WALKING") return "🚶";
  return "🚆";
}
function durationTextFromMillis(value) {
  const minutes = Math.max(0, Math.round(Number(value || 0) / 60000));
  if (!minutes) return "";
  if (minutes < 60) return `約 ${minutes} 分鐘`;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return rest ? `約 ${hours} 小時 ${rest} 分鐘` : `約 ${hours} 小時`;
}
function isoTime(value) {
  try { return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : ""; } catch (_) { return ""; }
}
function transitStepPlain(step = {}) {
  const mode = clean(step?.travelMode).toUpperCase() || "UNKNOWN";
  const details = step?.transitDetails || null;
  const line = details?.transitLine || null;
  const vehicleType = clean(line?.vehicle?.vehicleType || line?.vehicle?.name);
  const lineName = clean(line?.shortName || line?.name || line?.vehicle?.name);
  const departureStop = clean(details?.departureStop?.name);
  const arrivalStop = clean(details?.arrivalStop?.name);
  return {
    mode,
    icon: transitVehicleIcon(vehicleType, mode),
    instruction: clean(step?.instructions),
    durationText: clean(step?.localizedValues?.staticDuration) || durationTextFromMillis(step?.staticDurationMillis),
    distanceText: clean(step?.localizedValues?.distance),
    transit: details ? {
      lineName,
      lineColor: clean(line?.color),
      textColor: clean(line?.textColor),
      vehicleType,
      headsign: clean(details?.headsign),
      departureStop,
      arrivalStop,
      departureTime: isoTime(details?.departureTime),
      arrivalTime: isoTime(details?.arrivalTime),
      stopCount: Number(details?.stopCount || 0),
      tripShortText: clean(details?.tripShortText),
      agency: clean(line?.agencies?.[0]?.name)
    } : null
  };
}
function routePathPlain(route = {}) {
  return (Array.isArray(route?.path) ? route.path : []).map(point => {
    const latSource = typeof point?.lat === "function" ? point.lat() : (point?.lat ?? point?.latitude);
    const lngSource = typeof point?.lng === "function" ? point.lng() : (point?.lng ?? point?.longitude);
    const lat = finiteNumber(latSource), lng = finiteNumber(lngSource);
    return lat == null || lng == null ? null : { lat, lng };
  }).filter(Boolean);
}
function transitRoutePlain(route = {}, index = 0) {
  const steps = (Array.isArray(route?.legs) ? route.legs : []).flatMap(leg => Array.isArray(leg?.steps) ? leg.steps : []).map(transitStepPlain);
  const transitSteps = steps.filter(step => step.transit);
  const modeChain = [];
  steps.forEach(step => {
    const token = step.transit?.lineName ? `${step.icon} ${step.transit.lineName}` : step.icon;
    if (token && modeChain[modeChain.length - 1] !== token) modeChain.push(token);
  });
  const firstTransit = transitSteps[0]?.transit || null;
  const lastTransit = transitSteps[transitSteps.length - 1]?.transit || null;
  return {
    id: `route-${index + 1}`,
    index,
    durationText: clean(route?.localizedValues?.duration) || durationTextFromMillis(route?.durationMillis),
    distanceText: clean(route?.localizedValues?.distance),
    departureTime: firstTransit?.departureTime || "",
    arrivalTime: lastTransit?.arrivalTime || "",
    rideCount: transitSteps.length,
    transferCount: Math.max(0, transitSteps.length - 1),
    modeChain,
    path: routePathPlain(route),
    steps,
    warnings: Array.isArray(route?.warnings) ? route.warnings.map(clean).filter(Boolean) : []
  };
}
function transitDepartureSupport(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return { supported: false, reason: "missing" };
  const now = Date.now(), delta = date.getTime() - now;
  const min = -7 * 24 * 60 * 60 * 1000, max = 100 * 24 * 60 * 60 * 1000;
  return delta >= min && delta <= max ? { supported: true, reason: "scheduled" } : { supported: false, reason: "outside-window" };
}
function routeLocationFromResolved(row = {}) {
  const placeId = clean(row?.placeId);
  if (placeId) return `places/${placeId}`;
  const address = clean(row?.formattedAddress);
  if (address) return address;
  return row?.position || null;
}
async function resolveRecordPosition(record = {}) {
  const spec = pointResolveSpec(record);
  if (spec.type === "none") return null;
  const { geocoding } = await loadGoogleMapsLibraries();
  const geocoder = new geocoding.Geocoder();
  const row = await geocodeOne(geocoder, { resolve: spec });
  if (!row?.position) return null;
  const resolved = {
    position: row.position,
    formattedAddress: clean(row.formattedAddress),
    placeId: clean(row.placeId),
    resolveSource: clean(row.resolveSource)
  };
  resolved.routeLocation = routeLocationFromResolved(resolved);
  return resolved;
}
function transitRequestCacheKey(origin, destination, effectiveDepartureTime) {
  const a = origin?.position, b = destination?.position;
  if (!a || !b) return "";
  const stamp = effectiveDepartureTime instanceof Date && Number.isFinite(effectiveDepartureTime.getTime())
    ? Math.floor(effectiveDepartureTime.getTime() / 300000)
    : "now";
  return `${Number(a.lat).toFixed(5)},${Number(a.lng).toFixed(5)}>${Number(b.lat).toFixed(5)},${Number(b.lng).toFixed(5)}@${stamp}`;
}
async function computeTransitRoutesOnce(Route, { origin, destination, departureTime, alternatives = true } = {}) {
  const request = {
    origin,
    destination,
    travelMode: "TRANSIT",
    departureTime,
    computeAlternativeRoutes: alternatives,
    fields: ["durationMillis", "localizedValues", "legs", "path", "warnings"]
  };
  const response = await Route.computeRoutes(request);
  return Array.isArray(response?.routes) ? response.routes : [];
}
export async function computeTransitRouteOptions({ origin = null, destination = null, departureTime = null } = {}) {
  if (!origin || !destination) {
    const error = new Error("Transit origin and destination are required");
    error.code = "transit-context-missing";
    throw error;
  }
  const [resolvedOrigin, resolvedDestination] = await Promise.all([resolveRecordPosition(origin), resolveRecordPosition(destination)]);
  if (!resolvedOrigin?.position || !resolvedDestination?.position) {
    const error = new Error("Transit origin or destination could not be located");
    error.code = "transit-location-unresolved";
    throw error;
  }
  const support = transitDepartureSupport(departureTime);
  const basis = support.supported ? "scheduled" : "now-fallback";
  // v7.9.8.1 relied on an omitted departureTime to mean "now". Google documents
  // that behaviour, but an explicit Date is more deterministic and makes the
  // fallback request identical to the official Transit example.
  const effectiveDepartureTime = support.supported ? departureTime : new Date();
  const cacheKey = transitRequestCacheKey(resolvedOrigin, resolvedDestination, effectiveDepartureTime);
  if (cacheKey && transitRouteMemoryCache.has(cacheKey)) return transitRouteMemoryCache.get(cacheKey);
  const promise = (async () => {
    const routes = await loadGoogleRoutesLibrary();
    const Route = routes?.Route;
    if (!Route?.computeRoutes) {
      const error = new Error("Google Routes library is unavailable");
      error.code = "routes-unavailable";
      throw error;
    }

    // Prefer the geocoder's Place resource name when available. Google recommends
    // Place-based route endpoints because raw coordinates can snap to a nearby
    // road rather than a useful entrance / transit access point.
    const preferredOrigin = resolvedOrigin.routeLocation || resolvedOrigin.position;
    const preferredDestination = resolvedDestination.routeLocation || resolvedDestination.position;
    let routeRows = await computeTransitRoutesOnce(Route, {
      origin: preferredOrigin,
      destination: preferredDestination,
      departureTime: effectiveDepartureTime,
      alternatives: true
    });

    // A zero-route response is a valid API response rather than an exception.
    // Retry once with the already resolved coordinates only when the preferred
    // Place/address endpoints produced no route. This keeps normal cost at one
    // Routes call while giving legacy location data a conservative recovery path.
    const preferredUsesCoordinates = preferredOrigin === resolvedOrigin.position && preferredDestination === resolvedDestination.position;
    if (!routeRows.length && !preferredUsesCoordinates) {
      routeRows = await computeTransitRoutesOnce(Route, {
        origin: resolvedOrigin.position,
        destination: resolvedDestination.position,
        departureTime: effectiveDepartureTime,
        alternatives: false
      });
    }

    const options = routeRows.slice(0, 4).map(transitRoutePlain);
    return {
      options,
      basis,
      requestedDepartureTime: support.supported ? departureTime.toISOString() : "",
      effectiveDepartureTime: effectiveDepartureTime.toISOString(),
      origin: resolvedOrigin,
      destination: resolvedDestination
    };
  })();
  if (cacheKey) transitRouteMemoryCache.set(cacheKey, promise);
  try { return await promise; } catch (error) { if (cacheKey) transitRouteMemoryCache.delete(cacheKey); throw error; }
}

function markerElement(point) {
  const el = document.createElement("div");
  const isSaved = point.kind === "saved";
  const isTransit = point.kind === "itinerary" && point.itemKind === ITINERARY_ITEM_KIND.TRANSIT;
  el.className = `trip-map-marker ${isSaved ? "is-saved" : "is-itinerary"}${isTransit ? " is-transit" : ""}`;
  el.textContent = isSaved ? "★" : (isTransit ? (point.icon || "↗︎") : String(point.displayOrder || "•"));
  el.setAttribute("aria-hidden", "true");
  return el;
}

export async function createTransitRoutePreview(container, { route = null, origin = null, destination = null } = {}) {
  if (!container) throw new Error("Transit route map container is required");
  const { maps, marker, core } = await loadGoogleMapsLibraries();
  const map = new maps.Map(container, {
    center: origin?.position || destination?.position || { lat: 22.3027, lng: 114.1772 },
    zoom: 13,
    mapId: clean(GOOGLE_MAPS_CONFIG?.mapId) || "DEMO_MAP_ID",
    disableDefaultUI: true,
    clickableIcons: false,
    gestureHandling: "cooperative",
    keyboardShortcuts: false
  });
  let overlays = [];
  const removeOverlays = () => {
    overlays.forEach(row => {
      try { if (row?.setMap) row.setMap(null); else if ("map" in row) row.map = null; } catch (_) {}
    });
    overlays = [];
  };
  const markerContent = label => {
    const el = document.createElement("div");
    el.textContent = label;
    Object.assign(el.style, {
      width: "28px", height: "28px", borderRadius: "999px", display: "grid", placeItems: "center",
      background: "#111114", color: "#fff", border: "2px solid #fff", boxShadow: "0 2px 8px rgba(0,0,0,.24)",
      fontSize: "12px", fontWeight: "800", lineHeight: "1"
    });
    return el;
  };
  const setRoute = ({ route: nextRoute = null, origin: nextOrigin = null, destination: nextDestination = null } = {}) => {
    removeOverlays();
    const path = Array.isArray(nextRoute?.path) ? nextRoute.path.filter(point => finiteNumber(point?.lat) != null && finiteNumber(point?.lng) != null) : [];
    if (path.length > 1 && maps.Polyline) {
      const halo = new maps.Polyline({ map, path, clickable: false, geodesic: false, strokeColor: "#ffffff", strokeOpacity: .94, strokeWeight: 8, zIndex: 1 });
      const line = new maps.Polyline({ map, path, clickable: false, geodesic: false, strokeColor: "#0a84ff", strokeOpacity: .96, strokeWeight: 5, zIndex: 2 });
      overlays.push(halo, line);
    }
    const start = nextOrigin?.position || path[0] || null;
    const end = nextDestination?.position || path[path.length - 1] || null;
    if (start) {
      const pin = new marker.AdvancedMarkerElement({ map, position: start, content: markerContent("A"), zIndex: 20 });
      overlays.push(pin);
    }
    if (end) {
      const pin = new marker.AdvancedMarkerElement({ map, position: end, content: markerContent("B"), zIndex: 20 });
      overlays.push(pin);
    }
    const bounds = new core.LatLngBounds();
    path.forEach(point => bounds.extend(point));
    if (start) bounds.extend(start);
    if (end) bounds.extend(end);
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 30, right: 28, bottom: 36, left: 28 });
      core.event.addListenerOnce(map, "idle", () => { if (map.getZoom() > 16) map.setZoom(16); });
    }
  };
  setRoute({ route, origin, destination });
  return {
    map,
    setRoute(next = {}) { setRoute(next); },
    destroy() { removeOverlays(); container.replaceChildren(); }
  };
}

export async function createTripMap(container, { points = [], onSelect = null, onMapTap = null, connectSequence = false, routeGroups = [], focusPaddingTop = 122, showSequenceLine = true } = {}) {
  if (!container) throw new Error("Map container is required");
  const { maps, marker, core } = await loadGoogleMapsLibraries();
  const map = new maps.Map(container, {
    center: points[0]?.position || { lat: 35.0116, lng: 135.7681 },
    zoom: points.length === 1 ? 14 : 11,
    mapId: clean(GOOGLE_MAPS_CONFIG?.mapId) || "DEMO_MAP_ID",
    disableDefaultUI: true,
    clickableIcons: false,
    gestureHandling: "greedy",
    keyboardShortcuts: false
  });

  const markerRows = [];
  const routeOverlays = [];
  const pointByIdentity = new Map();
  points.forEach(point => { if (point?.identity && point?.position) pointByIdentity.set(point.identity, point); });

  const focusPoints = (focusRows, { maxZoom = 15, padding = null } = {}) => {
    const rows = (Array.isArray(focusRows) ? focusRows : []).filter(row => row?.position);
    if (!rows.length) return;
    if (rows.length === 1) {
      map.panTo(rows[0].position);
      if (map.getZoom() !== 14) map.setZoom(14);
      return;
    }
    const bounds = new core.LatLngBounds();
    rows.forEach(row => bounds.extend(row.position));
    map.fitBounds(bounds, padding || { top: Math.max(122, Number(focusPaddingTop) || 122), right: 34, bottom: 188, left: 34 });
    core.event.addListenerOnce(map, "idle", () => { if (map.getZoom() > maxZoom) map.setZoom(maxZoom); });
  };

  const effectiveRouteGroups = Array.isArray(routeGroups) && routeGroups.length
    ? routeGroups
    : (connectSequence ? [{ points, color: "#007aff" }] : []);
  effectiveRouteGroups.forEach((group, groupIndex) => {
    const rows = (Array.isArray(group?.points) ? group.points : []).slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    const paths = [];
    let current = [];
    rows.forEach(point => {
      if (point?.itemKind === ITINERARY_ITEM_KIND.TRANSIT || point?.routeEligible === false) return;
      if (!point?.position) {
        if (current.length > 1) paths.push(current);
        current = [];
        return;
      }
      current.push(point.position);
    });
    if (current.length > 1) paths.push(current);
    const color = clean(group?.color) || "#007aff";
    paths.forEach((path, pathIndex) => {
      if (!maps.Polyline) return;
      const zBase = 1 + groupIndex * 20 + pathIndex * 2;
      const halo = new maps.Polyline({
        map: showSequenceLine ? map : null, path, clickable: false, geodesic: false,
        strokeColor: "#ffffff", strokeOpacity: effectiveRouteGroups.length > 1 ? 0.72 : 0.88, strokeWeight: 8, zIndex: zBase
      });
      const arrowPath = window.google?.maps?.SymbolPath?.FORWARD_CLOSED_ARROW;
      const icons = arrowPath ? [{
        icon: {
          path: arrowPath,
          scale: 4.15,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeOpacity: 0.92,
          strokeWeight: 1.15
        },
        offset: "58px",
        repeat: "132px"
      }] : undefined;
      const route = new maps.Polyline({
        map: showSequenceLine ? map : null, path, clickable: false, geodesic: false,
        strokeColor: color, strokeOpacity: effectiveRouteGroups.length > 1 ? 0.84 : 0.92, strokeWeight: 4,
        icons, zIndex: zBase + 1
      });
      routeOverlays.push(halo, route);
    });
  });

  points.forEach(point => {
    if (!point?.position) return;
    const advanced = new marker.AdvancedMarkerElement({
      map,
      position: point.position,
      title: point.title,
      content: markerElement(point),
      gmpClickable: true,
      zIndex: 100 + Number(point.order || 0)
    });
    advanced.addEventListener("gmp-click", () => { try { onSelect?.(point, advanced, map); } catch (_) {} });
    markerRows.push({ point, marker: advanced, content: advanced.content, baseZIndex: 100 + Number(point.order || 0) });
  });

  focusPoints(points, { maxZoom: 15, padding: { top: Math.max(122, Number(focusPaddingTop) || 122), right: 34, bottom: 188, left: 34 } });
  map.addListener("click", () => { try { onMapTap?.(); } catch (_) {} });

  return {
    map,
    markers: markerRows.map(row => row.marker),
    points: points.slice(),
    focusPoints,
    setVisibleIdentities(identities, { focus = true } = {}) {
      const wanted = identities == null ? null : new Set(Array.isArray(identities) ? identities : []);
      const visible = [];
      markerRows.forEach(row => {
        const show = !wanted || wanted.has(row.point.identity);
        row.marker.map = show ? map : null;
        if (!show) { try { row.content?.classList?.remove("is-selected"); row.marker.zIndex = row.baseZIndex; } catch (_) {} }
        if (show) visible.push(row.point);
      });
      if (focus && visible.length) focusPoints(visible, { maxZoom: 15, padding: { top: 168, right: 34, bottom: 188, left: 34 } });
      return visible;
    },
    setSelectedIdentity(identity = "") {
      const selected = String(identity || "");
      markerRows.forEach(row => {
        const active = Boolean(selected && row.point.identity === selected);
        try { row.content?.classList?.toggle("is-selected", active); } catch (_) {}
        try { row.marker.zIndex = active ? 10000 : row.baseZIndex; } catch (_) {}
      });
    },
    setRouteVisible(visible = true) {
      const show = Boolean(visible);
      routeOverlays.forEach(line => { try { line.setMap(show ? map : null); } catch (_) {} });
    },
    point(identity) { return pointByIdentity.get(identity) || null; },
    destroy() {
      markerRows.forEach(row => { try { row.marker.map = null; } catch (_) {} });
      routeOverlays.forEach(line => { try { line.setMap(null); } catch (_) {} });
      container.replaceChildren();
    }
  };
}
