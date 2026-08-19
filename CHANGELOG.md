# v7.7.7.1 · Export Stage Diagnostics & Timeout Recovery

## What changed
- Added explicit export stages for Data Management workflows: module load, auth check, Firebase read, file build, and download handoff.
- Added bounded timeouts so a second export can no longer remain stuck indefinitely in 「處理中」.
- When a stage times out, the sheet now names the exact stalled stage and re-enables the controls without requiring the App to be quit.
- Full Backup JSON, trip.json, Snapshot export, and Expenses Excel now expose consistent progress diagnostics.
- No export data model, Firestore rules, expense UI, or Deleted Items UI was changed.

## QA target
Run consecutive exports in one App session. If the second export fails, record the exact stage shown (for example 「確認登入」 or 「讀取 Firebase」) so the next fix can target the proven subsystem rather than guessing.
