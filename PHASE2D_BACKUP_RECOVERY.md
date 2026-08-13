# Phase 2D — Backup & Recovery

Version: v7.5.0

## What is included

1. Export the current Firebase trip as portable `trip.json`.
2. List the 10 most recent Firestore Snapshots.
3. Create a manual Snapshot for Owner / Admin.
4. Export any Snapshot as portable `trip.json`.
5. Restore a Snapshot. Before restore, the app automatically creates a `pre-restore` safety Snapshot of the current Firebase trip.
6. Snapshot restore preserves trip membership, archive state, and expense transaction documents.
7. Restore increments the trip revision and writes an activity log.

## Firebase setup

No new Firestore Rules or composite index is required if the Phase 2C rules are already published. The Snapshot history query only orders by `createdAt`, which uses Firestore's normal single-field index.

## Important Phase 2 boundary

Until Phase 2E, the visible itinerary is still rendered from the bundled local JSON. Restoring a Firebase Snapshot therefore changes the Firebase copy immediately, but the on-screen itinerary will not switch to that Firebase version until the Phase 2E Firebase loader becomes the source of truth.

## Suggested test

1. Sign in as the Owner.
2. Go to 我的 → 旅程設定 → 行程匯出與備份.
3. Export the current Firebase trip and confirm a JSON file downloads.
4. Create a manual Snapshot and confirm it appears in 版本紀錄.
5. Open an older Snapshot and export it.
6. Restore an older Snapshot and confirm a new pre-restore safety Snapshot appears afterwards.
7. Confirm members and expense transaction documents remain untouched in Firestore.
