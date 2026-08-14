# Travel WebApp — v7.7.0.6

## Phase 2F current build

### Multi Trip Zero Wait Warm Boot

• v7.7.0.5 still had a visible short loading pause because the app waited for Firebase Auth restoration before it was allowed to read the uid bound render cache.
• v7.7.0.6 stores only the last authenticated Firebase UID as a local cache namespace hint on the trusted device.
• When the remembered active Trip differs from bundled trip.json, the app can now read that user's existing IndexedDB Trip render cache immediately after trip.json bootstrap, before the Firebase Auth callback completes.
• Firebase Auth still verifies the actual session immediately afterwards and Firestore remains the authoritative source of truth.
• If Auth resolves signed out, or the Trip later returns permission denied / not found, the existing fallback and cache invalidation paths still take over.
• Explicit Google sign out clears the remembered UID hint, so a signed out launch will not use the pre auth warm cache path.
• The normal v7.7.0.5 auth bound cache bootstrap remains as a second path when no trusted device hint is available.

Expected repeat launch UX after one successful v7.7.0.6 Firebase load:

`App open → remembered Trip cache paint → Auth verification + Firestore sync in background`

The first launch after upgrading may still need one normal authenticated load before the UID hint and latest Trip cache are available.

### Destination Weather Loading Fix

• Fixed a Firebase Trip weather UI bug where `meta.cities = {}` and `meta.weather = {}` were treated as valid weather configuration because empty objects are truthy in JavaScript.
• This caused the weather card to show `載入中… / 正在取得今日天氣…` forever even though no request could be started.
• Trips with no weather configuration now hide the weather card instead of displaying an endless loading state.
• Trips that declare a city/weather object but do not contain valid latitude and longitude now show a clear `未設定` state instead of spinning forever.
• Weather fetch now validates coordinates, checks HTTP status, and times out after 8 seconds instead of being allowed to hang indefinitely.
• Successful Open Meteo responses are cached locally for 30 minutes, so refresh / reopen can display recent weather immediately without waiting for another network request.
• Weather request cache keys now include latitude, longitude, and timezone, preventing data from one Trip or city being reused under another Trip merely because the city key is the same.
• Weather render signatures now include both `meta.cities` and legacy `meta.weather`, so Firebase weather metadata changes trigger a redraw correctly.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.6.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• `node --check` passed for every JavaScript module, both inline scripts, and `sw.js`.
• JSON validation passed for `manifest.json`, `firebase.json`, `firestore.indexes.json`, and `trip.json`.
• No duplicate static HTML IDs were found.
• Firestore Rules structural sanity passed.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.5.
• The protected v7.3.13 Profile Navigation compositor source is byte for byte unchanged from the validated v7.7.0.5 baseline, preserving protected SHA256 `15cef32014cf89aee69e344a101f5027344507b62d8738ed1355103140bfea0f`.
• ZIP integrity test passed.
