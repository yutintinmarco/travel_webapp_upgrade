# v7.9.9.8 · Edit Add Action / Day Tab Event Isolation

* Fixed an Edit Mode regression where tapping `新增地點` or `新增交通` also triggered the generic Day-tab click handler because the two add controls reuse the Day-tab visual class. That handler cleared every active Day and Day-content panel, making the itinerary appear blank until a real Day tab was tapped again.
* Day switching is now bound only to direct children of `#day-tabs`, and the add controls stop same-target propagation before opening their Edit sheet. This keeps the accepted Day selector visuals unchanged while separating Day navigation from Edit actions.
* No itinerary data, Local Draft data, Firebase data, Transit, Map, media, ordering, sticky Day behaviour or Save-once semantics are changed.

# v7.9.9.7 · Edit Chrome Regression Cleanup

* Kept the trip lifecycle status chip, including `行程已完成`, on one line by reserving its natural width and letting the trip title wrap in the remaining header space.
* Matched the protected Day selector behaviour for the Edit Mode add rail: the full-width material backing is transparent in normal document flow and appears only after the add row itself actually becomes sticky.
* The Edit add rail owns an independent scroll-state helper. The accepted Day selector CSS and its protected `refreshCollapseMetrics`, `updateCompactHeader`, `updateCollapsingChrome`, and `scheduleCollapseUpdate` functions are unchanged.
* Focused regression review confirmed no other file-level changes since v7.9.9.4 outside index / manifest / service worker / changelog; Transit, Map, Firebase schema, draft ordering, Save-once semantics, background handling, native time picker and bottom navigation remain unchanged.

# v7.9.9.6 · Sticky Edit Action Material + Version Consistency

* Added the same full-width sticky material backing used by the Day selector behind the Edit Mode `新增地點` / `新增交通` capsule row, preventing itinerary content from showing through while it remains sticky.
* Corrected all visible and asset build version references so the app consistently reports v7.9.9.6 instead of the mixed v7.9.9.4 / v7.9.9.5 state.
* The protected Day selector itself, Transit, Map, Firebase schema, draft ordering and Save-once semantics are unchanged.

# v7.9.9.5 · Sticky Edit Add Actions

* In Edit Mode, `新增地點` and `新增交通` now use the same capsule visual grammar as the Day selector and remain sticky directly below the protected Day bar while the itinerary scrolls.
* The action row always targets the currently active Day.
* The accepted Day bar itself is unchanged; no Transit, Map, Firebase schema, ordering or Save-once semantics were modified.

# v7.9.9.4 · Phase 3E Add Stop / Add Transit Draft Foundation

* Edit Mode now shows `新增地點` and `新增交通` for each Day.
* New items stay in the Local Draft and are created only by the final global `儲存` transaction.
* Adding an item normalizes chronological `sortOrder`, so itinerary and Map draft sequence share the same order.
* Transit drafts use the existing previous Stop / next Stop routing semantics. Location editing remains a later Phase 3E increment.

# v7.9.9.3 · Regression Recovery + Persistent Edit Navigation

This release deliberately rolls back the v7.9.9.2 shell extraction. The accepted monolithic CSS and classic runtime execution model are restored before applying only the necessary Edit Mode UI corrections. Transit, Map, the protected Day selector and Firebase data semantics are not redesigned.

## Regression recovery

* Restored document-owned CSS and one classic runtime so existing background asset paths and the accepted Day selector sticky/material timing return to the proven execution model.
* Removed all `assets/shell/*` runtime dependencies from the Service Worker and release package.

## Edit Mode UI

* The accepted floating `取消` / `儲存` dock now sits above the normal Bottom Navigation instead of replacing it.
* `行程`, `收藏` and `資料` may be previewed while the local Edit Session remains active; `支出` and `我的` stay protected until cross-section editing is formally implemented.
* The iPhone native time picker remains the real input, but is now an invisible full-field overlay above an app-owned visible time field, preventing WebKit from sizing the edit sheet wider than the viewport.
* Chronological draft sorting, Map sequence/Stop numbering and the save-once Firestore transaction are unchanged.

# v7.9.9.2 · Low-Risk Shell Extraction + Edit UI Refinement

This release deliberately avoids feature refactoring. It keeps the accepted v7.9.9.1 Edit Session, Transit, Map and protected Day bar behaviour while shrinking the monolithic `index.html` into connector-friendly shell assets.

## Edit UI

* Edit Session `取消` / `儲存` actions move out of the crowded itinerary header into a dedicated two-button floating action bar in the existing bottom-navigation position. The normal tab bar temporarily yields to the Edit Session actions, keeping both actions on one line and preventing accidental view switching while editing.
* The native iOS `input type=time` picker remains in use, but the field now has explicit zero minimum width / inline-size containment so WebKit cannot push the control beyond the right edge of the edit sheet.
* No change to Edit Session data semantics, chronological draft ordering, Firebase save-once transaction, Map draft preview or Stop numbering.

## Low-risk shell extraction

* The original inline CSS remains in exactly the same cascade order: a small first-paint prefix stays inline, while the remaining rules are moved into ordered `assets/shell/app-shell-*.css` files.
* The early visual/performance boot script stays inline and unchanged so first-paint / warm-resume timing is untouched.
* The original main runtime source is preserved byte-for-byte and still executes as one classic script. For GitHub transport only, its text is stored in ordered small `assets/shell/app-runtime-part-*.js` carrier files; a tiny executor concatenates the text and injects one classic script at the exact former runtime position. This preserves function hoisting, global lexical scope and document-relative dynamic imports.
* Runtime carrier scripts are parser-blocking and execute before document parsing completes, so the existing window-load registration timing is preserved.
* All shell parts are transactional critical Service Worker assets; an incomplete deployment cannot replace the last known-good worker.
* Protected Day bar CSS and collapsing/sticky logic are exact-match retained from v7.9.9.1.

# v7.9.9.1 · Phase 3E Edit Mode Ordering & Entry Refinement

Phase 3D Transit Planner Expansion is treated as functionally closed at the accepted v7.9.8.9 checkpoint. This release continues Phase 3E from v7.9.9.0 without changing Transit, the protected Day bar, or the Phase 3B Trip Overview Map system.

## Edit Mode entry

* Removed the itinerary header pencil as the normal Edit Mode entry point. The header keeps only the active-session `取消` and `儲存` actions once editing has started.
* Added `進入編輯模式` inside `我的 → 我的旅程`, using the existing grouped Profile menu grammar.
* The entry is available only to Owner / Admin on the current unlocked Trip. Locked Trips and non-edit roles remain read-only.
* Entering from `我的旅程` returns to the itinerary and starts the local Edit Session against the current Trip revision.

## Native time editing

* Replaced the numeric text field with the platform-native `input type="time"` control (`step=60`). iPhone therefore uses the native time picker instead of requiring direct numeric typing.
* Time remains stored canonically as `HH:MM` text; no schema migration is introduced.

## Chronological Local Draft ordering

* Changing an item's time now re-evaluates the whole Day inside the Local Draft before anything is written to Firebase.
* Valid `HH:MM` items are ordered chronologically. Equal times preserve their existing relative order. Items without a valid clock time remain stable after timed items.
* The resulting Day order is written back into draft `sortOrder` values, so the final Save persists both the changed time and every affected `sortOrder` in the same single Firestore transaction / single Trip revision bump.
* The itinerary immediately re-renders from a local preview copy after the item sheet is completed. The user therefore sees the new sequence before Save while canonical `window.tripData` remains untouched until commit.

## Map sequence consistency

* During an active Edit Session, the Trip Map and Transit endpoint resolver read from the same local preview copy rather than the canonical server copy.
* If a time change moves a Stop, the Trip Overview Map sequence changes immediately as well.
* Stop numbers are recalculated from the preview Day order using the existing rule: Transit items do not consume a number, and Team filtering still renumbers the visible Stop sequence contiguously.
* No Trip Overview Map rendering, Day / Team filtering, Saved Places, marker behaviour, or sequence-line styling was redesigned.

## Save once contract

* Individual item completion still writes only to the Local Draft.
* `儲存` remains the only Firebase commit point for the Edit Session and retains the existing revision-conflict protection.
* `取消` discards both field changes and draft ordering and restores the canonical itinerary / Map sequence.

## Protected behaviour

* Day bar CSS, sticky behaviour, stacking, sizing, colours and Day switching logic are unchanged from the accepted v7.9.8.9 behaviour.
* Japan Transit remains ls8h; non-Japan Transit remains Google Routes Transit.
* Google Maps JavaScript API remains the only in-app map renderer.
* Persistent Transit cache, Transit Gallery interaction and `在 Google Maps 查看最新路線` are unchanged.
* No Firestore Rules, Storage Rules, Indexes, Functions or CORS change is required.

---
# v7.9.9.0 · Phase 3E Edit Session Foundation

Phase 3C Transit Route Gallery is kept unchanged from the accepted v7.9.8.9 behaviour. This release opens Phase 3E with the smallest useful Edit Mode slice.

## Edit Session foundation

* Owner / Admin users on an unlocked Trip now get a dedicated itinerary Edit action. Viewer / Member and globally locked Trips remain read-only.
* Entering Edit Mode creates a local draft against the current Trip `revision`; individual field edits do not write Firestore.
* Existing itinerary items can edit only the first safe field set in this prototype: time, title and note. The item sheet writes into the local Edit Session only.
* The header exposes explicit `取消` and `儲存` actions. Cancel discards the entire draft; Save commits every changed itinerary item together in one Firestore transaction and bumps the Trip revision once.
* Save performs server-side revision conflict protection. If the Trip revision changed after the Edit Session started, no item is overwritten and the user is asked to reload / re-enter Edit Mode.
* A successful Edit Save invalidates the old import content hash, appends an itinerary activity-log record and refreshes the local instant render cache.
* Navigation away from the itinerary is blocked while an Edit Session is open so the draft cannot be silently abandoned.

## Deliberately deferred

* No Add Stop / Add Transit yet.
* No delete or reorder yet.
* No Location editor or canonical coordinate selection yet.
* No Transit `採用此方案` yet.
* No Edit-session media staging yet; existing Phase 3A media behaviour is untouched.
* No Saved Place Edit Mode yet.

## Protected behaviour

* Day bar CSS, sticky behaviour, stacking, sizing, colours and Day switching logic are unchanged from v7.9.8.9.
* Japan Transit remains ls8h; non-Japan Transit remains Google Routes Transit.
* Google Maps JavaScript API remains the only in-app map renderer.
* Persistent Transit cache and `在 Google Maps 查看最新路線` are unchanged.
* No Firestore Rules, Storage Rules, Indexes, Functions or CORS change is required.

---

# v7.9.8.9 — Transit Interaction Regression Fix

* Restores the accepted v7.9.8.7 Day bar behaviour at the behavioural level: cached Transit results no longer expand the route UI during the itinerary opening transition and indirectly trigger the existing auto-scroll/sticky threshold. Day bar CSS, sticky logic, stacking, sizing, colours and Day switching logic are unchanged.
* Fixes restored-expanded Transit items after a re-render. If an item is visually restored as expanded, its Transit planner now resumes automatically instead of remaining on the idle “展開交通項目後” placeholder until the user closes and reopens it.
* Expanded Transit route paging now follows the photo-gallery one-step gesture model. A horizontal gesture changes at most one option, vertical page scrolling remains available, and an expanded “點樣去” detail stays expanded on the adjacent option rather than collapsing.
* Keeps the v7.9.8.8 persistent local Transit cache, ls8h Japan provider, Google Routes non-Japan provider, Google Maps route preview, and always-available Google Maps latest-route deep link unchanged.

# v7.9.8.8 · Expanded Transit Paging + Persistent Local Route Cache

Phase 3C interaction close-out and Local-First route reuse on top of v7.9.8.7. Day selector is protected and unchanged.

## Expanded Transit Gallery paging

* Kept the accepted native photo-gallery scroll behaviour when route detail is collapsed.
* When `點樣去` is expanded, horizontal paging now switches to the same one-gesture / one-item threshold used by the full-screen itinerary photo viewer: the gesture is classified only after movement begins, vertical movement remains owned by the itinerary page, and a horizontal swipe can advance at most one route option.
* Expanded-route horizontal drag follows the finger, then snaps specifically to the adjacent option (or back to the current option if the threshold is not met). This prevents a strong flick from jumping from option 1 directly to option 3 or 4.
* Route detail still collapses when the selected option actually changes.

## Persistent Transit route cache

* Added provider-neutral IndexedDB caching above both Transit providers. The cached payload is the normalized / quality-checked canonical Transit result, not raw ls8h or Google response data.
* Cache keys include provider, A/B endpoint identity, departure date/time and location context, so different journeys or times cannot silently share a result.
* A successful route result is reused immediately for 24 hours. `now-fallback` schedule results use a shorter 2-hour freshness window.
* If a cached result is older than its freshness window, the provider is queried normally; if that provider request fails, the existing local result is still available as an offline/stale fallback.
* Cache entries are local-only, capped at 120 records and pruned after 14 days. No Firestore writes or cross-device canonical data are introduced.

## Protected behaviour

* Day bar styling, sticky behaviour and switching logic are unchanged from accepted v7.9.8.7.
* Japan remains ls8h; non-Japan remains Google Routes Transit; Google Maps JavaScript API remains the sole in-app map renderer.
* `在 Google Maps 查看最新路線` remains always available for eligible Transit items.
* No Trip Overview Map, Firebase schema, Rules, Indexes, Functions, CORS, media or Edit Mode change.

---

# v7.9.8.7 · Transit Gallery Gesture + Google Maps Latest Route

Phase 3C interaction correction on top of v7.9.8.6. No provider or Trip Overview Map redesign.

## Day selector regression

* Restored the stable Day selector stacking behaviour by making the material behind the selector effectively opaque once it becomes sticky, so scrolling Day content no longer remains visibly layered behind the Day pills.
* Kept the existing compact-header transition, Day colours, sizing and Day switching logic unchanged.

## Transit route gallery gesture

* Reworked the route option scroller to use the same native horizontal scroll / snap ownership pattern as the itinerary photo gallery: a dedicated scroll viewport wrapping a flex track, without the old `touch-action: pan-x` lock.
* Vertical gestures that begin inside a route option can now continue scrolling the itinerary page instead of becoming inert.
* Added `scroll-snap-stop: always` to route slides so a strong horizontal flick stops at the next route rather than jumping directly from option 1 to option 3.
* Route dots and embedded Google Map preview still follow the closest snapped option.

## Google Maps latest-route deep link

* Every eligible Transit planner now keeps a normal, always-available `在 Google Maps 查看最新路線` action once the previous Stop and next Stop are known.
* The link uses the same semantic A / B endpoints as the in-app planner, prefers canonical coordinates / Place IDs when available, and opens Google Maps Directions with `travelmode=transit`.
* Japan still uses ls8h for in-app planning; non-Japan still uses Google Routes Transit. The Deep Link is independent of provider success and remains available as a current-route check / permanent fallback.
* Google Maps JavaScript API remains the only in-app map renderer. No second map SDK is introduced.

## Scope

* No change to ls8h routing, Google Routes Transit routing, provider selection, Trip Overview Map, media, Firebase schema, Rules, Indexes, Functions or CORS.
* v7.9.8.6 Quality Guard remains provider-neutral and does not alter provider ranking; no additional route-ranking heuristics were added in this build.
* Persistent Transit cache remains deferred until this interaction / fallback behaviour is accepted on device.

---

# v7.9.8.6 · Transit Route Quality Guard

Phase 3C route-quality hardening on top of the v7.9.8.5 provider prototype.

## Quality guard

* Added a provider-neutral `transit-route-quality-service.js` between normalized provider results and Transit Route Gallery.
* Walking-only suggestions remain valid and keep the provider's original ranking; the guard does not automatically push walking behind public transport.
* Each canonical option is classified as walking, mixed, or transit without exposing provider-specific response fields to the UI.
* Japan options now carry canonical access / egress walking metrics so the quality layer can compare unusually long edge-walk times with the returned route geometry.
* A deliberately conservative sanity rule flags only large short-distance access / egress timing mismatches. Suspicious edge-walk duration text becomes `步行時間待確認`, with a collapsed detail warning; the provider's overall route ranking and scheduled transit legs remain untouched.
* Walking-only cards now say `步行方案` rather than presenting `無轉乘` as if a ride existed.

## Protected behaviour

* Previous Stop and next Stop remain the automatic A / B endpoints. Existing Google Maps references / canonical location data continue through the same resolver before provider selection.
* Japan still routes through ls8h; non-Japan still routes through Google Routes Transit.
* Google Maps JavaScript API remains the only map renderer.
* No Trip Overview Map, Day / Team filtering, Saved Places, media, Firebase schema, Edit Mode or provider ranking redesign is included.
* Persistent Transit cache is deliberately deferred to the next step after this quality-guard real-device check.

---

# v7.9.8.5 · Japan Transit Provider Prototype

Phase 3C minimal provider-layer prototype, continuing only from v7.9.8.4.

## Transit provider policy

* Japan Transit routing uses the public ls8h Transit Guidance API.
* Non-Japan Transit routing continues to use Google Routes Transit unchanged.
* Google Maps JavaScript API remains the only map renderer for both providers.
* HERE is not used, imported, configured, or referenced by the runtime.

## Provider layer

* Added `transit-route-service.js` as the provider selector used by Transit Route Gallery.
* Added isolated Google and Japan provider modules.
* Provider selection happens before the route request from country/timezone/canonical coordinate context; there is no provider guessing after a failed route result.
* Both providers normalize into the existing Transit Gallery contract, including provider, route/leg/stop/line data, times, duration, transfers, fare, geometry and attribution fields.

## Japan prototype

* Calls `https://api.transit.ls8h.com/api/v1/guidance/plan` directly from the browser with no API key.
* Uses standard `response.json()` first, with UTF-8 `TextDecoder` recovery only if JSON parsing fails.
* Broken replacement-character text is filtered before presentation, with safer names/IDs/mode labels used as fallback.
* Preserves official Japanese station, line and headsign strings when valid.
* Guidance map segments normalize to Google Maps coordinates; walking and Transit segments render through the existing Google Maps route-preview layer.
* No changes to Trip Overview Map, Day/Team filters, Saved Places, marker behaviour, sequence lines, Firebase schema, media or Edit Mode.

# v7.9.8.4 · Collapsible Transit Route Detail

## Route Gallery hierarchy

• Restored the original tap-to-expand behaviour for `點樣去`. Route steps are collapsed by default so expanding a Transit item no longer produces a very tall directions list immediately.
• Moved the swipeable route option summary above the embedded Route Map. The selected plan can now be scanned first, while the map remains the primary visual directly underneath.
• Added a compact disclosure chevron to each route summary. Tapping the summary expands or collapses that plan's detailed walking / transit steps.
• Swiping to another route collapses any open detail automatically, preventing an off-screen expanded plan from forcing excess gallery height.
• Warnings, when present, follow the detailed route content and collapse with `點樣去`.

## Scope

• No change to Google Routes queries, route geometry, Transit provider logic, main Trip Map, Firestore, Storage, Rules, Indexes, Functions or CORS.
• `assets/js/maps-config.js` remains user-owned and is intentionally excluded from the release ZIP.

---

# v7.9.8.3 · Transit Visual Route Gallery

## Route Gallery presentation

• Reworked the first Transit Route Gallery from a text-first option card into a visual journey surface: previous Stop → route map → next Stop → route steps.
• The previous and next itinerary Stops are now named directly above the embedded route preview, with A / B endpoint markers on the map.
• Swiping between方案 updates one shared embedded map to the selected route rather than creating a separate map instance for every alternative.
• Each route option now keeps the easy-scan duration / mode / time summary and shows `點樣去` walking / transit steps directly below it, closer to the information hierarchy of a directions result while retaining the App's own gallery grammar.
• Removed the square slide backing / 1px outer padding that left grey corners visible behind the rounded route option card. The slide and track are now transparent clipped surfaces and the visible card owns the radius.

## Route geometry

• Transit `Route.computeRoutes()` now requests the `path` field in addition to the existing `legs` / duration fields so the selected suggestion can be drawn on the embedded map.
• Route geometry remains view-only, memory-only data. It is not written to Firestore, Backup or canonical itinerary data.
• The embedded Transit map is lazy and only exists after an eligible Transit item has been expanded and Google has returned at least one route. The main Trip Map remains a Trip overview and still does not become a navigation map.

## Transit media hierarchy

• Transit items with the route planner no longer pull generic `galleryDefaults` placeholder artwork into the expanded detail. Actual item-owned media remains available through the existing item media data, but the route map becomes the primary Transit visual surface.

## Release / backend

• No Firestore schema migration, Storage change, Rules change, Index change, Function change, CORS change or Cloud Shell deployment is introduced.
• `assets/js/maps-config.js` remains user-owned and is intentionally excluded from the release ZIP.
• This visual route preview adds route geometry (`path`) to the existing user-triggered Transit request. No traffic-aware or other advanced routing modifier is added; actual billing should be verified from the real-device request after this prototype test.

---

# v7.9.8.2 · Transit Route Query Reliability Fix

## Blocking Transit Gallery fix

• Fixed the v7.9.8.1 real-device state where eligible Transit items could complete the Routes request successfully but still return an empty route array, leaving every gallery at `暫時搵唔到合適嘅公共交通方案。`.
• Out-of-window Trip dates now send an explicit current `departureTime` instead of relying on an omitted field to imply `now`. This follows the current Google Transit request example while keeping the UI clearly labelled as a current-time sample rather than the original Trip schedule.
• Transit routing now prefers the Geocoding result's Place resource name when available, falling back conservatively to the resolved coordinate only if the preferred endpoint returns no route. This avoids making raw coordinates the only routing source for legacy POI data.
• A zero-route response may trigger one bounded fallback Routes request. Normal successful lookups still use one Routes call; the extra call occurs only when Google returns no route for the preferred endpoint representation.

## Stop / Transit context correction

• Transit Planner now follows the agreed semantic contract: previous Stop → Transit → next Stop. A legacy Maps URL stored on the Transit row itself is no longer treated as the route destination or origin.
• Previous-Day origin fallback now stops when a real same-Day Stop exists but has unresolved location data. It no longer jumps across that unresolved Stop to an older Day.

## Diagnostics / presentation

• The out-of-window schedule note is now shown even when Google returns zero routes, so a failed current-time sample is distinguishable from an in-range scheduled lookup.
• Transit Route Gallery remains read-only. No Firestore write, schema migration, Storage change, Rules change, Index change, Function change, CORS change or Cloud Shell deployment is introduced.
• Planning Map remains a Trip overview with the existing planned sequence line. No Google navigation route is reintroduced to Map.
• `assets/js/maps-config.js` remains user-owned and is intentionally excluded from the release ZIP.

---

# v7.9.8.1 · Planned Map Line + Transit Route Gallery

## Map direction correction

• Returned the Day Map to the existing planned itinerary sequence line. Opening the Map no longer calls Routes API or draws an automatically chosen road / transit path that could imply the traveller must follow that route.
• Added an iOS-style `行程線` control in Day Map. The planned line can be shown or hidden without removing markers, Stop numbering, Transit icons, Day filters or Team filters.
• The `行程線` preference is stored locally on the device and reused the next time the Map is opened. Saved Places Map does not show the control.
• Planned lines continue to respect Team separation and unresolved-Stop breaks. Transit rows remain non-numbered semantic connectors rather than route nodes.

## Transit Route Gallery foundation

• Eligible public-transport Transit items now contain a `建議路線` gallery inside the existing expandable itinerary detail. Google transit lookup is lazy: no Routes request is made until the user actually expands that Transit item.
• Suggested routes use the same interaction grammar as the photo gallery: one large option card at a time, horizontal swipe between alternatives and page dots below.
• Each option first shows an easy-scan summary including approximate duration, departure / arrival time, major transport chain, ride count and transfer count. Tapping a card expands its detailed walking / rail / metro / bus / ferry steps.
• Detailed transit steps can surface line / vehicle, direction (headsign), departure and arrival stops, times and stop count when Google supplies them. Google Maps attribution remains visible with the route content.
• The first Transit Planner slice is read-only. No route option is adopted, saved to Firestore or written into canonical itinerary data yet. A future Edit Mode can add `採用此方案` once the suggestions have been validated in real use.
• Legacy Transit data is handled conservatively. The planner derives origin / destination only where the existing itinerary contains enough location context; otherwise it shows an explicit unable-to-determine state rather than inventing a journey.
• For a Transit item at the start of a Day, legacy compatibility can use the previous Day’s final compatible located Stop as the origin (for example hotel → first station). An unresolved real Stop still blocks inference rather than being silently skipped.
• Transit requests use the itinerary departure time when it falls inside Google's supported transit schedule window. Older / far-future itinerary dates are clearly labelled as current-time example suggestions instead of being presented as historical / future schedule truth.
• Transit route results are cached only in memory for the current app session. Map browsing itself no longer spends Routes quota.

## Release / backend

• No Firebase schema migration, Firestore write, Storage change, Rules change, Index change, Function change, CORS change or Cloud Shell deployment is required.
• `assets/js/maps-config.js` remains user-owned and is intentionally excluded from release ZIPs. The existing restricted browser key is not overwritten.
• Routes API is required only for the new Transit suggestion gallery. If it is not enabled / allowed on the browser key, the rest of the Map continues to work and the Transit gallery shows a recoverable unavailable state.

# v7.9.8.0 · Phase 3C Real Route Foundation

## Route engine

• Replaced the Phase 3B straight Stop sequence as the preferred path with the current Google Maps JavaScript Routes Library `Route.computeRoutes()` path. The existing planned sequence line remains a graceful fallback for unsupported or unavailable segments.
• Route nodes remain semantic Stops only. Transit itinerary rows are used as edge metadata between two Stops and do not become numbered route waypoints.
• Segment mode is inferred from canonical / legacy Transit metadata: walking, driving / taxi, bicycling and public transit are routed with the corresponding Google mode; flight segments remain planned-line fallback because air routing is outside the road / transit route engine.
• Adjacent Stops with no explicit Transit connector default to walking for this foundation. Future Edit Mode will make the intended transport mode explicit instead of relying on compatibility inference.
• Team routing remains isolated. Each Team route receives its own matched Team plus shared itinerary sequence, so Team paths do not cross-connect to another Team's private Stops.

## Cost and resilience

• Added a local 30-day route-path cache keyed by travel mode plus origin / destination coordinates. Reopening the same Day or switching back to the same Team can reuse the local route path instead of repeating a Routes request.
• Route requests use the required response field mask and request only `path` with `OVERVIEW` polyline quality. No traffic, toll, matrix, navigation step or Places data is requested in this build.
• Real route computation is bounded to two concurrent segments. A failed segment falls back to the existing Apple-style planned line without blocking the Map or changing itinerary data.
• Walking / bicycling routes display a persistent compact safety warning because Google marks those route modes as beta and requires the warning when such routes are shown.

## Architecture / deployment

• No Firestore writeback, coordinate migration, Route result persistence to Firebase, media change, Rules, Functions, Indexes or canonical Trip data mutation is introduced.
• `maps-config.js` remains user-owned and excluded from release ZIPs.
• Google Cloud setup now requires Routes API to be enabled and the existing restricted Maps browser key to allow Maps JavaScript API, Geocoding API and Routes API.
• Phase 3D remains responsible for detailed public-transit station, line, platform, transfer and schedule presentation.

---

# v7.9.7.2 · Transit Compact Connector UI Cleanup

## Scope

Presentation only. The v7.9.7.0 Stop / Transit semantic contract, Map behaviour, Team logic, Firebase data and backend remain unchanged.

## Changes

• Replaced the low contrast floating Transit connector presentation with a compact frosted iOS style transport card.
• Transit remains visually lighter and shorter than a Stop card, but now has a reliable background surface over trip artwork.
• Preserved a restrained Team accent as a thin inset rail instead of a heavy Stop style border.
• Increased transport icon clarity with a compact rounded icon tile.
• Restored primary title contrast and tightened secondary information so Transit rows are easy to scan.
• Kept the existing 交通 semantic label, Team badge, booking state, detail expansion and underlying data untouched.
• Dark mode receives the same compact hierarchy with an appropriate material surface.

## Deployment

No Firebase Rules, Storage Rules, Indexes, Functions, config, CORS or Google Maps API changes.

# v7.9.7.1 · Transit Connector Presentation Foundation

## Itinerary semantic presentation

• Transit rows now render as lightweight movement connectors instead of full destination cards. Stop cards remain the visual hierarchy for places / activities and future Route nodes.
• Transit keeps its existing time, transport icon, title, note, Team tag, booking state and expandable detail data; this build changes presentation only and does not discard legacy itinerary information.
• A subtle vertical connector rail and compact circular transport icon give Transit an Apple-style in-between-step treatment without pretending it is a numbered destination.
• Team-specific Transit uses the existing Team colour as a restrained connector accent rather than the Stop card's left border. Shared Transit uses the neutral system accent.
• A compact `交通` semantic label makes legacy inferred Transit explicit to the user while Edit Mode remains deferred.

## Compatibility / architecture

• Canonical `kind: stop / transit` remains authoritative when present. Bundled legacy trip.json has a conservative synchronous presentation fallback because it can paint before the schema module finishes loading.
• No Firestore migration, canonical data write, Routes API, route calculation, Map coordinate writeback, Firebase backend, Rules, Functions or media lifecycle changes are introduced.
• Future Edit Mode remains responsible for the explicit new-item chooser: `行程` writes `kind: stop`; `交通` writes `kind: transit`.

---

# v7.9.7.0 · Itinerary Stop / Transit Semantic Foundation

## Phase 3C pre-route data semantics

• Added an explicit itinerary semantic kind contract: `stop` for places / activities and `transit` for movement between stops. Future Edit Mode should write this choice explicitly when creating an item.
• Legacy Trips remain compatible through conservative inference. Existing transport icons, explicit transport fields / modes and clear travel wording can classify old rows as Transit without requiring an immediate Firestore migration. The compatibility inference is not the future source of truth.
• Portable Trip normalization now preserves / emits the semantic `kind`, so future Backup / Restore and Edit Mode data can carry the distinction canonically.

## Map stop numbering

• Map itinerary markers now number only semantic Stops. Transit rows use their transport icon instead of a number.
• Stop numbers are recalculated after Day / Team filtering, so the visible Map sequence stays contiguous instead of showing gaps caused by hidden Team rows or Transit rows.
• Transit markers remain selectable when they have a valid map reference, preserving useful flight / station / movement context without pretending they are numbered destination stops.

## Route preparation

• Existing Phase 3B sequence polylines now connect Stop nodes only. Transit rows no longer become fake route waypoints.
• Team route splitting remains unchanged: Team-specific Stops plus shared `who: all` Stops form each Team's route sequence.
• Day Map subtitle now distinguishes semantic counts such as `5 行程點 · 4 交通` when both kinds are present.
• No Routes API, real road routing, Transit API, Firebase backend, Rules, Functions or canonical migration is introduced in this build.

---

# v7.9.6.4 · Map Preview Album, Selected Place & Saved Media Parity

## Phase 3B map interaction refinement

- Map Preview now renders the full existing itinerary / Saved Place gallery instead of only the first image. The 16:9 hero area supports native horizontal swipe with lightweight page dots and preserves each image crop.
- Itinerary and Saved Place map previews now share one gallery resolution path, including Local First pending media, canonical Firebase media and legacy/static gallery fallback.
- Selecting a marker now gives that marker a persistent Apple-style selected state with a larger scale, blue outer ring and elevated z-index until another place or blank map area is tapped.
- Sequential route arrows are enlarged again while keeping the existing spacing and route-line styling.
- No Firebase backend, Google API scope, map configuration schema or canonical Trip data changes.

# v7.9.6.3 · Map Filter, Hero Preview & Direction Readability

• Removed the residual iOS Safari grey tap tray under Day, Team and Saved region filter pills by making the filter hosts fully transparent, removing sub-filter shadows, and disabling the WebKit tap highlight while retaining an explicit keyboard focus-visible state.
• Upgraded map place previews with media from the small square thumbnail to a full-width 16:9 hero image above the place information. The preview now uses the Display media variant and reuses the canonical itinerary / Saved Place crop metadata so the framing matches the app gallery.
• Enlarged route direction arrows and reduced their frequency slightly so travel direction is easier to read without turning the sequence line into navigation-style signage.
• No Firebase backend, Google API scope, Maps config, route calculation, or canonical trip data changes.

# v7.9.6.2 · Phase 3B Day / Team Map Interaction Pass

## Directional Sequence Overlay

• Added restrained directional arrowheads to the existing itinerary sequence polyline using supported Google Maps polyline symbols.
• Arrows remain a visual itinerary-order cue only and do not claim road, walking or transit routing.
• Single-team views use the selected Team colour; Trips without multiple Teams retain the existing system blue route.

## Map Day and Team Filters

• Day scope now adds a centered horizontal Day pill row so users can switch Map Day without leaving the full-screen map.
• Trips with multiple traveller Teams add a second Team pill row using the App's existing Team labels and colours.
• Selecting a Team shows that Team's own items plus shared `who: all` items.
• Selecting `全部` keeps all markers visible but draws separate Team route sequences so divergent Team itineraries are not incorrectly connected to each other. Shared itinerary points participate in each Team's route.

## Preview Media Hydration Fix

• Map preview cards no longer rely only on raw `images[]` data. They now resolve through the same itinerary / Saved Place gallery hydration path used by the live App UI.
• Firebase managed media, Local First pending overlays and legacy static gallery images therefore share the same preview source-of-truth as the existing gallery surfaces.
• Saved Places without a stable placeId retain an ordered fallback lookup so legacy rows can still resolve their gallery preview.

## Saved Place Filter Harmony

• Saved Place region pills are now genuinely centered as a compact row.
• Removed the previous grey tray feeling: inactive pills use lightweight white glass surfaces with no enclosing background panel; active selection remains high-contrast black.
• Region selection continues to auto-fit the visible markers.

## Release / Backend

• `assets/js/maps-config.js` remains a user-owned deployment file and is intentionally excluded from release ZIP updates.
• No Firestore, Storage, Rules, Functions, Backup, Restore or media lifecycle contract changed.
• No Routes API or additional Google Maps API is required.

---

# v7.9.6.1 · Phase 3B Map Experience Pass

## Map Route Overlay

• Current Day markers are now connected in itinerary order with a restrained Apple style sequence overlay.
• The overlay is deliberately a visual itinerary sequence only. It does not claim to follow roads, walking paths or transit routing; Routes API remains deferred to Phase 3C.
• A subtle light halo keeps the system blue route legible over dense Google basemap detail while markers remain visually above the route.

## Marker Preview Card

• Tapping an itinerary or Saved Place marker now reuses the App's own first image as a compact preview thumbnail when available.
• Firebase managed media resolves through the existing Local First media binder and thumbnail variant; legacy static gallery images remain supported.
• Preview cards show compact App metadata and a short detail line without adding Places Photo API or a second media lifecycle.
• Places without an image fall back to the existing itinerary icon or Saved Place star.

## Saved Place Region Filter

• Saved Place map scope now adds a second horizontal iOS style pill row derived from existing Saved Place area metadata.
• Region grouping prefers explicit region / district / city metadata and otherwise uses the first area segment, preserving the current Saved Place data model with no Firestore migration.
• Selecting a region hides unrelated Saved Place markers and automatically reframes the map to the visible markers with UI aware padding.
• Selecting `全部` restores and reframes all resolved Saved Place markers.

## Full Screen / Attribution

• Google attribution placement is intentionally unchanged. The map remains true full bleed instead of shrinking the canvas to manufacture extra bottom space.

## Maps Configuration Release Contract

• `assets/js/maps-config.js` is now treated as a user owned deployment file and is intentionally excluded from release ZIP updates so an existing restricted API key cannot be overwritten by future whole folder uploads.
• Added `assets/js/maps-config.example.js` as the versioned reference template.
• The Service Worker no longer precaches the user owned config during installation; it remains fetched normally when the map module is opened.

## Firebase / Data Contract

• No Firestore, Storage, Backup, Restore, Permanent Delete, media path or permission behaviour changed.
• No Routes API, Places API or additional Google Maps API is required by this build.

---

# v7.9.6.0 · Phase 3B Maps Foundation

## Added

• Added a lazy loaded Google Maps full screen surface opened from the existing circular itinerary header action grammar. Normal cold boot does not load Google Maps.
• Added current Day and Saved Place map scopes using the existing pill filter visual language.
• Added Advanced Marker based itinerary and Saved Place markers, with an iOS style floating place card and direct Google Maps handoff.
• Existing canonical latitude / longitude, placeId, address and Google Maps search references can resolve to map positions.
• Existing item and Saved Place location contracts remain authoritative; Phase 3B.1 does not write coordinates back to Firestore.
• Search references that need geocoding are cached locally on the device for 180 days to reduce repeated Geocoding requests without adding Firebase reads or writes.
• Unsupported short Google Maps links remain unresolved rather than guessing a location.
• Added a dedicated Maps browser configuration module. Google Maps stays disabled with a clear in App status until a restricted browser key is configured.

## Architecture

• Maps JavaScript API is loaded only when the user opens the map.
• Uses the current Google Maps importLibrary flow and AdvancedMarkerElement with a map ID.
• The initial release uses DEMO_MAP_ID by default so a separate production Map ID is not required for first device validation.
• Route calculation, polylines, travel time and Transit remain intentionally deferred to Phase 3C and 3D.
• No Firestore, Storage, Backup, Restore, Permanent Delete or media lifecycle behaviour changed.

## Deployment

• Requires a dedicated Google Maps browser API key restricted to the deployed HTTPS website and to Maps JavaScript API plus Geocoding API.
• No Firestore Rules, Storage Rules, indexes, Firebase config, CORS or Cloud Function changes.

# v7.9.5.4 · Phase 3A Lifecycle Cleanup Retention Hardening

## Final lifecycle hardening audit

• Audited the persistent Local First media queue, Storage / Registry resume contract, Lock and revoke enforcement, Backup canonical-media integrity, Restore rollback, and Permanent Delete prefix verification.
• Canonical media mutations remain protected by Firestore and Storage Rules: Owner / Admin only, Global Lock blocks writes, deleting Trips block writes, and revoked members cannot continue canonical media writes.
• Upload interruption remains resumable because pending jobs are persisted before Cloud work and retries reuse the same immutable Storage paths instead of creating duplicate objects.

## Fixed

• Non-blocking old-media cleanup is no longer discarded when it temporarily hits Global Lock or an access / permission barrier after the new canonical media has already committed.
• Orphan-cleanup jobs now remain durably queued and retry quietly after temporary access barriers instead of forgetting the orphan Storage / Registry record.
• Truly terminal cleanup states such as Trip deletion / missing Trip still stop local cleanup because Permanent Delete owns the complete `trips/{tripId}/` prefix cleanup.
• Backup remains unaffected by deferred orphan cleanup: canonical references remain authoritative and unreferenced ready media stays excluded from Full Backup.

## Deferred by design

• `cleanupStaleTripMediaUploads()` remains an explicit repair primitive rather than an automatic App-start sweep. Automatically listing the Media Registry on every launch would add routine Firestore reads for an edge case that requires the local IndexedDB queue itself to have been lost.
• A shared cross-device orphan sweeper is deferred to the future Edit Session / Cloud-commit architecture; Permanent Delete already guarantees final zero-residue cleanup.

## Deployment

• No Firestore Rules, Storage Rules, indexes, Firebase config, CORS or Cloud Function changes.

# v7.9.5.3 · Permanent Delete Handoff & Trip Title Hygiene

- After a successful Permanent Delete, the protected Profile navigation state now returns to the established root page instead of leaving the fallback Trip inside the previous Trip's destructive screen.
- Clears the DELETE confirmation and delete-backup state during the successful Trip handoff.
- Trip catalog titles are normalized to plain text before the Trip Switcher / My Trips UI consumes them, preventing legacy `titleMain` presentation markup such as `<span class=...>` from leaking into switcher labels.
- Permanent Delete Cloud Function audited with no backend changes required: it deletes the complete `trips/{tripId}/` Storage prefix and verifies that prefix is empty before the Trip root can be deleted. This automatically covers Trip icon, background, itinerary media and Saved Place media.
- No Firestore Rules, Storage Rules, indexes, Firebase config, CORS or Cloud Function deployment changes.

# v7.9.5.2 · Canonical Media Backup Integrity

## Phase 3A · Media-aware Full Backup finalization

- Full Backup media selection is now driven by the synchronized canonical Portable Trip references instead of blindly packaging every `ready` Media Registry record.
- Trip icon, background, itinerary gallery and Saved Place Storage descriptors are deduplicated by `mediaId` and matched against the Media Registry before ZIP creation.
- A canonical Storage media reference that is missing, not `ready`, or points to a different Registry path now stops Backup instead of producing a superficially successful ZIP with missing media.
- `ready` Registry records that are no longer referenced by canonical Trip data are treated as orphan candidates and are excluded from the Backup package; Backup itself does not delete them.
- Media bytes, SHA-256 verification, ZIP CRC, Restore package format and Firebase backend rules are unchanged.

# v7.9.5.1 · Saved Place Gallery Presentation Fix

## Fixed

• Saved Place cropped gallery images now clip through the same 14 px rounded container used by the established bottom sheet image grammar.
• Reset Saved Place swipe coordinates at every touch start so a normal tap can no longer inherit the previous swipe end point and silently change the selected photo.
• A Saved Place swipe now requires an actual touch move before changing the current gallery index.
• Full screen viewer entry resolves the currently rendered photo by immutable media identity before opening, so tapping the visible photo always opens that exact photo.
• Media data, Crop metadata, ordering, Firebase writes, Storage objects and the shared Media Engine are unchanged.

# v7.9.5.0 · Saved Place Multi Image Media Integration

## Added

• Saved Places now reuse the existing Phase 3A Local First media engine instead of introducing a separate image system.
• Owner and Admin can add multiple Saved Place photos from the existing Saved Place bottom sheet.
• New Saved Place photos reuse the existing non destructive 16:9 Crop workspace, IndexedDB first local commit, persistent background queue, Display plus Thumbnail Storage pair, Media Registry and Full Backup pending media gate.
• The existing Saved Place sheet reuses its established action button grammar for 加入相片, 向前移, 向後移 and 移除目前相片.
• Saved Place photos open in the existing full screen photo viewer with swipe, pinch zoom and double tap zoom.
• Crop metadata is applied only to managed cropped photos in the Saved Place sheet; legacy Saved Place images keep their existing presentation.

## Data integrity

• Saved Place media uses ownerType savedPlace and Storage namespace trips/{tripId}/media/savedPlaces/{placeId}/{mediaId}/.
• Every Saved Place photo add, remove and reorder updates trips/{tripId}/savedPlaces/{placeId} and bumps the Trip revision once for Passive Backup freshness.
• Pending media jobs are isolated by Trip and placeId; the current Trip Full Backup remains disabled only while its canonical media commit is incomplete.
• Removing Firebase managed Saved Place media detaches the descriptor first and cleans Storage afterwards; failed cleanup is retained as a resumable orphan cleanup job.
• Existing Firestore Rules and Storage Rules already permit savedPlace media ownership, so no backend deployment change is required.

## Scope

• This release intentionally focuses on Saved Place media functionality and data correctness. Fine animation and transient mutation polish remain deferred because the future Itinerary Edit Session will replace the current immediate Cloud mutation workflow.

# v7.9.4.7 · Gallery Media Hydration Self-Heal

## Fixed

• Added a self-healing itinerary media binder for intermittent iOS Safari image hydration failures that previously left a broken-image placeholder until page refresh.
• A stale or invalid Blob URL is now evicted from both the UI continuity cache and media integration URL cache, then rebuilt from the existing IndexedDB Blob before any Storage fallback is needed.
• Storage-backed gallery images now keep a valid transparent source while asynchronous hydration is pending, so Safari no longer exposes its native broken-image question-mark placeholder during a transient read race.
• Media resolution receives bounded automatic retries for transient client-side failures instead of requiring a full App refresh.
• The fix is read-path only: itinerary gallery data, crop metadata, multi-image ordering, Firebase writes, Storage object count and Backup integrity are unchanged.

# v7.9.4.6 · Multi Image Crop Layout Continuity

## Fixed

• Kept canonical itinerary crop metadata unchanged while making Gallery crop placement reactive to the real rendered slide size.
• Re-applies crop positioning after add, reorder and remove rerenders when iOS Safari finishes settling Gallery geometry, eliminating the temporary wrong crop that previously required a page refresh.
• Re-applies the same crop when Local First Blob URLs are promoted to canonical Cloud URLs.
• Correctly preserves exact edge focal values such as `focusX: 0` or `focusY: 0` instead of treating zero as a missing value.
• No Firebase reads, writes, Storage operations, schema or backend changes.

# v7.9.4.5 · Itinerary Multi Image Gallery

## Added

* Itinerary items can now keep multiple Firebase managed photos instead of a single `primary` photo.
* `加入相片` now appends a new cropped Local First photo to the existing gallery.
* Each new item photo receives its own durable mediaId, Storage path, Media Registry record and resumable background sync job.
* The existing single-photo `slot: primary` contract remains readable as legacy managed media; new photos use `slot: gallery`.
* Gallery management reuses the existing inline action-button grammar: add photo, move selected photo forward/backward, and remove the currently selected photo.
* Imported/static gallery images remain compatible and can be reordered or removed from the itinerary reference without attempting Storage cleanup.
* Standalone non-popup itinerary items now use the same horizontal gallery, dots, full-screen viewer and management actions as expanded detail items.

## Data integrity

* Item media jobs use a unique queue slot per mediaId while still blocking concurrent mutations on the same itinerary item.
* Firestore item `images[]` remains the canonical ordered gallery; every add, remove and reorder bumps Trip revision for Passive Backup freshness.
* Removing a Firebase-managed image detaches the descriptor first, then cleans its Storage objects; failed cleanup is persisted as an orphan-cleanup job.
* Local pending overlays are merged by mediaId so pending → canonical promotion never replaces another gallery photo.

## Scope

* This release intentionally focuses on the multi-image data model and core management behavior. Final gallery animation / micro-transition polish remains deferred until the multi-image structure is stable on device.

# v7.9.4.4 · Itinerary Crop Metadata Continuity

## Fixed

- Preserve itinerary image `crop` metadata through `trip-schema-service.js` normalization.
- Local pending media and Firebase canonical media now use the same `focusX`, `focusY`, `zoom` and `aspect` after realtime item updates.
- Prevent the itinerary gallery from jumping back to default centered framing when background upload finishes.
- Crop remains non-destructive: full-screen viewer continues to show the complete display image.
- No additional Firebase reads, writes, Storage objects or deployment changes.

---

# v7.9.4.3 · Crop Workspace & Stable Pinch

## iOS Photos-inspired crop workspace

- Rebuilt the itinerary crop interaction instead of patching the v7.9.4.2 gesture offsets.
- The image now lives in the full crop workspace rather than being clipped inside the 16:9 frame, so source content outside the crop window remains visible beneath a dim mask.
- The fixed 16:9 crop window retains the existing itinerary-card aspect ratio and rule-of-thirds guide.
- Added a Reset control while preserving the existing Cancel / Use Photo top-bar grammar.

## Gesture stability

- Pinch zoom now freezes its baseline at gesture start and anchors the image point beneath the two-finger midpoint, preventing recursive clamp / midpoint feedback jumps.
- Moving the pinch midpoint naturally pans while zooming; lifting one finger cleanly hands off to one-finger drag without a position jump.
- Single-finger drag, double-tap zoom/reset and resize reflow use the same clamped transform model and requestAnimationFrame rendering.
- Crop remains non-destructive: Firebase still stores the complete Display image and only focal crop metadata is attached to itinerary presentation.

## Firebase / backend

- No Firestore Rules, Storage Rules, indexes, Cloud Functions, Firebase config, CORS, Storage object count or media schema changes.

---

# v7.9.4.2 · Itinerary Crop Positioning

## iOS-style crop positioning

- Added a dedicated full-screen itinerary crop editor after image selection, following the existing full-screen media visual grammar rather than introducing a generic web cropper.
- The crop editor uses a fixed 16:9 itinerary framing guide with rule-of-thirds grid, drag positioning, pinch zoom, double-tap zoom/reset, iOS safe-area controls, Cancel and Use Photo actions.
- Crop is non-destructive: the complete Display image is still uploaded and remains available in the full-screen Photo Viewer. Only itinerary-card presentation stores focal crop metadata (`focusX`, `focusY`, `zoom`, `aspect`).
- Expanded itinerary galleries and lightweight non-popup media previews apply the saved crop consistently while the full-screen viewer deliberately ignores it and shows the complete Display asset.

## Data / Firebase

- Crop metadata travels with the existing Local First pending media descriptor, Media Registry record and canonical item `images[]` descriptor. No third Storage object is created and no extra Storage read or upload is required.
- Existing static / remote itinerary images remain unchanged; crop metadata is used only when present.
- Firestore Rules, Storage Rules, indexes, Cloud Functions, Firebase config and CORS are unchanged.

---

# v7.9.4.1 · Gallery Continuity & Viewer Safe Area

- Fixed the itinerary full-screen Photo Viewer stacking order so it now sits above the compact header and bottom navigation.
- Moved the Photo Viewer close control and photo counter further below the iOS safe area.
- Added last-known-good media URL continuity so Local First pending → Firebase canonical promotion does not expose a broken-image gap during itinerary rerenders.
- Gallery rerenders now capture the image actually visible in the current DOM before Firebase / media queue refreshes, preventing background upload completion from jumping back to photo 1.
- No Firebase Rules, Storage Rules, indexes, Cloud Functions, CORS, or backend schema changes.

---

# v7.9.4.0 · Itinerary Gallery Viewer

## Gallery quality and continuity

• Expanded itinerary galleries now resolve the existing Display media variant instead of stretching the 480 px thumbnail across the large gallery surface. Storage object count and Firebase usage are unchanged.
• The currently selected gallery asset is remembered by immutable media identity (`mediaId` / Storage path), not array index. Local First → Firebase canonical promotion and scoped rerenders therefore keep the same photo selected instead of jumping back to photo 1.
• The same selection continuity also survives gallery dot navigation and background media queue updates.

## iOS-style full-screen photo viewer

• Tapping an itinerary gallery image now opens a dedicated full-screen black photo viewer using the existing Display variant.
• The viewer follows iOS-native interaction grammar: safe-area top controls, a compact blurred close button, photo counter, horizontal swipe between images, pinch zoom, drag while zoomed and double-tap zoom.
• The lightweight media-only panel for non-popup items opens the same viewer when its preview is tapped.
• No original 12 MP source file is added to Firebase; the viewer deliberately uses the existing compressed Display asset, so Storage, Backup ZIP and Restore costs remain bounded.

## Compatibility / Firebase

• Itinerary media data model, Media Registry, Local First queue, Backup gate, Trip revision contract, Firestore Rules, Storage Rules, Indexes, Cloud Functions, Firebase config and CORS are unchanged.

# v7.9.3.9 · Itinerary Media Access Refresh Fix

## Fixed

- Fixed itinerary photo controls failing to appear when Local First itinerary data rendered before the current Trip membership role had resolved.
- Owner / Admin capability changes now trigger one targeted itinerary re-render for the active Trip, so both legacy popup items and ordinary non-popup items receive their photo controls once access is confirmed.
- Hardened itinerary media role checks so an Owner / Admin role from the previous Trip cannot leak into a Trip-switch handoff.
- Kept the v7.9.3.8 UI contract unchanged: popup items manage photos in expanded details; non-popup items use the lightweight photo accessory.
- No Firebase data migration, JSON re-import, new reads, new listeners or backend changes are required.

# v7.9.3.8 · Itinerary Media Entry Compatibility

## Item capability decoupled from legacy popup metadata

• Itinerary photo management is no longer gated by the legacy `item.popup` flag. A normal item with stable `dayId + itemId` can now expose the media capability even when it has no expandable detail arrow.
• Existing popup items keep their current arrow, expand-in-place detail layout, gallery and media controls unchanged. No existing item is made expandable merely because media is supported.
• Non-popup items use a compact photo accessory at the right edge of the existing itinerary row. Tapping it opens a lightweight media-only panel beneath that same row.
• When a managed photo exists, the accessory becomes a small rounded thumbnail; Owner / Admin can replace or remove it from the media panel, while read-only users can still view the photo.
• Pending Local First uploads remain disabled for replace / remove and continue to use the shared background queue, IndexedDB cache, Backup gate and Trip + Day + Item isolation from v7.9.3.7.
• The lightweight media panel stays open across media queue rerenders, so local preview and sync status do not collapse while Firebase finishes in the background.

## Compatibility / Firebase

• No JSON re-import or Trip migration is required solely to obtain the photo entry. Existing Trips only need stable Firebase Day and Item IDs already used by the current schema.
• Firestore Rules, Storage Rules, Indexes, Cloud Functions, Firebase config and CORS are unchanged.

# v7.9.3.7 · Phase 3A Itinerary Image Upload

## First itinerary-media vertical slice

• Owner / Admin can add one managed Firebase photo to an itinerary item from its existing expanded detail area, replace that managed photo, or remove it. Existing static / remote gallery entries are preserved; this slice manages only the new `slot: primary` Storage photo.
• Trip Lock keeps itinerary photo controls read-only. A pending upload disables replace / remove to avoid overlapping queue races, matching the established media safety rule.
• Selected photos use the existing Local First media engine: mobile decode + adaptive itinerary compression, IndexedDB local commit, immediate gallery preview, persistent background queue, parallel display / thumbnail Storage upload and resumable cloud sync.
• Pending itinerary media is isolated by `Trip + Day + Item` and blocks Full Backup only for its own Trip until cloud commit finishes.

## Canonical Firestore attach

• New item media uses Storage paths under `trips/{tripId}/media/items/{itemId}/{mediaId}/...` and the existing Firestore Media Registry owner type `item`.
• Cloud attach reads the latest item document, replaces only the managed `slot: primary` descriptor, preserves unrelated item images, writes the item update and activity log, and increments the Trip revision in the same batch.
• The Trip revision bump is mandatory for Day / Item mutations so the Passive Backup Sync Gate never trusts an inactive-Day seed across an itinerary content change.
• The Trip loader now adopts a newly server-confirmed revision after one full hydration, preventing a live revision change from repeatedly retriggering full-Day hydration against the launch-time seed revision.

## Local First UI continuity

• The expanded itinerary item stays expanded when media queue state causes a scoped itinerary rerender.
• Pending local media overlays the item gallery immediately and remains the same visual asset when Firebase generation metadata is promoted.
• Remove updates Firestore first, increments Trip revision and then performs best-effort old Storage / Registry cleanup.

## Firebase

• Firestore Rules: unchanged. Existing `days/{dayId}/items/{itemId}` edit rules and `media/{mediaId}` owner type `item` already cover this slice.
• Storage Rules: unchanged. Existing `trips/{tripId}/media/**` write rules already cover item media.
• Firestore Indexes: unchanged.
• Cloud Functions: unchanged.
• Firebase config / CORS: unchanged.

# v7.9.3.6 · Media Disabled-State Harmony

## UI harmony

• Trip Icon upload / remove rows now reuse the established `profile-row-disabled` visual treatment whenever the action is disabled.
• Trip Background upload / remove rows now use the same disabled treatment during local processing, background media sync, read-only access, or Trip Lock.
• Disabled state now greys the icon, title, subtitle and chevron consistently with Full Backup and other proven Profile rows.
• Upload queue, Firebase Storage, Media Registry, Local First behaviour and Backup gating are unchanged.

# v7.9.3.5 · Local → Cloud Media Handoff Fix

- Fixed the Local First media handoff where an already-visible Trip Icon or Background could briefly disappear after Firebase Storage upload completed.
- Treats pending → canonical generation promotion for the same immutable `mediaId + storagePath` as the same visual asset and reuses the existing Object URL.
- Background and Icon settings now preserve the currently visible local preview while queue state rerenders occur.
- A transient canonical media resolve failure no longer replaces an already-visible same-Trip background with the fallback background.
- No Firebase Rules, Indexes, Functions, config or CORS changes.

# v7.9.3.4 — Phase 3A Media Upload Performance Pass · Local First Queue

## Local First Commit
• Trip icon and Trip background selection now complete in two stages. The selected image is decoded, compressed and durably saved to IndexedDB first; the user no longer waits for the full Firebase transaction before continuing to use the App.
• A persistent metadata-only media job queue is stored in its own IndexedDB database. Display and thumbnail Blobs remain in the existing Trip media cache under their final Storage paths.
• Pending appearance media is rendered from the local cache immediately across the Trip Icon / Background settings, Trip Library, top-left Trip Switcher and active Trip background before the cloud descriptor exists.
• A tiny localStorage overlay index preserves the pending descriptor across a PWA relaunch so Local First continuity is not lost while a background job is unfinished.

## Background Firebase Sync
• Added `assets/js/trip-media-sync-service.js` as the resumable foreground sync engine. It automatically flushes after local commit, reconnect, foreground, focus and relaunch.
• Display and thumbnail variants now upload to Firebase Storage in parallel instead of sequentially.
• Successful `uploadBytesResumable()` snapshots now supply the object metadata directly; the upload path no longer performs a redundant `getMetadata()` round trip per uploaded object.
• After Storage and the Media Registry reach ready state, one server Trip read validates current lifecycle state and determines the actual cloud descriptor being replaced. The new descriptor is then attached to the Trip root and `settings/general` in one batch with the activity log.
• Old media cleanup runs after the new canonical descriptor is attached. Cleanup is non-blocking to normal App use and retries with bounded backoff if necessary.
• Interrupted jobs are resumable. A job that already reached Registry ready can resume from descriptor attachment without intentionally recompressing the image.
• Fatal permission, deletion or lock failures remove the provisional local appearance. Best-effort orphan cleanup is retained separately where server permissions allow it later.

## Compression Profiles
• Trip icon no longer uses the same 2048 px profile as a full-screen background. Icon display is capped around 768 px with a 256 px thumbnail.
• Trip background keeps a 2048 px display target and 640 px thumbnail, with adaptive WebP / JPEG quality steps and a practical output-byte target to reduce mobile upload time without sacrificing the full-screen use case.
• Prepared future profiles are included for itinerary and Saved Place media so later image surfaces can reuse the same tuned engine.

## Backup / Multi Trip Safety
• Full Backup remains disabled only for the Trip that currently has an unfinished blocking media job. A background job for Trip A does not unnecessarily block Backup for Trip B.
• Once the new media is cloud committed, the existing Trip / Expense server-confirmation gate remains authoritative before Backup can run.
• Local pending jobs are isolated by Trip and media slot. A second replacement of the same icon or background is temporarily disabled until the current job cloud commits, avoiding overlapping replacement races.
• No manual Sync button, Backup-time freshness read or blocking modal has been added.

## Firebase / Cost
• Firestore Rules: unchanged.
• Storage Rules: unchanged.
• Firestore Indexes: unchanged.
• Cloud Functions: unchanged.
• Firebase config: unchanged.
• CORS: unchanged.
• Normal media cloud cost remains two Storage objects per image. The performance pass reduces redundant metadata requests and pre-upload reads rather than increasing them.

# v7.9.3.3 — Phase 3A Media Upload Integration · Trip Background

## Scope
• Extends the proven v7.9.3.2 Trip icon media lifecycle to the active Trip background.
• Adds `我的 → 外觀與顯示 → 旅程背景` using the existing Profile card and navigation grammar.
• Cover media remains a prepared data contract only in this build because no current user-facing surface consumes `coverImageMedia`; this build does not create duplicate Storage media merely to populate an unused field.

## Trip Background Upload
• Owner / Admin can upload, replace and remove a custom Trip background. Viewer / Member and globally locked Trips remain read-only.
• Images use the existing Phase 3A client compression, ~2048 px display variant, ~640 px thumbnail, Firebase Storage upload, Firestore Media Registry and IndexedDB media cache.
• Storage path is `trips/{tripId}/media/trip/background/{mediaId}/...`.
• The Trip root and `settings/general` receive the same portable `backgroundImageMedia` descriptor only after the registry reaches ready state.
• Replacement uploads and attaches the new descriptor before old Storage media is cleaned. Failed attachment rolls the unattached upload back where possible.
• Remove first restores the existing legacy / generated background path, then cleans the detached Storage media.

## Background Continuity
• Existing background rendering remains atomic: when switching Trips or replacing a background, the previous visible background stays on screen until the next image has loaded and decoded. No fallback flash is inserted between them.
• Added one tiny active-Trip warm preview in localStorage after a Storage background first resolves. On the next PWA launch the first frame uses that same-image preview instead of a default / legacy background while IndexedDB resolves the full display image.
• The warm preview is visual cache only. It is not Firebase canonical data, is not written to Firestore / Storage and is not included as an independent Backup record.
• Full Backup remains disabled while a background upload / replace / remove mutation is in flight through the existing local media-mutation gate. No new Firebase freshness read is introduced.

## Firebase
• Firestore Rules: unchanged.
• Storage Rules: unchanged.
• Firestore Indexes: unchanged.
• Cloud Functions: unchanged.
• Firebase config: unchanged.
• CORS: unchanged.

# v7.9.3.2 — Trip Switcher Media Display Hotfix

• Fixed Firebase Storage Trip icons disappearing from the top-left quick Trip switcher even though the same icon was already visible in My Trips / Trip Icon settings. The quick switcher rebuilds its `innerHTML` every time it opens; it now immediately hydrates the newly-created media descriptor images through the existing IndexedDB / Storage thumbnail resolver.
• Fixed custom Trip photos rendering undersized in the quick switcher. The previous popover-only CSS forced every image to 22×22 inside a 30×30 frame with `object-fit: contain`; Storage-backed and legacy image icons now fill the full rounded 30×30 frame using `object-fit: cover`, matching the established My Trips visual treatment.
• No media upload, registry, Firebase listener, Backup Sync Gate, Trip switch logic or Profile compositor behaviour changed.
• No Firebase Rules, indexes, Functions, config or CORS changes.

# v7.9.3.1 — Trip Icon Module Cache Coherency Hotfix

• Fixed the user-visible version label that was accidentally left at v7.9.2.9 in v7.9.3.0.
• Fixed Trip icon upload failing with `service.updateTripIconImage is not a function` when a newly deployed `index.html` was paired with the previous cached `trip-appearance-service.js`.
• Dynamic imports now use a `build` cache-buster that the previous Service Worker does not strip, forcing the first request for a newly deployed module to reach the network even during Service Worker handoff.
• Service Worker registration and static shell cache-busters now follow the current App version instead of the stale v7.9.1.0 token.
• The new Service Worker canonicalises both legacy `v` and current `build` cache-busters after the handoff, preserving bounded cache storage.
• No Firebase Rules, indexes, Functions, config, CORS or media schema changes.

# v7.9.3.0 — Phase 3A Media Upload Integration · Trip Icon

## Scope
• Opens the first real user-facing Firebase Storage upload path on top of the v7.9.2.9 stable Backup Sync Gate checkpoint.
• This vertical slice covers Trip icon upload, replace and remove only. Trip background, itinerary images and Saved Place images remain read-only until the next media slices.

## Trip Icon Upload
• Added a new `我的 → 外觀與顯示 → 旅程圖示` page using the existing Profile navigation compositor and card grammar.
• Owner / Admin can choose an image from iPhone Photos / Files. Viewer / Member and globally locked Trips remain read-only.
• Images use the existing Phase 3A media engine: client-side decode and compression, ~2048 px display image, ~640 px thumbnail, Firebase Storage upload, Firestore Media Registry lifecycle and IndexedDB media cache.
• Storage remains under `trips/{tripId}/media/trip/icon/{mediaId}/...`.
• The Trip root and `settings/general` store the same portable `tripIconMedia` descriptor after the media registry reaches ready state.
• Trip switcher / Trip library uses the existing Storage-backed thumbnail read path automatically after the descriptor arrives through the normal Trip realtime listener.

## Replace / Remove Safety
• Replacement uploads the new media first, then atomically attaches the new descriptor to Trip metadata and writes an activity log. If attachment fails, the newly uploaded media is rolled back where possible.
• Only after the new descriptor is attached does the App clean the previous icon Storage objects, IndexedDB cache entries and media registry record. Cleanup retries once on a transient failure.
• Removing a custom icon first detaches the descriptor and restores the existing Trip icon fallback, then cleans the previous Storage media.
• A cleanup failure does not roll back a successfully attached replacement or restored fallback; the UI reports the cleanup warning instead of pretending the full lifecycle succeeded.

## UI / UX
• Upload progress is inline on the Trip Icon page; no new blocking modal or navigation system is introduced.
• While a media mutation is in flight, the existing Full Backup row is locally gated as `媒體更新中`; Backup cannot package a half-attached upload. No new Firebase freshness read is added.
• The page reuses the current Trip icon renderer, including Firebase Storage thumbnail resolution and existing emoji / bundled icon fallback.
• Existing Profile transition compositor code is unchanged.

## Firebase
• Firestore Rules: unchanged. Existing `canEditTripContent` and `/media/{mediaId}` rules already cover this write path.
• Storage Rules: unchanged. Existing `trips/{tripId}/media/**` Owner / Admin write policy already covers this upload path.
• Firestore Indexes: unchanged.
• Cloud Functions: unchanged.
• Firebase config: unchanged.
• CORS: unchanged.

# v7.9.2.9 — Backup Trust Chain Repair

## Fixed
• Repaired the persistent Trip freshness deadlock proven by the v7.9.2.8 real-device diagnostic build. A complete but untrusted render-cache seed now triggers one temporary all-Day server hydration, then automatically returns to Active-Day Realtime after trust is rebuilt.
• A previously server-confirmed same-revision render cache can no longer be downgraded merely because an ordinary Firestore cache-sourced `ready` event arrives before all current-session metadata confirmations. Revision changes and pending writes still invalidate trust normally.
• Instant Cache is no longer treated as current-session Firebase confirmation. Full Backup cannot become eligible from IndexedDB evidence alone; the live loader must receive server confirmation in the current session.
• Removed the temporary v7.9.2.8 diagnostic UI and debug exports after the root cause was proven on-device.
• Expense canonical realtime listeners now attach immediately after verified Trip access instead of waiting behind `ensureTripMembersAndSettings()`. The legacy preparation reads run afterwards and can no longer permanently block Expense Backup freshness or leave `cloudExpenseStarted` stuck before listeners exist.
• Expense listener failures now mark that freshness source unavailable and reattach the existing realtime set with bounded backoff; transient WebChannel errors no longer leave one source permanently dead.
• Preserved the v7.9.2.6 Expense binding-epoch isolation and Trip-switch suspension/rebind protections.
• The passive status timeout is now 25 seconds and preserves whether the unresolved blocker is Trip or Expense instead of collapsing both into one generic message.

## Behaviour
• Healthy trusted Trips remain on Active-Day Realtime and do not fan out inactive-Day listeners.
• A poisoned or previously interrupted Trip seed self-repairs once by server-hydrating all Days, seals the cache, and returns to the low-read steady state automatically.
• Full Backup remains passive at button press: no manual Sync button, no Backup-time `getDocs()` freshness query, no blocking modal network operation, and no weakening of server-confirmation requirements.

## Firebase
• No Firestore Rules change.
• No Storage Rules change.
• No indexes change.
• No Cloud Functions change.
• No Firebase config or CORS change.

# v7.9.2.8 — Backup Sync Gate Diagnostic Only

## Diagnostic scope
• Temporary read-only instrumentation for the persistent Full Backup sync failure seen on iPhone.
• Exposes the Trip loader seed trust state, active-Day realtime mode, server-confirmed Day count, missing Day confirmations, pending-write sources and current gate blockers.
• Exposes Expense module startup state, listener readiness, listener attachment state, listener errors and existing backup freshness metadata.
• Data Management shows three compact diagnostic lines directly on-device so Safari Web Inspector is not required.
• No sync algorithm, Backup eligibility rule, Firebase listener topology, hydration request, retry behaviour, permission logic, cache persistence behaviour or export behaviour is changed.
• No new Firestore read, getDoc, getDocs, listener, write or Backup-time network operation is added.

## Purpose
• Prove or reject the v7.9.2.7 root-cause review hypothesis that a poisoned render-cache seed can leave serverConfirmed false while Active Day Realtime confirms only one of multiple Days.
• Separately reveal whether Expense lazy startup, a hung settings preparation step, or a silently failed Expense listener is also blocking the gate.

## Firebase
• No Firestore Rules change.
• No Storage Rules change.
• No indexes change.
• No Cloud Functions change.
• No Firebase config or CORS change.

# v7.9.2.7 — Passive Backup Gate Watcher Lifecycle Hotfix

## Fixed
• Fixed a Profile compositor timing race where Data Management starts the Backup sync watcher while the 430 ms snapshot transition still keeps the live destination page hidden. The old 350 ms visibility check could therefore stop the watcher before the page became live, leaving the Backup row permanently frozen at 「同步中」 even after Firebase freshness changed.
• Added a short transition grace period entirely inside the Backup gate lifecycle. The protected Profile navigation compositor itself is unchanged.
• Existing Expense realtime freshness changes now dispatch a local UI event so the Backup gate repaints immediately when server confirmation arrives. No Firestore read is added.
• Sync copy now distinguishes 「行程同步中」 from 「支出同步中」, making any remaining blocker explicit.

## Firebase
• No Firestore Rules change.
• No Storage Rules change.
• No indexes change.
• No Cloud Functions change.
• No Firebase config or CORS change.

# v7.9.2.6 — Passive Backup Sync Handoff Hotfix

• Fixed the Phase 3A.3 passive Backup gate getting stuck on `同步中` after a Trip switch when the already-loaded Expenses module was still bound to the previous Trip and intentionally suspended for write isolation.
• The existing Expenses module can now rebind its canonical realtime listeners to the currently visible Trip in place. Data Management therefore observes the same autosync sources without adding Backup-only Firestore queries, a manual Sync action, or a page reload.
• Listener callbacks are generation-guarded during the handoff so stale snapshots from the previous Trip cannot mutate the newly bound Expense state.
• Full Backup status now distinguishes `支出同步中` when the Trip itself is already server-confirmed but Expense sources are still catching up.
• A 12-second passive status timeout changes a prolonged `同步中` label to `未能確認同步`; it never starts a network operation, never blocks navigation, and never enables Backup without real server confirmation.
• Firebase Rules, Storage Rules, Indexes, Functions, CORS, Backup ZIP schema, Restore schema and Permanent Delete cleanup contract are unchanged.

# v7.9.2.5 — Passive Full Backup Sync Gate

• Promoted v7.9.2.4 Trip Switch Continuity to the current stable Phase 3A checkpoint after real-device repeated Export → Switch testing passed.
• Full Backup now exposes the existing Firebase autosync state directly in the Backup row: `已同步`, `同步中`, or `未能確認同步`.
• Full Backup is enabled only when the current Trip and expense sources have received server-confirmed snapshots and have no pending writes. Offline or unconfirmed states remain fully navigable but cannot start Full Backup.
• Removed the ordinary Full Backup offline / Last Synced fallback. Full Backup now always requires archive-grade freshness and creates the existing Data + Media package path only. Legacy Backup files remain restorable.
• Backup no longer asks the Trip loader to perform a fresh full-server-confirmation pass when the user presses Backup. The export path captures already-synchronized local canonical data only; no Backup-time `getDocs()` freshness query or manual Sync action was added.
• Permanent Delete pre-backup now uses the same passive gate rather than initiating a Backup-specific synchronization wait.
• Added a trusted render-cache confirmation rule for inactive Day items. A cached Day payload may count as server-confirmed only when that cache was previously fully server-confirmed with no pending writes and the live server Trip root confirms the same revision. A revision mismatch still triggers the existing full hydration path.
• Metadata-only server acknowledgements now seal the render cache once after pending writes clear, preserving a trusted Local First seed for future passive freshness checks without rerendering the UI.
• Existing active-Day realtime optimisation, Firebase Rules, Storage Rules, Indexes, Functions, CORS, Backup ZIP schema, Restore schema and Permanent Delete cleanup contract are unchanged.

# v7.9.2.4 — Trip Switch Listener Rearm Continuity Hotfix

- Fixed the remaining iOS regression where repeated Full Backup download handoffs followed by Trip switching could eventually expose the Root Entry “正在開啟 Travel App…” screen indefinitely.
- Root cause: the v7.9.2.3 recovery path correctly re-armed a potentially suspended Firebase realtime listener, but `startFirebaseTripLoader()` demoted an already rendered target Trip from `ready` to `loading`. By then the short switch handoff could already be released, allowing the Entry Gate to cover the usable cached Workspace if the replacement transport was slow.
- Same-Trip recovery re-arms now preserve the existing ready Workspace state and only replace the Firebase transport. No new Firestore reads, sync buttons, blocking awaits, or UI flows were added.
- A successful realtime reconnect still refreshes the Trip normally. Transient listener stalls/errors keep the already visible cached Workspace usable. Explicit `permission-denied` / `not-found` behaviour remains authoritative and unchanged.
- Full Backup / Restore package format, export timeout/cancel protections, media cache, Firebase Functions, Firestore Rules, Storage Rules, indexes and CORS are unchanged.

# v7.9.2.3 · Post Export Trip Switch Continuity Hotfix

## Phase 3A.3 hotfix

* Manual Trip switching now reuses the proven Phase 2G Workspace handoff instead of allowing a transient new-Trip access state to expose the root Entry loading gateway.
* The selected target Trip now hydrates from the existing user-bound IndexedDB instant render cache in parallel with Firebase realtime listeners.
* The current Workspace remains visible during the handoff; once target cache or realtime data paints, the handoff releases normally.
* After an iOS native download / Files handoff, a target Trip that has not regained a server-confirmed realtime state will re-arm the existing Trip and access listeners once after a short watchdog delay.
* The watchdog issues no explicit Firestore get/getDocs request, creates no new sync feature, and never blocks the UI on a network promise.
* If the target still cannot paint after the one listener re-arm, the switch safely rolls the session back to the original Trip instead of leaving Trip A visuals paired with Trip B session state.
* Existing Firebase autosync, access Rules, Backup ZIP format, Restore, Storage Rules, Firestore Rules, Functions and media lifecycle are unchanged.

# v7.9.2.2 · Backup Export Escape Hatch / Firestore Resume Hardening

## Phase 3A.3 hotfix

* Replaced the unbounded Full Backup media-registry `getDocs()` dependency with a cancellable server-confirmed snapshot read that has a 12 second timeout.
* Reuses a recent server-confirmed media-registry snapshot for immediate repeated exports and invalidates that snapshot on media upload, restore or delete.
* If a refresh times out after a previously confirmed snapshot exists, the export can fall back to that last confirmed registry instead of deadlocking the PWA.
* Full Backup export is now cancellable while busy. Cancel aborts the media-registry listener / package pipeline and closes the operation sheet; destructive Restore behaviour is unchanged.
* Added a 90 second outer Full Backup package timeout so the operation always has an escape hatch even if an SDK promise never settles.
* Media cache IndexedDB transaction completion handlers are attached before request awaits, removing the Safari transaction-event race.
* Cache hits no longer rewrite the entire cached Blob just to touch LRU metadata; hot-session access time is tracked in memory instead.
* Firebase Storage media reads now have bounded cache/download waits and no longer wait on best-effort IndexedDB writes after Storage bytes arrive.
* ZIP CRC work is chunked with main-thread yields so large media packages keep the UI repainting and cancellation responsive.
* Removed the double `requestAnimationFrame` prerequisite before repeat export; background-throttled rAF can no longer block the next export.
* Backup progress now distinguishes media-registry confirmation, media collection and ZIP construction.
* Restore picker / ZIP parser are unchanged from v7.9.2.1 because Restore passed real-device testing.

# v7.9.2.1 · iOS Backup Export / Restore Hotfix

## Scope

Targeted regression hotfix for v7.9.2.0. No Firebase schema, Rules, Indexes, Storage contract, Permanent Delete logic, media paths, or visible navigation design changes.

## Repeated Full Backup Export

• Reduced iOS peak memory while building media-aware ZIP packages.
• ZIP entries now retain one byte representation instead of reading a Blob for CRC / SHA and then retaining the Blob again.
• Media collected for Backup reuses the bytes already read for SHA-256 instead of reading each media Blob a second time during ZIP creation.
• Full Backup integrity normalization removes redundant deep clones of the whole Trip / expenses payload.
• A previous Backup Object URL is explicitly revoked before the next Backup build starts, with a short iOS handoff settle turn.
• ZIP restore parsing uses byte views instead of copying every entry out of the whole ZIP buffer.

## Full Backup Restore Picker

• Replaced the reused hidden Full Backup file input with a fresh one-shot picker for every selection.
• Picker accepts `.zip,.json` by extension for more reliable iOS Files behaviour.
• Added focus / visibility return fallback so a selected file is still processed if iOS fails to dispatch the normal `change` event.
• Existing ZIP / legacy JSON validation and Restore routing remain unchanged after file selection.

---

# v7.9.2.0 · Phase 3A.3 Media-aware Full Backup / Restore

## Scope

This build closes the media lifecycle before any new user-visible upload UI is enabled. Full Backup can now preserve Firebase Storage image bytes in a verified ZIP package and restore them together with Trip data. Existing Data Only JSON backups remain backward compatible.

## Media-aware Full Backup Package

• Added `assets/js/trip-backup-package-service.js` as the canonical ZIP package engine.
• Online Full Backup now creates a standard ZIP package containing `manifest.json`, `trip-data.json` and media files under `media/<mediaId>/...`.
• Media bytes are not embedded as base64 JSON.
• ZIP media entries use STORE mode because uploaded images are already compressed.
• Every media file is protected by SHA-256 in the package manifest and CRC32 in the ZIP entry.
• The embedded `trip-data.json` keeps the existing `travel-full-backup` v1 data contract, with its existing whole-payload SHA-256 integrity guard.
• Media-backed Full Backup strips Storage generation hints from portable data so restored bytes are not tied to an obsolete Firebase object generation.
• Offline ordinary Full Backup remains available as Last Synced Data Only JSON. Permanent Delete pre-backup continues to require Server Confirmed data and now always creates the media-aware ZIP package.

## Media Restore

• Added exact-path media restore support to `trip-media-service.js` with Storage upload, Firestore media registry rebuild and IndexedDB cache refresh.
• In-place Full / Trip Restore restores package media and reconciles media registry entries not present in the selected Backup.
• Expenses-only Restore deliberately leaves media untouched.
• Deleted Trip rebuild supports Data + Media package restoration. If the original Trip ID is unavailable, existing retarget logic now rewrites all `trips/{oldTripId}/media/...` references to the new canonical Trip ID before restore.
• Data Only Full Backup v1 JSON remains accepted and behaves exactly as before.
• A media-aware `trip-data.json` extracted without its ZIP media files is rejected before media restore with a clear `backup-package-required` error.

## Lifecycle Safety

• New media upload UI remains disabled. This release only closes Backup / Restore first.
• Permanent Delete Cloud Function is unchanged and still removes the full `trips/{tripId}/` Storage prefix before deleting the Trip root.
• Existing membership / roles are still never restored from Backup.
• Existing Audit Logs remain append-only during in-place restore.
• Package media restore rolls back newly-created media records on an upload failure where possible; existing records are retained for retry.

## UI / UX

• No new page, card, navigation system, spacing system or upload control was introduced.
• Existing Data Management sheets are reused. Wording now distinguishes Media-aware ZIP from offline Data Only JSON.
• Full Backup file picker now accepts both `.zip` and legacy `.json`.

## Files Changed from v7.9.1.0

• `index.html`
• `manifest.json`
• `sw.js`
• `CHANGELOG.md`
• `assets/js/trip-backup-package-service.js` new
• `assets/js/trip-backup-service.js`
• `assets/js/trip-media-service.js`

## Firebase Deployment

• Firestore Rules: unchanged
• Storage Rules: unchanged
• Firestore Indexes: unchanged
• Cloud Function: unchanged
• CORS: unchanged
• No Firebase backend redeploy is required for this build.
