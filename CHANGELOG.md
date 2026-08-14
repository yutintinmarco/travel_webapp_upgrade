# Travel WebApp — v7.7.0.8

## Phase 2F current build

### Destination Colour Identity Restoration

• Fixed the regression introduced by v7.7.0.7 where every selected Weather city pill used the same generic iOS blue colour.
• Restored the original destination identity colours for the bundled trip: Kyoto remains green, Osaka remains coral/red, and Kobe remains purple.
• The same destination colour is now reused consistently across three UI surfaces: Weather city pills, the active Day pill, and the city badge beside the day heading.
• Weather city pills now remain softly tinted by destination even when not selected; the active city uses the stronger version of that same destination colour.
• Removed the old limitation where only hard coded `kyoto`, `osaka`, and `kobe` CSS classes could display coloured Day badges. Any city key imported through `meta.cities` now receives a stable destination colour.
• Imported trips without explicit city colours receive a deterministic palette based on the city key, so Tokyo and Yokohama in the Phase 2F QA demo display as distinct coloured pills instead of plain text / colourless badges.
• Optional future city metadata fields `color`, `accentColor`, or `themeColor` are supported when a six digit hex colour is supplied. If present, the UI derives the light and dark destination theme from that accent.
• Multi city days continue to use a gradient Day pill assembled from the actual colours of the cities assigned to that day.
• No re import is required. Existing Firebase trips are recoloured at render time from their current `meta.cities` data.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.8.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• `node --check` passed for every JavaScript module, both inline scripts, and `sw.js`.
• JSON validation passed for `manifest.json`, `firebase.json`, `firestore.indexes.json`, and `trip.json`.
• No duplicate static HTML IDs were found.
• Firestore Rules structural sanity passed.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.7.
• The protected v7.3.13 Profile Navigation compositor source is unchanged from the validated v7.7.0.7 baseline.
• ZIP integrity test passed.

---

# Travel WebApp — v7.7.0.7

## Phase 2F current build

### Weather City Selector UX Fix

• Replaced hard coded weather selector active classes for Kyoto, Osaka, and Kobe with one generic active state that works for every city key imported through `meta.cities`.
• The selected weather city now receives an obvious iOS blue active pill in Light Mode, Auto Dark Mode, and explicit Dark Mode.
• Weather city pills now expose `aria-pressed` state and a city specific accessibility label.
• Tapping another city updates the selected pill immediately, recentres that pill when necessary, then loads that city's cached or live weather.
• The weather summary now prefixes the selected city name, for example `橫濱｜今日（08/14）`, so similar forecasts cannot make the switch look ineffective.
• Loading and error states also carry the selected city name.
• Added a request selection token so an older, slower weather response cannot overwrite the city the user selected more recently.
• Weather city tabs can horizontally scroll when a Trip has more destinations, without showing a scrollbar.

### Metadata QA Result

• The Phase 2F metadata demo successfully displayed both imported cities and the structured flight card in v7.7.0.6.
• The Firebase export retained `cities`, `flights`, `hotels`, `infoCard`, `galleryDefaults`, itinerary location coordinates, and saved place metadata.
• This confirms the current Import → Firestore → Loader → Export metadata path preserves the tested structured fields. The older Hokkaido JSON is missing its own `meta.cities` and `meta.flights`, rather than those fields being dropped by the current pipeline.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.7.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• `node --check` passed for every JavaScript module, both inline scripts, and `sw.js`.
• JSON validation passed for `manifest.json`, `firebase.json`, `firestore.indexes.json`, and `trip.json`.
• No duplicate static HTML IDs were found.
• Firestore Rules structural sanity passed.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.6.
• The protected v7.3.13 Profile Navigation compositor source is unchanged by this release; the v7.7.0.7 source diff is limited to weather selector UX, build version references, Service Worker cache version, manifest start URL, and this changelog.
• ZIP integrity test passed.

---

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
