import { computeGoogleTransitRouteOptions, GOOGLE_TRANSIT_PROVIDER_ID } from "./transit-providers/google-transit-provider.js";
import { computeJapanTransitRouteOptions, JAPAN_TRANSIT_PROVIDER_ID } from "./transit-providers/japan-transit-provider.js";

function clean(value) { return String(value ?? "").trim(); }
function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function coordsFromRecord(record = {}) {
  const location = record?.location && typeof record.location === "object" ? record.location : record;
  const lat = finiteNumber(location?.latitude ?? location?.lat);
  const lng = finiteNumber(location?.longitude ?? location?.lng ?? location?.lon);
  return lat == null || lng == null ? null : { lat, lng };
}
function coordsWithinJapan(point) {
  if (!point) return false;
  // Conservative island-group envelopes used only as a pre-request provider
  // hint when explicit country/timezone metadata is absent. They deliberately
  // avoid the Korean peninsula rather than treating one giant bbox as Japan.
  const boxes = [
    [41.0, 46.5, 139.0, 146.5],
    [34.0, 41.6, 130.5, 142.5],
    [30.0, 35.5, 129.5, 135.2],
    [24.0, 30.5, 122.5, 131.5]
  ];
  return boxes.some(([minLat, maxLat, minLng, maxLng]) => point.lat >= minLat && point.lat <= maxLat && point.lng >= minLng && point.lng <= maxLng);
}
export function selectTransitProvider({ origin = null, destination = null, locationContext = null } = {}) {
  const countryCode = clean(locationContext?.countryCode || locationContext?.country).toUpperCase();
  if (["JP", "JPN", "JAPAN", "日本"].includes(countryCode)) return JAPAN_TRANSIT_PROVIDER_ID;
  const providerTimeZone = clean(locationContext?.providerTimeZone);
  if (providerTimeZone === "Asia/Tokyo") return JAPAN_TRANSIT_PROVIDER_ID;
  const cityLat = finiteNumber(locationContext?.latitude), cityLng = finiteNumber(locationContext?.longitude);
  if (cityLat != null && cityLng != null && coordsWithinJapan({ lat: cityLat, lng: cityLng })) return JAPAN_TRANSIT_PROVIDER_ID;
  const a = coordsFromRecord(origin), b = coordsFromRecord(destination);
  if (coordsWithinJapan(a) && coordsWithinJapan(b)) return JAPAN_TRANSIT_PROVIDER_ID;
  return GOOGLE_TRANSIT_PROVIDER_ID;
}

export async function computeTransitRouteOptions(request = {}) {
  const provider = selectTransitProvider(request);
  if (provider === JAPAN_TRANSIT_PROVIDER_ID) return computeJapanTransitRouteOptions(request);
  return computeGoogleTransitRouteOptions(request);
}
