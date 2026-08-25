// Travel WebApp · Google Maps browser configuration
// Browser API keys are visible to clients by design. Use a dedicated Google Maps
// browser key restricted to the deployed HTTPS website and to Maps JavaScript API
// plus Geocoding API only.
export const GOOGLE_MAPS_CONFIG = Object.freeze({
  apiKey: "YOUR_RESTRICTED_GOOGLE_MAPS_BROWSER_KEY",
  mapId: "DEMO_MAP_ID",
  version: "weekly",
  language: "zh-HK",
  region: "HK"
});
