# Travel WebApp — v7.7.0.4

## Phase 2F current build

- Fixed iOS participant checkboxes in 支出 → 完整新增.
- Participant names now remain aligned in a two-column selector grid.
- Multi-Trip boot now resolves the remembered/deep-linked active Trip before
  first trip-specific paint.
- If bundled trip.json is Trip A but the remembered active Firebase Trip is B,
  A is not rendered. A neutral “正在載入上次旅程…” state is shown until B arrives
  from Firestore cache/server.
- Safe fallback to bundled trip.json remains for signed-out / unavailable Trip.
- Firestore Rules and indexes are unchanged from v7.7.0.

This package intentionally keeps only one development document: CHANGELOG.md.
