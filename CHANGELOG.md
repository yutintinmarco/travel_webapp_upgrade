# Travel WebApp — v7.7.0.5

## Phase 2F current build

### Multi Trip Instant Cache Boot

• Added a user bound IndexedDB render cache containing the last fully assembled Portable Trip for each recently used Firebase Trip.
• After Firebase Auth restores the signed in account, the remembered or deep linked active Trip can paint from the app render cache immediately instead of waiting for the full Trip catalog and every Firestore subcollection listener.
• The Firestore live loader now starts optimistically for the remembered Trip as soon as Auth is ready. The catalog and role enrichment continue in parallel.
• Firestore remains the source of truth. Cache or server snapshots replace the instant render cache automatically when the live loader finishes assembling the Trip.
• The render cache is keyed by both Firebase uid and tripId so another signed in account cannot reuse a different user’s app render cache.
• Permission denied, Trip not found, and live access revocation invalidate the app render cache for that user and Trip.
• Offline reopening can continue to use the app render cache after Auth identity restores, while high risk write operations remain blocked by the existing Phase 2F offline controls.
• Up to six recently rendered Trips are retained per user; old render cache entries are pruned automatically.

### Expected UX

Previously:

`App open → wait for catalog → role reads → Trip listener tree → first Firebase paint`

Now, after a Trip has completed one successful Firebase load:

`App open → Auth restore → instant cached Trip paint → Firebase refresh in background`

The v7.7.0.4 wrong Trip flash protection remains in place. Bundled trip.json is still the safe signed out or unavailable fallback.

### Package and Firebase

• Added `assets/js/trip-render-cache-service.js`.
• Service Worker shell cache updated to v7.7.0.5 and includes the new render cache module.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.

This package intentionally keeps only one development document: CHANGELOG.md.

## Build QA

• `node --check` passed for every JavaScript module, both inline scripts, and `sw.js`.
• JSON validation passed for `manifest.json`, `firebase.json`, `firestore.indexes.json`, and `trip.json`.
• No duplicate static HTML IDs were found.
• Firestore Rules structural sanity passed.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.4.
• The protected v7.3.13 Profile Navigation compositor source is byte for byte unchanged from the validated v7.7.0.4 baseline, preserving protected SHA256 `15cef32014cf89aee69e344a101f5027344507b62d8738ed1355103140bfea0f`.
• ZIP integrity test passed.
