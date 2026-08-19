# v7.7.7.0 · Reentrant Export Reliability

## Fixed
- Data Management export state is now completed before the browser/iOS file-download handoff.
- Consecutive exports in the same App session no longer depend on JavaScript continuing after Safari takes over the first download.
- Full Backup JSON, current trip.json and Snapshot version export share the same deferred download handoff.
- Expenses Excel is generated fully in memory first, then returned to Data Management for the same deferred handoff.
- Direct Expenses Excel export remains supported through the Expenses module.

## Behaviour
- Export preparation still completes before a file is offered to the browser.
- No extra Firestore reads or writes are introduced by the download lifecycle change.
- Backup, Restore, Snapshot, permissions and UI layout are otherwise unchanged.

## Files changed from v7.7.6.9
- index.html
- sw.js
- manifest.json
- CHANGELOG.md
- assets/js/expenses-module.js

## Firebase
- firestore.rules unchanged
- firestore.indexes.json unchanged
- firebase.json unchanged
- trip.json unchanged
