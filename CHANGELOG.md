# Travel WebApp — v7.7.0.13

## Phase 2F current build

### Trip Settings Menu Visual Parity

• `我的 → 旅程設定` now uses the exact same inset grouped menu shell as the root `我的旅程 / 外觀與顯示 / 旅程設定 / App 與資料` menu.
• Removed the generic card padding around the six Trip Settings rows. Icon alignment, row height, text inset, separators, press feedback, chevrons and rounded card clipping now come from the same `profile-menu-card` component as the preferred root menu.
• No navigation compositor code was changed.

### Smooth Firebase Live Update / Background Stability

• Fixed the full-screen background visibly flashing whenever a same-Trip Firebase update arrived, including Destination Colour saves.
• Root cause: every full render reset `--trip-bg-source` to a generated fallback gradient before asynchronously loading the same trip background image again. Glass cards therefore briefly recomposited against a different backdrop.
• Same-Trip updates with the same background now leave the existing decoded background untouched. When the actual Trip background changes, the next image is preloaded and swapped atomically instead of showing a fallback in between.
• Destination colour-only Firestore updates no longer rebuild the whole itinerary page. Colour identity is refreshed in place across Day pills, multi-city gradients, city badges and Weather destination pills.
• Weather data is no longer refetched merely because a destination colour changed.
• Other structural Firebase updates may still re-render affected app content, but the fixed background remains stable throughout instead of flashing.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.13.
• Corrected stale manifest / stylesheet / Service Worker cache-buster query strings to v7.7.0.13.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• JavaScript syntax, JSON validity, duplicate static IDs, Firestore Rules structural sanity, and ZIP integrity checked.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.12.
• The protected v7.3.13 Profile Navigation compositor source is unchanged from the v7.7.0.12 baseline.

---

# Travel WebApp — v7.7.0.12

## Phase 2F current build

### iOS Native Custom Colour Picker Stability Fix

• Fixed the Destination Colour “自訂顏色” native iOS colour picker closing as soon as the user touched or adjusted a colour value.
• Root cause: the colour `change` event saved to Firebase and immediately rebuilt the Destination Settings DOM. Replacing the active `<input type="color">` node causes iOS Safari / standalone PWA to dismiss the system colour picker.
• Custom colour changes now update the preview locally and persist to Firebase without replacing the active colour input while the native picker interaction is in progress.
• Firestore live refreshes are prevented from rebuilding the Destination Settings list while the native colour picker is the active editor.
• Preset swatches and “還原預設” continue to use the normal immediate re-render path.
• Destination colour data model, Day gradients, multi-city order, Firebase schema, and Profile Navigation compositor are unchanged.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.12.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• JavaScript syntax, JSON validity, duplicate static IDs, Firestore Rules structural sanity, and ZIP integrity checked.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.11.
• The protected v7.3.13 Profile Navigation compositor source is unchanged from the v7.7.0.11 baseline.

---

# Travel WebApp — v7.7.0.11

## Phase 2F current build

### Destination Colour Palette iOS Scroll / Ring Fix

• Fixed the selected colour swatch outer ring being clipped at the left / right or bottom edge of the palette.
• Added dedicated safe padding around the swatch strip so the `inset: -4px` selected ring always has room to render inside the palette viewport.
• Fixed an iOS Safari overflow interaction where a palette intended to scroll horizontally could also acquire a tiny vertical scroll range. This could leave a row visually shifted so the upper half of its colour circles appeared cut off.
• The palette now explicitly uses horizontal scrolling only (`overflow-x: auto`, `overflow-y: hidden`) and blocks internal vertical overscroll while the Profile page itself remains normally vertically scrollable.
• No destination colour data, Firebase schema, Day gradient logic, or Profile Navigation animation logic changed.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.11.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• JavaScript syntax, JSON validity, duplicate static IDs, Firestore Rules structural sanity, and ZIP integrity checked.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.10.
• The protected v7.3.13 Profile Navigation compositor source is byte for byte unchanged from the v7.7.0.10 baseline.

---

# Travel WebApp — v7.7.0.10

## Phase 2F current build

### Multi City Order Preservation

• Ordered `day.cities` is now preserved by the Portable JSON → Firestore import plan instead of being dropped from Day documents.
• A multi city Day such as `cities: ["kyoto", "osaka"]` therefore remains Kyoto → Osaka after Import, Replace, Loader, Snapshot and later JSON export.
• Runtime rendering treats ordered `day.cities` as authoritative for Day colour gradients and city badges.
• Older Firebase Trips created before this fix may not have `day.cities`. For those rows, the UI uses destination date windows as a deterministic compatibility fallback, sorted by destination start date, so the bundled Birthday Trip transition day returns to Kyoto → Osaka rather than depending on Firestore map order.
• General destination lists now follow itinerary first appearance rather than raw object / Firestore map ordering. This order is used by Weather, Day rendering and Travel Details.
• Destination manual reorder is intentionally not added to Settings. Overall order is derived from itinerary; per Day direction stays itinerary data.

### Destination Colour Settings

• Added `我的 → 旅程設定 → 目的地顏色`.
• Owner and Admin can choose a preset colour, use the native custom colour picker, or restore the default colour for each destination.
• Destination colour changes are written directly to Firebase `trips/{tripId}/settings/general` inside `cities.{cityKey}.color` and are therefore shared across devices.
• Viewer and Member can open the page in read only mode but cannot modify colours.
• Explicit Firebase / JSON destination colours now override the legacy Kyoto / Osaka / Kobe defaults, allowing those original destinations to be customised too.
• One destination colour identity is reused across the active Day pill, Day heading city badge, Weather active pill, and future compatible city UI.
• Multi city Day gradients are generated at render time from the ordered Day destination list and each destination colour. The gradient itself is not stored as separate data.
• Custom colours are automatically converted into matching Light Mode and Dark Mode variants.
• Destination colour changes are recorded in Trip Activity Log.

### Firebase and Portable JSON Contract

• Firebase remains the runtime source of truth. Destination colour Settings do not edit the bundled JSON file directly.
• Current Trip and Snapshot JSON exports carry the complete `cities` map, including any saved `color` values.
• Backup export parity was tightened to also retain `tripIcon`, `backgroundImage`, legacy `outbound` / `inbound`, `airlineLogo`, and `weather` metadata already supported by the Loader and Import schema.

### Package and Firebase

• Added `trip-destination-service.js` to the App Shell cache.
• Service Worker shell cache updated to v7.7.0.10.
• Firestore Rules are unchanged because existing `settings/{settingId}` manager write permissions already cover Owner / Admin destination settings.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• JavaScript syntax, JSON validity, duplicate static IDs, Firestore Rules structural sanity, ordered Day schema preservation, and ZIP integrity checked.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.9.
• The protected v7.3.13 Profile Navigation compositor source is byte for byte unchanged from the validated v7.7.0.9 baseline.

---

# Travel WebApp — v7.7.0.9

## Phase 2F current build

### Weather Destination Pill State Parity

• Weather destination pills now use the same selection logic as the Day tabs.
• Unselected destinations now use the same neutral Liquid Glass shell as unselected Day tabs in Light Mode instead of carrying a soft version of their destination colour.
• Only the selected destination shows its own identity colour: Kyoto green, Osaka coral / red, Kobe purple, and imported cities use their assigned or deterministic city colour.
• Dark Mode and Auto Dark Mode follow the same Day-tab state rule and neutral glass treatment: neutral unselected pills, destination-coloured selected pill.
• The coloured city badge beside each day heading remains unchanged, so destination identity is still visible in the itinerary heading.
• Weather switching behaviour, city-specific weather cache, request race protection, and generic imported-city support remain unchanged.
• No re-import is required; this is a render-only UX correction.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.9.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• JavaScript syntax, JSON validity, duplicate static IDs, Firestore Rules structural sanity, and ZIP integrity checked.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.8.
• The protected v7.3.13 Profile Navigation compositor source is unchanged from the v7.7.0.8 baseline.

---

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
