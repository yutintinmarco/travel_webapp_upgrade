/* Travel WebApp Service Worker
 * v7.9.20.16 · Final Cleanup · Team-aware hotel route semantics + Map control spacing
 *
 * Keeps the v7.7.0.14 cold-start behaviour, while hardening installation:
 *  1. Critical shell assets are transactional. If any critical file cannot be
 *     fetched, the new worker does not activate and the last working worker / 
 *     cache remain in control.
 *  2. Optional assets are best-effort. One missing optional file cannot abort
 *     the whole precache.
 *  3. Versioned asset query parameters are preserved end-to-end so a page
 *     controlled by the previous worker cannot satisfy a new release from an
 *     older canonical cache entry.
 *  4. Normal navigation stays cache-first with background revalidation; an
 *     explicit reload stays network-first.
 */

const RELEASE_VERSION = "7.9.20.16";
const SW_VERSION = `travel-shell-v${RELEASE_VERSION}`;
const CORE_CACHE = SW_VERSION;

// Required for a useful offline launch and remembered-Trip boot.
const CRITICAL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./trip.json",
  "./assets/js/auth-service.js",
  "./assets/js/firebase-config.js",
  "./assets/js/firebase-service.js",
  "./assets/js/firestore-observed-service.js",
  "./assets/js/app-entry-service.js",
  "./assets/js/trip-access-service.js",
  "./assets/js/trip-catalog-service.js",
  "./assets/js/trip-loader-service.js",
  "./assets/js/trip-render-cache-service.js",
  "./assets/js/trip-schema-service.js",
  "./assets/js/trip-session-service.js",
  "./assets/js/user-preferences-service.js",
  "./assets/icon/trip_icon.png",
  "./assets/bg/bg_trip_mobile.webp"
];

// Useful after launch, but a missing file here must never replace a known-good
// shell with a broken update. These are fetched again on demand if necessary.
const OPTIONAL_ASSETS = [
  "./assets/css/expenses.css",
  "./assets/js/cloud-safety-service.js",
  "./assets/js/app-admin-service.js",
  "./assets/js/expenses-module.js",
  "./assets/js/trip-activity-service.js",
  "./assets/js/trip-appearance-service.js",
  "./assets/js/trip-backup-service.js",
  "./assets/js/trip-backup-package-service.js",
  "./assets/js/trip-document-service.js",
  "./assets/js/trip-destination-service.js",
  "./assets/js/trip-delete-service.js",
  "./assets/js/trip-creator-service.js",
  "./assets/js/trip-import-service.js",
  "./assets/js/trip-member-service.js",
  "./assets/js/trip-media-cache-service.js",
  "./assets/js/trip-media-service.js",
  "./assets/js/trip-media-integration-service.js",
  "./assets/js/trip-media-sync-service.js",
  "./assets/js/trip-map-service.js",
  "./assets/js/airline-logo-service.js",
  "./assets/js/trip-edit-session-service.js",
  "./assets/js/transit-route-service.js",
  "./assets/js/transit-route-cache-service.js",
  "./assets/js/transit-route-quality-service.js",
  "./assets/js/transit-providers/google-transit-provider.js",
  "./assets/js/transit-providers/japan-transit-provider.js",
  "./assets/js/trip-lifecycle-service.js",
  "./assets/js/trip-preferences-service.js",
  "./assets/js/trip-operation-service.js",
  "./assets/js/trip-team-service.js",
  "./assets/icon/cx_logo.png",
  "./assets/gallery/demo_city.svg",
  "./assets/gallery/demo_food.svg",
  "./assets/gallery/demo_hotel.svg",
  "./assets/gallery/demo_nature.svg",
  "./assets/gallery/demo_shop.svg",
  "./assets/gallery/demo_transport.svg"
];

const SHELL_KEY = new URL("./index.html", self.location).href;

/* Release-tagged requests keep their query string as their primary cache key.
 * A canonical precache entry may be used only when its release tag matches
 * this exact Service Worker release. This lets the current worker reuse the
 * install-time precache without allowing an older controlling worker to
 * satisfy a newer release URL from stale canonical bytes. */
function cacheKeyFor(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return request;
  url.hash = "";
  return url.href;
}

function matchingReleasePrecacheKey(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return null;
  if (url.searchParams.get("release") !== RELEASE_VERSION) return null;
  url.searchParams.delete("release");
  url.hash = "";
  return url.href;
}

function isForcedReload(request) {
  return request.cache === "reload" || request.cache === "no-store";
}

async function fetchAndCache(cache, path, { required = false } = {}) {
  const request = new Request(new URL(path, self.location).href, { cache: "reload" });
  try {
    const response = await fetch(request);
    if (!response || !response.ok) {
      throw new Error(`Precache HTTP ${response?.status || "unknown"}: ${path}`);
    }
    await cache.put(cacheKeyFor(request), response);
    return true;
  } catch (error) {
    if (required) throw error;
    console.warn("Optional precache skipped", path, error);
    return false;
  }
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);

    // Critical shell must be complete before this worker is allowed to replace
    // the last known-good version.
    await Promise.all(
      CRITICAL_ASSETS.map(path => fetchAndCache(cache, path, { required: true }))
    );

    // Optional UI/modules are best-effort and cannot abort the install.
    await Promise.all(
      OPTIONAL_ASSETS.map(path => fetchAndCache(cache, path))
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("travel-shell-") && key !== CORE_CACHE)
            .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function revalidate(request, key) {
  return fetch(request)
    .then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CORE_CACHE).then(cache => cache.put(key, copy)).catch(() => {});
      }
      return response;
    });
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Firebase / Google requests stay network controlled; Firestore's own
  // persistent IndexedDB cache remains responsible for offline cloud data.
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // Booking Document PDF previews are short-lived same-origin CacheStorage
  // responses created by the authenticated app. An iframe requests them as
  // navigation requests, so they must be resolved before the SPA navigation
  // fallback below; otherwise index.html is returned in place of the PDF.
  if (url.pathname.includes("/__booking_document_preview__/")) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request);
      })
    );
    return;
  }

  if (request.mode === "navigate") {
    // 下拉更新行程 and any explicit hard reload keep network-first semantics.
    if (isForcedReload(request)) {
      event.respondWith(
        revalidate(request, SHELL_KEY).catch(() => caches.match(SHELL_KEY))
      );
      return;
    }

    // Normal launch: paint the last known shell immediately and refresh it in
    // the background for the next launch.
    event.respondWith(
      caches.match(SHELL_KEY).then(cached => {
        if (cached) {
          event.waitUntil(revalidate(request, SHELL_KEY).catch(() => {}));
          return cached;
        }
        return revalidate(request, SHELL_KEY);
      })
    );
    return;
  }

  const key = cacheKeyFor(request);
  event.respondWith(
    caches.match(key).then(async cached => {
      if (cached) {
        event.waitUntil(revalidate(request, key).catch(() => {}));
        return cached;
      }

      // Dynamic imports and release-tagged CSS/manifest requests use
      // ?release=<version>, while their install-time precache entries are
      // canonical URLs. Only bridge to that canonical entry when the request
      // explicitly matches this worker's release. An older worker therefore
      // cannot serve stale canonical bytes to a newer page release.
      const precacheKey = matchingReleasePrecacheKey(request);
      if (precacheKey && precacheKey !== key) {
        const precached = await caches.match(precacheKey);
        if (precached) {
          event.waitUntil(revalidate(request, precacheKey).catch(() => {}));
          return precached;
        }
      }

      // Preserve the real fetch failure when offline; never resolve a cache miss
      // to undefined / an opaque broken response.
      return revalidate(request, key);
    })
  );
});
