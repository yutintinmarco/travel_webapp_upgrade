import { GOOGLE_MAPS_CONFIG } from "./maps-config.js";
import { ITINERARY_ITEM_KIND, normalizeItineraryItemKind } from "./trip-schema-service.js";

const MAPS_SCRIPT_ID = "travel-google-maps-js";
const COORD_CACHE_KEY = "travel-map-coordinate-cache-v1";
const COORD_CACHE_MAX = 240;
const COORD_CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const ROUTE_CACHE_KEY = "travel-map-route-cache-v1";
const ROUTE_CACHE_MAX = 220;
const ROUTE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
let mapsLoadPromise = null;
let mapsLibrariesPromise = null;
let routesLibraryPromise = null;

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
  return { lat, lng, formattedAddress: clean(row.formattedAddress), source: "local-cache" };
}
function cacheStore(key, value) {
  if (!key || !value) return;
  const lat = finiteNumber(value.lat), lng = finiteNumber(value.lng);
  if (lat == null || lng == null) return;
  const cache = readCoordCache();
  cache[key] = { lat, lng, formattedAddress: clean(value.formattedAddress), updatedAt: Date.now() };
  writeCoordCache(cache);
}
function readRouteCache() {
  if (!storageAvailable()) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) { return {}; }
}
function writeRouteCache(cache) {
  if (!storageAvailable()) return;
  try {
    const rows = Object.entries(cache || {})
      .filter(([, value]) => Array.isArray(value?.path) && value.path.length > 1)
      .sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
      .slice(0, ROUTE_CACHE_MAX);
    localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(Object.fromEntries(rows)));
  } catch (_) {}
}
function routeCacheKey(origin, destination, mode) {
  const aLat = finiteNumber(origin?.lat), aLng = finiteNumber(origin?.lng);
  const bLat = finiteNumber(destination?.lat), bLng = finiteNumber(destination?.lng);
  if ([aLat, aLng, bLat, bLng].some(value => value == null)) return "";
  return `${clean(mode).toUpperCase()}:${aLat.toFixed(5)},${aLng.toFixed(5)}>${bLat.toFixed(5)},${bLng.toFixed(5)}`;
}
function routeCacheLookup(key) {
  if (!key) return null;
  const row = readRouteCache()[key];
  if (!row || Date.now() - Number(row.updatedAt || 0) > ROUTE_CACHE_TTL_MS) return null;
  const path = (Array.isArray(row.path) ? row.path : []).map(point => ({ lat: finiteNumber(point?.lat), lng: finiteNumber(point?.lng) })).filter(point => point.lat != null && point.lng != null);
  return path.length > 1 ? path : null;
}
function routeCacheStore(key, path) {
  const rows = (Array.isArray(path) ? path : []).map(point => ({ lat: finiteNumber(point?.lat), lng: finiteNumber(point?.lng) })).filter(point => point.lat != null && point.lng != null);
  if (!key || rows.length <= 1) return;
  const cache = readRouteCache();
  cache[key] = { path: rows, updatedAt: Date.now() };
  writeRouteCache(cache);
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
  if (spec.type === "coords") return { ...point, position: spec.coords, resolveSource: "canonical" };
  const cached = cacheLookup(spec.key);
  if (cached) return { ...point, position: { lat: cached.lat, lng: cached.lng }, formattedAddress: cached.formattedAddress, resolveSource: cached.source };
  let response;
  if (spec.type === "placeId") response = await geocoder.geocode({ placeId: spec.value });
  else if (spec.type === "query") response = await geocoder.geocode({ address: spec.value });
  else return null;
  const result = response?.results?.[0];
  const lat = finiteNumber(result?.geometry?.location?.lat?.());
  const lng = finiteNumber(result?.geometry?.location?.lng?.());
  if (lat == null || lng == null) return null;
  const resolved = { lat, lng, formattedAddress: clean(result?.formatted_address) };
  cacheStore(spec.key, resolved);
  return { ...point, position: { lat, lng }, formattedAddress: resolved.formattedAddress, resolveSource: "geocoder" };
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

function routeSegmentMode(pointsBetween = []) {
  const transitRows = (Array.isArray(pointsBetween) ? pointsBetween : []).filter(point => point?.itemKind === ITINERARY_ITEM_KIND.TRANSIT);
  if (!transitRows.length) return MAP_ROUTE_MODE.WALKING;
  const ranked = [MAP_ROUTE_MODE.FLIGHT, MAP_ROUTE_MODE.DRIVING, MAP_ROUTE_MODE.BICYCLING, MAP_ROUTE_MODE.TRANSIT, MAP_ROUTE_MODE.WALKING];
  for (const mode of ranked) if (transitRows.some(point => point?.routeMode === mode)) return mode;
  return MAP_ROUTE_MODE.TRANSIT;
}
function buildRouteSegments(group = {}) {
  const rows = (Array.isArray(group?.points) ? group.points : []).slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const segments = [];
  let previousStop = null;
  for (const row of rows) {
    const isStop = row?.routeEligible !== false && row?.itemKind !== ITINERARY_ITEM_KIND.TRANSIT;
    if (!isStop) continue;
    if (previousStop?.position && row?.position) {
      const between = rows.filter(point => Number(point.order || 0) > Number(previousStop.order || 0) && Number(point.order || 0) < Number(row.order || 0));
      segments.push({
        origin: previousStop,
        destination: row,
        mode: routeSegmentMode(between),
        color: clean(group?.color) || "#007aff",
        teamKey: clean(group?.teamKey),
        between
      });
    }
    // An unresolved Stop deliberately breaks the route. Do not silently bridge
    // across a missing itinerary node and pretend the next Stop is adjacent.
    previousStop = row;
  }
  return segments;
}
function plainPath(routePath = []) {
  return (Array.isArray(routePath) ? routePath : []).map(point => {
    const lat = finiteNumber(typeof point?.lat === "function" ? point.lat() : point?.lat);
    const lng = finiteNumber(typeof point?.lng === "function" ? point.lng() : point?.lng);
    return lat == null || lng == null ? null : { lat, lng };
  }).filter(Boolean);
}
async function computeRealRouteSegment(segment) {
  const mode = clean(segment?.mode).toUpperCase();
  if (!segment?.origin?.position || !segment?.destination?.position || mode === MAP_ROUTE_MODE.FLIGHT || mode === MAP_ROUTE_MODE.UNKNOWN) return null;
  const key = routeCacheKey(segment.origin.position, segment.destination.position, mode);
  const cached = routeCacheLookup(key);
  if (cached) return { path: cached, source: "local-cache", mode };
  const routes = await loadGoogleRoutesLibrary();
  const Route = routes?.Route;
  if (!Route?.computeRoutes) throw new Error("Google Routes library is unavailable");
  const response = await Route.computeRoutes({
    origin: segment.origin.position,
    destination: segment.destination.position,
    travelMode: mode,
    fields: ["path"],
    polylineQuality: "OVERVIEW"
  });
  const path = plainPath(response?.routes?.[0]?.path || []);
  if (path.length <= 1) return null;
  routeCacheStore(key, path);
  return { path, source: "google-routes", mode };
}
async function resolveRouteSegments(routeGroups, { concurrency = 2, onProgress = null } = {}) {
  const segments = (Array.isArray(routeGroups) ? routeGroups : []).flatMap(buildRouteSegments);
  if (!segments.length) return { segments: [], realCount: 0, fallbackCount: 0, warningModes: [] };
  let cursor = 0, completed = 0, realCount = 0, fallbackCount = 0;
  const warningModes = new Set();
  const output = new Array(segments.length);
  const worker = async () => {
    while (true) {
      const index = cursor++;
      if (index >= segments.length) return;
      const segment = segments[index];
      let resolved = null;
      try { resolved = await computeRealRouteSegment(segment); } catch (error) { resolved = null; }
      if (resolved?.path?.length > 1) {
        realCount += 1;
        if ([MAP_ROUTE_MODE.WALKING, MAP_ROUTE_MODE.BICYCLING].includes(resolved.mode)) warningModes.add(resolved.mode);
        output[index] = { ...segment, ...resolved, fallback: false };
      } else {
        fallbackCount += 1;
        output[index] = { ...segment, path: [segment.origin.position, segment.destination.position], source: "planned-line", fallback: true };
      }
      completed += 1;
      try { onProgress?.({ completed, total: segments.length, realCount, fallbackCount }); } catch (_) {}
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, segments.length)) }, worker));
  return { segments: output.filter(Boolean), realCount, fallbackCount, warningModes: [...warningModes] };
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

export async function createTripMap(container, { points = [], onSelect = null, onMapTap = null, connectSequence = false, routeGroups = [], focusPaddingTop = 122, onRouteProgress = null, onRouteStatus = null } = {}) {
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
  const drawRouteSegment = (segment, segmentIndex) => {
    const path = Array.isArray(segment?.path) ? segment.path : [];
    if (path.length <= 1 || !maps.Polyline) return;
    const color = clean(segment?.color) || "#007aff";
    const fallback = Boolean(segment?.fallback);
    const zBase = 1 + segmentIndex * 2;
    const halo = new maps.Polyline({
      map, path, clickable: false, geodesic: false,
      strokeColor: "#ffffff", strokeOpacity: fallback ? 0.48 : 0.86, strokeWeight: fallback ? 6 : 8, zIndex: zBase
    });
    const arrowPath = window.google?.maps?.SymbolPath?.FORWARD_CLOSED_ARROW;
    const icons = arrowPath ? [{
      icon: {
        path: arrowPath,
        scale: fallback ? 3.6 : 4.35,
        fillColor: color,
        fillOpacity: fallback ? 0.72 : 1,
        strokeColor: "#ffffff",
        strokeOpacity: fallback ? 0.72 : 0.94,
        strokeWeight: 1.2
      },
      offset: "58px",
      repeat: fallback ? "150px" : "132px"
    }] : undefined;
    const route = new maps.Polyline({
      map, path, clickable: false, geodesic: false,
      strokeColor: color, strokeOpacity: fallback ? 0.52 : 0.90, strokeWeight: fallback ? 3 : 4,
      icons, zIndex: zBase + 1
    });
    routeOverlays.push(halo, route);
  };
  let routeResult = { segments: [], realCount: 0, fallbackCount: 0, warningModes: [] };
  if (effectiveRouteGroups.length) {
    routeResult = await resolveRouteSegments(effectiveRouteGroups, { concurrency: 2, onProgress: onRouteProgress });
    routeResult.segments.forEach(drawRouteSegment);
  }

  try { onRouteStatus?.({ ...routeResult }); } catch (_) {}

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
    point(identity) { return pointByIdentity.get(identity) || null; },
    destroy() {
      markerRows.forEach(row => { try { row.marker.map = null; } catch (_) {} });
      routeOverlays.forEach(line => { try { line.setMap(null); } catch (_) {} });
      container.replaceChildren();
    }
  };
}
