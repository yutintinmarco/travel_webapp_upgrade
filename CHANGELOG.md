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
