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
