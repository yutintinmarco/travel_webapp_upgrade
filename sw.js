const SW_VERSION = "travel-shell-v7.7.0.7";
const CORE_CACHE = SW_VERSION;
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./trip.json",
  "./assets/css/expenses.css",
  "./assets/js/auth-service.js",
  "./assets/js/cloud-safety-service.js",
  "./assets/js/expenses-module.js",
  "./assets/js/firebase-config.js",
  "./assets/js/firebase-service.js",
  "./assets/js/trip-access-service.js",
  "./assets/js/trip-activity-service.js",
  "./assets/js/trip-backup-service.js",
  "./assets/js/trip-catalog-service.js",
  "./assets/js/trip-import-service.js",
  "./assets/js/trip-loader-service.js",
  "./assets/js/trip-member-service.js",
  "./assets/js/trip-operation-service.js",
  "./assets/js/trip-render-cache-service.js",
  "./assets/js/trip-schema-service.js",
  "./assets/js/trip-session-service.js",
  "./assets/js/user-preferences-service.js",
  "./assets/icon/trip_icon.png",
  "./assets/icon/cx_logo.png",
  "./assets/gallery/demo_city.svg",
  "./assets/gallery/demo_food.svg",
  "./assets/gallery/demo_hotel.svg",
  "./assets/gallery/demo_nature.svg",
  "./assets/gallery/demo_shop.svg",
  "./assets/gallery/demo_transport.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CORE_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("travel-shell-") && key !== CORE_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Firebase / Google requests stay network controlled; Firestore's own
  // persistent IndexedDB cache is responsible for offline cloud data.
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CORE_CACHE).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CORE_CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
