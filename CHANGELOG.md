# v7.8.2.4 · Proven Native Keyboard Handoff

- Keyboard interaction only. No app feature, page layout, Profile navigation, Permanent Delete backend, Firebase Rules, indexes, assets, or data flow changed.
- Replaced the Travel App viewport-height-only keyboard detector with the proven Price Tracker PWA focus + visualViewport implementation: keyboard-capable focus hides Bottom Navigation immediately; focus/viewport state restores it when the keyboard closes.
- Bottom Navigation keyboard exit motion now uses the same interaction timing/distance as the reference implementation.
- No keyboard handler may write scrollTop, reposition the page, or alter form geometry.

# v7.8.2.3 · Legacy iOS Keyboard Restore

- Restores the v7.7.7.4 keyboard interaction contract directly from the frozen baseline: Bottom Navigation keyboard CSS, visualViewport keyboard detection, and Profile `trip-member-field` input CSS are copied verbatim.
- Removes later DELETE-specific keyboard attributes so the Permanent Delete confirmation uses the same ordinary Profile input behavior as the proven Google email form.
- No Firebase Function, Firestore Rules, Index, backup, restore, or Permanent Delete backend logic changes.

# v7.8.2.2 — Profile Keyboard Regression Hotfix

- Reverted the v7.8.2.1 custom Profile keyboard repositioning layer after iOS testing showed repeated viewport/scroll bouncing while typing.
- Restored the proven pre-v7.8.2.1 keyboard behaviour used by existing Email/Profile inputs: only the existing bottom-navigation keyboard visibility hook remains; no custom page anchoring or repeated scrollTop repositioning.
- Permanent Delete confirmation now uses the same established Profile input behaviour as existing Email fields rather than a special DELETE-only keyboard system.
- Permanent Delete backend, Firestore Rules, indexes and cleanup logic are unchanged.

# v7.8.2.1 · Permanent Delete Runtime & iOS Keyboard Hotfix

## Permanent Delete Runtime

* Fixed a strict-mode server runtime bug in the final Trip-root verification path. After deleting the Trip root, the function now verifies the root with an explicitly scoped snapshot instead of assigning to an undeclared variable.
* Added explicit server deletion-stage tracking across Trip child cleanup, Storage cleanup, cross-reference cleanup, member cleanup, pre-root verification, root delete and post-root verification. If a future cleanup step fails, the client can report the actual stage instead of only showing a generic percentage.
* Existing resumable deletion markers, deletion lease, server-only root delete and root-last invariant remain unchanged. A partially deleting v7.8.2.0 Trip can be resumed after this Function is deployed.

## iOS Keyboard Harmony

* Permanent Delete confirmation keeps the existing Profile page and existing form components, but the focused DELETE field now uses iOS-safe 16px text sizing to avoid WebKit focus zoom behaviour.
* While a Profile form keyboard is open, the existing bottom navigation hides immediately, the existing Profile detail bar stays anchored with the app's existing navigation material, and only the scroll-shell content is repositioned to expose the focused field.
* The layout scroll position is restored after the DELETE field closes so the App does not look like a webpage whose whole canvas has been pushed upward.

## Compatibility

* No Firestore Rules or index changes.
* No image, icon, background, Expenses CSS or other asset changes.
* v7.3.13 Profile Navigation compositor remains protected and unmodified.

---

# v7.8.2.0 · Phase 2G.3 Backup, Restore & Permanent Delete

## Archival Full Backup

* Delete-before-backup now keeps the existing Local First export engine but requires realtime datasets to be server-confirmed with no pending writes before it can be labelled archival-grade. Offline or uncertain state remains a clearly labelled Last Synced Backup instead of being treated as current.
* Full Backup v1 now carries SHA-256 payload integrity metadata. Restore verifies the hash before Firebase writes begin while legacy v1 backups without integrity metadata remain supported.
* The current Data Only v1 boundary remains explicit. Phase 3A will extend the same lifecycle into a media-aware backup package without putting base64 media into portable trip.json.

## Restore After Permanent Delete

* Access Lobby Full Backup selection can rebuild a deleted Trip when the signed-in user has Authorized Trip Creator entitlement. The current user becomes the new Owner; historical members and roles are never restored from backup.
* If the original canonical Trip ID has since been reserved, the existing Data Operation form asks for one replacement canonical ID and retargets the backup deterministically before creation. No hidden sourceTripId/newTripId identity pair is introduced.
* In-place Full Restore, Trip Only Restore and Expenses Only Restore keep their existing semantics and append-only audit behaviour.

## Permanent Delete

* Added an authenticated callable Cloud Function in asia-east2. It verifies the initiating Owner, refuses an active Import / Restore operation, marks the Trip root as deleting, recursively removes Trip child data, clears Storage under trips/{tripId}/, deletes invites, Personal Archive preferences, Trip ID registry and registered cross references, verifies zero remaining data, and deletes the Trip root last.
* Client Firestore Rules no longer allow direct Trip-root deletion and block ordinary Trip writes once deletionState is deleting.
* Membership documents are deliberately preserved until the final child-cleanup stage so the Owner retains normal catalogue access for as much of an interrupted cleanup as possible.
* Permanent Delete is idempotent and resumable. A user-bound local pending-delete marker is written before the callable starts and is cleared only after server verification. If the PWA is closed or loses the response, the same Owner automatically resumes the existing deleting Trip on the next authenticated launch; if the server had already finished, the idempotent verification path clears the stale marker.
* The server claims a per-Trip deletion lease before cleanup so two devices cannot run destructive recursion concurrently. A live request reports already-running and the PWA keeps its pending marker for a later verification/resume; interrupted server runs release the lease for immediate retry.
* Only a verified cleanup result may display 「旅程已永久刪除」. Network failure, timeout or verification failure preserves a retry path instead of pretending success.

## Firebase / Deployment

* Added functions/ with Node.js 22 and the permanentDeleteTrip callable. Firebase Functions requires Blaze.
* firebase.json now includes the Functions source directory.
* firestore.rules changed for deleting-state enforcement and server-only Trip-root deletion.
* firestore.indexes.json adds the tripPreferences.tripId collection-group index used to remove every user's Personal Archive reference during deletion.
* No existing image, icon, background, Expenses CSS or v7.3.13 Profile Navigation compositor design is changed.

---

# v7.8.1.3 · Phase 2G.2 Revoke Handoff & UI Alignment

## UI Harmony

* Trip Lock row restores the canonical 10px icon-to-copy spacing used by the adjacent Trip Permission / Expense Management rows. The status pill remains clone-safe without shifting the title a few pixels left.
* Existing Apple Settings row, status pill and chevron components are reused; no new visual system is introduced.

## Revoke & Transition Stability

* Server-confirmed revoke now starts a dedicated Trip-to-Trip handoff before any asynchronous loader teardown, so the already-visible Workspace stays on screen until the replacement Trip is hydrated.
* Catalog removal of the revoked Trip can no longer clear the visual latch in the middle of that handoff. A few seconds of already-rendered cached itinerary may remain visible by design while Firebase write access is already denied.
* Expenses no longer forces an immediate iOS PWA reload during revoke or normal Trip switching. Its Trip-specific Firestore listeners are suspended immediately, the App switches back to the existing itinerary view if necessary, and a safety reload is deferred until the user next opens 支出.
* The deferred Expenses reload first persists the visible replacement Trip cache, preserving write isolation without using App Entry / Login as a routing mechanism.
* No feature, permission rule, backup, restore, archive or lock semantics are reduced.

## Compatibility

* No Firestore Rules or index changes.
* No image, icon, background or Expenses CSS changes.
* v7.3.13 Profile Navigation compositor remains protected and unmodified.

---

# v7.8.1.2 · Phase 2G.2 Harmony & Stability

## UI Harmony

* Trip Lock status-row geometry is now class-based so the v7.3.13 Profile compositor clone keeps the status pill and chevron on one line after push / pop navigation.
* Global Lock disabled Import / Restore / Snapshot Restore rows now reuse the existing no-Team disabled appearance, including muted text, icon and chevron.
* System Management now uses a full Profile navigation page built only from the existing Profile detail bar, grouped card, member list, field and primary-action components. The old management sheet is removed.
* A zero-Trip App Admin opens that same System Management page from Access Lobby; no duplicate management UI is introduced.

## Transition & Revoke Stability

* A server-confirmed revoke is now treated as a Trip-switch event rather than an App-entry event. If another known active Trip is available, the App switches directly to it and keeps local-first rendering while access is rechecked in the background.
* Access Lobby is shown only when no other active accessible Trip is available. Revoke no longer intentionally routes through Login / resolving UI while Firebase Auth is still valid.
* Existing Expense listener safety remains intact. A hard reload is retained only when the Expenses module has already mounted long-lived listeners for a different Trip; the replacement Trip ID is persisted first so Fast Resume reopens the correct Trip.
* Existing local-first boot, last-known access, permissions, Global Lock, Personal Archive and Restore logic remain functionally unchanged.

## Compatibility

* No Firestore Rules or index changes.
* No image, icon, background or Expenses CSS changes.
* v7.3.13 Profile Navigation compositor remains protected and unmodified.

---

# v7.8.1.1 · Phase 2G.2 Restore Preflight Hotfix

## Fixed

* Fixed the Trip Lock settings row so the status pill and chevron remain on the same line using the existing Settings row geometry.
* Global Trip Lock now visibly disables `匯入 trip.json`, `還原完整 Backup`, and Snapshot restore while keeping backup/export/history viewing available.
* Full Backup Restore and Snapshot Restore now expose granular preflight stages instead of sitting at an opaque 5% state.
* Read only restore preflight Firestore calls now have a bounded timeout with a clear stage-specific error before Trip data writes begin.
* Restore progress errors are surfaced on the foreground progress sheet instead of appearing to hang indefinitely.
* Normal restore write logic remains unchanged; the hotfix targets preflight observability, timeout safety and locked-state affordance.

## Compatibility

* No Firestore Rules or indexes change.
* No image, icon, background or Expenses CSS change.
* v7.3.13 Profile Navigation compositor remains protected.

---

# v7.8.1.0 · Phase 2G.2 Access Continuity & Trip Lifecycle

## Personal Archive

* Personal Archive now lives at `users/{uid}/tripPreferences/{tripId}` and affects only the signed-in user's Trip list.
* Archive / restore no longer mutates the Trip root or produces a global Trip activity log.
* Existing root-level `archived` fields remain a legacy fallback until each user establishes a personal preference, preventing old archived Trips from unexpectedly reappearing.
* Archiving the active Trip switches to another active accessible Trip when possible. If no active Trip remains, the App enters Access Lobby and exposes the user's Archived Trips for immediate restore.

## Access Continuity & Revoke

* Added a user-and-Trip-bound Last Known Access record containing the last server-confirmed role.
* Offline startup can continue using a previously verified cached Trip without waiting for Firebase.
* Reconnect still reconciles membership. A server-confirmed missing membership or `permission-denied` clears the remembered access and exits the Trip; transient network errors do not eject a usable local Trip.
* Quick Switcher and Entry state now exclude personally archived Trips once the catalog is authoritative.

## Global Trip Lock

* Added a distinct Owner / Admin Global Trip Lock on the Trip root. It is independent from date-derived Trip status and the Expense Lock.
* Global Lock keeps the Trip viewable but blocks normal Trip content changes, Import Replace, Restore, expense writes, settlements and Trip-scoped settings changes.
* Member / invite security administration, viewing, Full Backup export and Snapshot creation remain available while globally locked.
* The new UI reuses the existing `我的 → 旅程設定` Apple Settings pattern and existing profile management page components.

## Expense Lock Separation

* Expense Lock operational state now lives under `trips/{tripId}/settings/expenses` as `expenseLocked` metadata.
* Legacy root `status: "locked"` remains a compatibility fallback until a modern Expense Lock value exists.
* Expense Lock continues to block expense modification while settlement / reporting behavior remains available as before.
* User-facing wording is now `支出鎖定` so it cannot be confused with the new Global Trip Lock.

## Security & Compatibility

* Firestore Rules enforce Personal Archive ownership, Global Trip Lock write restrictions and the separated Expense Lock contract.
* Full Backup remains Local First and can still be created while a Trip is locked. Restore and Import Replace refuse to mutate a globally locked Trip.
* Access rights, Personal Archive preferences and lifecycle lock metadata are not restored from backup payloads.
* Phase 2G.1 Zero Flash returning boot, single-tab persistent cache, existing permissions, Data Management and the protected v7.3.13 Profile Navigation compositor remain unchanged.

## Deployment

* Deploy `firestore.rules`.
* No Firestore index deployment is required.
* No Cloud Function deployment is required.

# v7.8.0.5 · Phase 2G.1 Zero Flash Returning Boot

## UX

* Returning users with a remembered user-bound active Trip now keep the cached Workspace visible continuously from launch / refresh.
* The branded `正在開啟 Travel App…` Entry loading screen no longer replaces an already-visible cached Trip while Auth, catalog or realtime listeners reconnect.
* True signed-out, first-use and unusable-cache states still use the proper Login / Entry Gateway.

## Access safety

* Fast Resume remains bound to the remembered Firebase UID and active Trip ID.
* A different or signed-out Firebase identity clears the optimistic workspace latch immediately.
* A server-confirmed membership denial, missing Trip or authoritative catalog removal clears the latch and exits the Trip.
* Transient network / listener errors continue to leave the local Trip usable.

## Protected areas

* No Profile Navigation compositor changes.
* No bottom navigation `資料` changes.
* No Data Management, Creator, Rules, Indexes or lifecycle feature changes.

# v7.8.0.4 · Phase 2G.1 Fast Resume Boot Cleanup

* Home Screen PWA launch and in-app reload now use the same Fast Resume path whenever a remembered user UID and active Trip are available.
* IndexedDB Trip render cache starts before the bundled `trip.json` network request, removing the visible Travel App loading Gateway on normal returning-user launches.
* A later bundled `trip.json` response can no longer overwrite a Trip already painted by Fast Resume.
* The legacy identity plus「正在確認旅程存取權」transitional cards are removed from the resolving path; when no usable cache exists, resolving uses only the branded lightweight opening panel.
* Firebase Auth and membership still reconcile in the background. Confirmed sign-out, account mismatch or revoke exits the optimistic local Trip as designed.

# v7.8.0.3 · Phase 2G.1 Refresh Continuity & Login Handoff

## Changed

* Ordinary in app reloads now continue from the remembered App shell and IndexedDB Trip render cache instead of replaying the full Login Gateway as a loading screen.
* Warm reload can repaint the remembered user bound Trip cache before Firebase Auth finishes restoring the session. Auth and Trip access are still reconciled immediately in the background.
* If Auth resolves signed out or to a different Google UID, the warm refresh bypass is cancelled and the proper Login Gateway takes over.
* A deliberate Google login now stays on the new Login Gateway while the destination Trip is resolving. The legacy identity plus access confirmation cards no longer flash between Login and Workspace.
* Signed out launches, zero Trip Access Lobby, Invite flow, Creator management and all Phase 2G.1 security rules remain unchanged.

## QA target

* Refresh while signed in with a remembered Trip: App shell and local Trip appear without Login Gateway replay.
* Sign out then launch: proper Login Gateway appears.
* Login from Gateway: no legacy confirmation screen flashes before Workspace.
* Auth mismatch or signed out result cancels optimistic refresh view.

# v7.8.0.2 · Phase 2G.1 UX & Local-First Access Polish

## What changed

* Reworked the signed-out Entry Gateway into a proper app login screen using the existing Travel App icon, current iOS typography, card geometry and safe-area system.
* Restored speed-first local boot after Firebase Auth confirms the same Google UID: the remembered IndexedDB Trip cache can paint immediately while membership is revalidated in the background.
* A server-confirmed revoke now clears the optimistic cache window, invalidates the Trip render cache and ejects the Trip without requiring an app restart.
* Transient network/listener errors no longer masquerade as a revoke or hide a usable local Trip; only an explicit permission-denied decision ejects access.
* App Admin is now a superset of Trip Creator for new-Trip creation. App Admin no longer needs to add their own email as a separate Creator.
* Creator management now reports `already-app-admin` and `already-creator` instead of silently rewriting an existing entitlement.
* No Phase 2G.2 lifecycle work is included in this build.

## Deployment

* Deploy `firestore.rules`.
* No Firestore index deployment is required.
* No Cloud Function deployment is required.

---

# v7.8.0.1 · Phase 2G.1 App Admin Completion

## Scope

This is a focused completion build on top of v7.8.0.0. It keeps the Entry and Access Foundation unchanged while completing the product level management path for Authorized Trip Creators. Phase 2G.2 lifecycle work is not included.

## App Admin Bootstrap

• Added `appAdmins/{uid}` as the global WebApp administration entitlement.
• App Admin records are intentionally not client writable. The first trusted App Admin is seeded once through Firebase Console with `enabled: true`.
• App Admin and Trip Creator remain separate concepts. App Admin can manage the creator allowlist; Creator can create a new Trip but does not gain access to unrelated Trips.

## Creator Management in the WebApp

• Added a hidden by default `系統管理` Settings row that appears only to an App Admin.
• Added the same `系統管理` entry to the zero Trip Access Lobby, so global administration does not depend on already having Trip access.
• Added an Apple style management sheet using the existing Import sheet and Member Management visual grammar rather than a new UI system.
• App Admin can grant Creator entitlement by Google email and remove existing Creator entitlement.
• Email lookup uses the existing minimal `users/{uid}` profile directory. A target account must have signed in to Travel App at least once before another App Admin can grant it by email.
• If the App Admin grants or removes their own Creator entitlement, the existing Entry Lobby creation action updates immediately without an App restart.

## Security

• Only App Admin may list, create, update or delete `authorizedTripCreators` documents.
• Ordinary users may still read only their own Creator entitlement.
• App Admin may read the minimal `users` profile directory solely to resolve Google email to UID for Creator grants. Ordinary users retain self only access to user profiles.
• User profile writes now require the stored email to match the authenticated Google email, preventing a client from spoofing another email to obtain a Creator grant.
• `appAdmins` cannot be created, modified, listed or removed by client code.
• Existing Trip Owner, Admin, Member and Viewer permissions are unchanged.
• New Trip creation still requires Authorized Trip Creator entitlement and the canonical Trip ID registry contract introduced in v7.8.0.0.

## UI and UX Protection

• Existing Profile Navigation compositor functions are untouched.
• Bottom Navigation `資料` remains the travel document area.
• `我的 → 資料管理` remains unchanged.
• No image, icon, background, gallery or Expenses CSS asset was changed.
• The new administration surface reuses existing Profile rows, Member rows, capsules, inputs and bottom sheet geometry.

## Firebase

• `firestore.rules` changed for `appAdmins`, App Admin user directory reads and WebApp Creator management.
• `firestore.indexes.json` is unchanged.
• No Cloud Function is introduced in this completion build.

## Files Changed from v7.8.0.0

• `index.html`
• `manifest.json`
• `sw.js`
• `firestore.rules`
• `CHANGELOG.md`
• `assets/js/app-admin-service.js` new

---

# v7.8.0.0 · Phase 2G.1 Entry & Access Foundation

## Scope

This is the first Phase 2G build from the frozen v7.7.7.4 stable baseline. It establishes the root Entry and Access security layer without redesigning the existing Trip workspace.

## Entry and Access

• Added a root application entry state machine for Authentication, Access Resolution, Access Lobby and Trip Workspace.
• Signed out users now remain outside the Trip workspace and use a Login Gateway built from the existing Profile and Apple Settings visual grammar.
• Signed in users with zero authoritative Trip access now use a dedicated Access Lobby instead of seeing the ordinary empty Trip shell.
• Existing signed in users with valid Trip access continue directly into the existing workspace after access verification.
• The pre Authentication remembered Trip paint is removed. The existing IndexedDB instant Trip cache is retained, but it is applied only after the current Firebase user and access are verified.
• Online access requires server confirmed membership or catalog state. Cached membership remains available for genuine offline startup and will be hardened further in Phase 2G.2.

## Invite Flow

• Added invite deep link routing through `?invite=...`.
• If Google sign in is required, the invitation return target is preserved through the authentication flow.
• Pending direct invitations stay in the Access Lobby until accepted or rejected.
• Successful acceptance can route directly into the newly authorized Trip without forcing the user through unrelated menus.
• Existing invitation rows, actions and member service logic are reused rather than redesigned.

## Authorized Trip Creation

• Added `authorizedTripCreators/{uid}` as the global entitlement for creating a brand new Firebase Trip.
• Ordinary authenticated users can no longer create arbitrary new Trips through the import flow.
• Creator entitlement can be read only by the matching authenticated user. Client code cannot grant, edit or remove the entitlement.
• Existing Owner and Admin Replace Import behavior remains available and does not require global creator entitlement.

## Canonical Trip ID Registry

• Added the privacy preserving `tripIds/{tripId}` registry.
• New Trip creation reserves the canonical Trip ID, creates the Trip root and creates the initial Owner membership in one atomic batch.
• Registry documents contain reservation data only and do not expose Trip title, dates, owner identity, member information or itinerary content.
• Existing pre Phase 2G Trip Owners lazily backfill their canonical registry entry after an authoritative catalog load.
• A reserved private Trip ID is reported only as already used without exposing private Trip metadata.

## UI and UX Protection

• Login Gateway and Access Lobby reuse existing Profile identity cards, Settings rows, invite rows, buttons, typography, spacing and safe area behavior.
• Bottom navigation `資料` remains the travel document area and has not been repurposed.
• `我的 → 資料管理` remains the system data management location.
• Existing Trip workspace, Data Management workflow, Local First Export behavior, single tab persistent Firestore cache and Phase 2F performance optimizations are retained.
• No new image, icon, background, gallery or CSS asset was introduced for the Entry Gateway.

## Protected Navigation

The v7.3.13 Profile Navigation compositor reference ZIP is now used as the source of truth. The protected compositor function bodies are byte identical between v7.3.13, v7.7.7.4 and v7.8.0.0 for the verified compositor function set.

## Firebase

• `firestore.rules` changed for Authorized Trip Creator and canonical Trip ID Registry enforcement.
• `firestore.indexes.json` is unchanged.
• No Cloud Function is introduced in Phase 2G.1. Server side Permanent Delete orchestration remains Phase 2G.3.

## Files Changed

• `index.html`
• `manifest.json`
• `sw.js`
• `firestore.rules`
• `CHANGELOG.md`
• `assets/js/app-entry-service.js` new
• `assets/js/trip-creator-service.js` new
• `assets/js/trip-access-service.js`
• `assets/js/trip-catalog-service.js`
• `assets/js/trip-import-service.js`
