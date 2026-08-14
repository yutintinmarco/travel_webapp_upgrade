# Phase 2F v7.7.0 — Security, Offline & Multi-device Hardening

## Implemented

### Security Rules
- Private Trip parent documents are no longer readable by every signed-in account.
- Existing Trip reads require membership.
- JSON import still supports creating a brand-new Trip without probing private Trip metadata.
- Invite acceptance no longer reads the private Trip before membership; the pending invitation authorises one atomic self-join.
- Owner cannot be demoted or removed by Admin.
- Viewer remains read-only.
- Member can write expenses / settlements but not itinerary, saved places, settings, snapshots or membership.
- Expense hard delete is denied; the module uses soft delete for auditability.
- Member expense actions can write only the approved expense activity types.

### Cross-device write collision protection
- Import Replace and Snapshot Restore acquire a Firestore Trip operation lock.
- A second device receives `trip-operation-busy` instead of writing over the first operation.
- Stale operation locks expire after 12 minutes.
- Local high-risk operations are mutually exclusive in one App session.

### Partial-write recovery
- Failed Import is marked `importState: failed`.
- Failed Restore is marked `restoreState: failed`.
- Firebase Loader does not render partially written content when either state is failed.
- The last successfully rendered Trip remains visible while recovery is required.

### Offline
- Firestore persistent IndexedDB cache remains enabled.
- The PWA App Shell is now cached by the service worker, so a previously opened installation can boot while offline.
- A thin inline status strip appears only when offline, during a high-risk operation, or after access is revoked.
- Import, Restore, Manual Snapshot, Archive and Member-management writes require an online connection.
- App → 我的 → App 與資料 now shows network, cache and cloud-operation status.

### Membership revocation
- Trip Access now reports `ready` only after the membership listener resolves.
- When a member is removed and the server reports the change, the App reconciles to another accessible Trip or the local fallback.

## Important offline security limitation

Firestore offline persistence can retain data that a device was legitimately allowed to read earlier.
Removing a user prevents future server reads/writes after the device reconnects, but it cannot remotely erase data already cached on a device while that device remains offline.

## Required deployment

This release changes `firestore.rules` and `sw.js`.

Publish the web build and then deploy Firestore Rules:

firebase deploy --only firestore:rules

No new Firestore composite index is required by Phase 2F.

## Recommended acceptance tests

1. Owner / Admin / Member / Viewer on separate Google accounts.
2. Viewer attempts itinerary and expense writes: both must fail / UI remains read-only.
3. Member creates, edits and soft-deletes an expense; operation record should be written.
4. Remove Member on Device A while Device B is open; Device B should lose access after the server update reaches it.
5. Turn airplane mode on after the Trip has loaded; cached Trip should remain readable and the orange offline strip should appear.
6. While offline, Import / Restore / Archive / Member actions should be blocked immediately.
7. Start Restore on Device A, then attempt Import/Restore on Device B: Device B should report another device is updating the Trip.
8. Close and reopen the installed PWA while offline after one successful online load; the App shell should still open.
