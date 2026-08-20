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
