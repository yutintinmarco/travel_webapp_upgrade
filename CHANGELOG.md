# v7.7.7.2 · Firestore Resume Recovery

## Fixed
- v7.7.7.1 diagnostics confirmed the second export reaches the Firebase read stage and times out there; Auth and Data Operation busy-state cleanup are not the blocker.
- After any generated-file download handoff, the next Firebase-backed Data Management operation now cycles the existing Firestore SDK network state with `disableNetwork()` then `enableNetwork()` before issuing reads.
- The recovery keeps the same Firebase app, Firestore instance, persistent IndexedDB cache, document references and realtime listeners; it only rebuilds the network transport.
- If a Firebase-stage timeout still occurs, the session is flagged so pressing Retry performs the network recovery before trying again instead of repeating the same stalled read.
- Recovery itself issues no extra Firestore document read or write.

## Regression scope
- Export / Backup / Snapshot / Restore business logic unchanged.
- Deleted Items UI unchanged.
- Firestore Rules and indexes unchanged.
