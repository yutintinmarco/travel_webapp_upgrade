# Phase 2C Firestore setup

This build keeps Firestore in secure mode. Do not switch the database to Test mode.

Before the first JSON import, publish the included `firestore.rules` in Firebase Console:

1. Firebase Console
2. Firestore Database
3. Rules
4. Replace the current default deny rules with the contents of `firestore.rules`
5. Publish

These are Phase 2C bootstrap rules. They allow a signed in user to create a trip only when that user is the trip creator and is included as a member, then restrict trip content to trip members. Owner and Admin can import or replace itinerary data. Phase 2F will do the final security hardening and rules regression tests.

The importer writes in small batches. Replacing an existing trip first saves a pre import snapshot under `trips/{tripId}/snapshots` and then updates itinerary data. Members, expense records and prior snapshots are not deleted by a replace import.

## Composite index

The Active / Archived trip catalog uses `memberUids array-contains uid` together with `archived == true/false`. If Firestore reports that an index is required, create the index shown in `firestore.indexes.json` (or use the Firebase Console link included in Firestore's error).

## v7.4.2 note

If the Phase 2C rules from v7.4.1 are already published, v7.4.2 does not require another Rules publish. Same JSON / change detection is handled by the client import service and uses the existing permitted trip reads.
