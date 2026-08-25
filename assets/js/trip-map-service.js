import { GOOGLE_MAPS_CONFIG } from "./maps-config.js";

const MAPS_SCRIPT_ID = "travel-google-maps-js";
const COORD_CACHE_KEY = "travel-map-coordinate-cache-v1";
const COORD_CACHE_MAX = 240;
const COORD_CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000;
let mapsLoadPromise = null;
let mapsLibrariesPromise = null;

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

export function itineraryMapPoints(trip, activeDayId = "") {
  const days = Array.isArray(trip?.days) ? trip.days : [];
  const wanted = clean(activeDayId);
  const day = days.find(row => clean(row?.dayId) === wanted) || days[0] || null;
  if (!day) return [];
  return (Array.isArray(day.items) ? day.items : []).map((item, index) => {
    const spec = pointResolveSpec(item);
    return {
      kind: "itinerary",
      identity: `item:${clean(day.dayId)}:${clean(item?.itemId) || index}`,
      dayId: clean(day.dayId),
      itemId: clean(item?.itemId),
      order: index + 1,
      title: clean(item?.title) || `行程 ${index + 1}`,
      subtitle: [clean(item?.time), clean(item?.note)].filter(Boolean).join(" · "),
      mapsUrl: clean(item?.location?.mapsUrl || item?.maps || item?.mapsUrl),
      resolve: spec
    };
  }).filter(point => point.resolve.type !== "none");
}

export function savedPlaceMapPoints(trip) {
  const raw = trip?.snacks;
  const rows = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  return rows.map((place, index) => {
    const spec = pointResolveSpec(place);
    return {
      kind: "saved",
      identity: `saved:${clean(place?.placeId) || index}`,
      placeId: clean(place?.placeId),
      order: index + 1,
      title: clean(place?.title || place?.name) || `收藏 ${index + 1}`,
      subtitle: clean(place?.category || place?.note || place?.address),
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

function markerElement(point) {
  const el = document.createElement("div");
  el.className = `trip-map-marker ${point.kind === "saved" ? "is-saved" : "is-itinerary"}`;
  el.textContent = point.kind === "saved" ? "★" : String(point.order || "•");
  el.setAttribute("aria-hidden", "true");
  return el;
}

export async function createTripMap(container, { points = [], onSelect = null, onMapTap = null } = {}) {
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
  const markers = [];
  const bounds = new core.LatLngBounds();
  points.forEach(point => {
    if (!point?.position) return;
    bounds.extend(point.position);
    const advanced = new marker.AdvancedMarkerElement({
      map,
      position: point.position,
      title: point.title,
      content: markerElement(point),
      gmpClickable: true,
      zIndex: Number(point.order || 0)
    });
    advanced.addEventListener("gmp-click", () => { try { onSelect?.(point, advanced, map); } catch (_) {} });
    markers.push(advanced);
  });
  if (points.length > 1) {
    map.fitBounds(bounds, { top: 112, right: 34, bottom: 180, left: 34 });
    core.event.addListenerOnce(map, "idle", () => { if (map.getZoom() > 15) map.setZoom(15); });
  } else if (points.length === 1) {
    map.setCenter(points[0].position);
    map.setZoom(14);
  }
  map.addListener("click", () => { try { onMapTap?.(); } catch (_) {} });
  return {
    map,
    markers,
    destroy() { markers.forEach(item => { try { item.map = null; } catch (_) {} }); container.replaceChildren(); }
  };
}
