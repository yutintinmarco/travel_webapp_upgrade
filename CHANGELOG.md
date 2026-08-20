# v7.7.7.4 · Safari Firestore Persistence Stabilization

## What changed
- Firestore web persistence now uses the default single-tab `persistentLocalCache()` mode.
- Removed `persistentMultipleTabManager()` because the installed Travel PWA is intended to run as one primary app instance per device.
- Removed the unused `disableNetwork()` / `enableNetwork()` recovery helper from `firebase-service.js`.
- IndexedDB persistence, offline reads, warm boot cache and normal multi-device realtime sync remain enabled.
- Local First Export from v7.7.7.3 is retained unchanged.

## Expected trade-off
- Opening the same Travel App simultaneously in multiple tabs / browser instances on the same device is no longer a supported persistence scenario.
- Using different devices at the same time is unaffected.

## Files changed
- index.html
- sw.js
- manifest.json
- CHANGELOG.md
- assets/js/firebase-service.js
