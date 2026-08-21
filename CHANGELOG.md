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
