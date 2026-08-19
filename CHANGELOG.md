# v7.7.7.3 · Local First Export Engine

## What changed
- Read-only exports no longer re-read Firestore after the first iOS file-download handoff.
- Entering Data Management now prepares the local export sources while Firestore is still healthy: current Trip state, expense/settlement/activity state, and recent Snapshot payloads.
- `trip.json` is built from the current synchronized in-memory Trip state.
- Full Backup JSON is built from a frozen local Trip + expense snapshot and refuses to export if required local data is incomplete.
- Expense Excel uses the already synchronized local expense state.
- Snapshot export uses the Snapshot payload preloaded with Version History data instead of fetching the Snapshot again.
- Snapshot History reuses the preloaded local Snapshot cache when available.
- Removed the failed Firestore network-cycle recovery from the read-only export path.

## Files changed
- index.html
- sw.js
- manifest.json
- CHANGELOG.md
- assets/js/trip-backup-service.js
- assets/js/expenses-module.js

## Firebase
- Firestore Rules unchanged.
- Firestore indexes unchanged.
