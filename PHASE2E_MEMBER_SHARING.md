# Phase 2E v7.6.4 — Member Sharing

## Enabled
- 我的 → 旅程設定 → 旅程權限
- Owner / Admin / Member / Viewer
- Invite by Google email without knowing UID
- Pending invite works before the invited user has ever used the App
- Invite inbox under 我的 → 我的旅程
- Accept / decline invitation
- Owner can invite, change and remove Admin / Member / Viewer
- Admin can invite, change and remove Member / Viewer
- Owner cannot be removed or transferred in this phase
- Member changes are written to 操作記錄

## Invitation delivery
This release creates an in-App invitation bound to the Google email.
It does not automatically send an email message.

## Required Firestore deployment
This release changes firestore.rules.

firebase deploy --only firestore:rules

No new composite index is required by these member-sharing queries.

## Next
Phase 2F remains the final security hardening, offline and multi-device regression phase.
