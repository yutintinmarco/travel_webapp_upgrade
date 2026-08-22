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
