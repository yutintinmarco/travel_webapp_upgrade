# v7.7.6.4 · Deleted Items Restore Button Placement

- Refined 「已刪除項目」 rows to reuse the same visual rhythm as 「最近支出」, with a clear breathing gap between the category colour rail and the text block.
- Kept the amount as the top-right anchor and placed the compact 「還原」 action directly beneath it as one tidy trailing amount/action column.
- No expense data logic, permissions, Firebase schema, or Firestore Rules were changed.

# v7.7.6.2 · JSON Type Guard + Portrait + Deleted Expense Harmony

- Added explicit JSON file-type discrimination between Portable `trip.json` and Full Backup JSON. A Full Backup selected from 「匯入 trip.json」 is blocked before schema import or Firebase inspection, and the sheet offers to route the same file into 「還原完整 Backup」. The reverse mistake is also blocked with a clear instruction to use 「匯入 trip.json」 instead.
- Added a schema-level guard so Full Backup JSON cannot be accepted by the Portable Trip validator even if the UI route is bypassed.
- Kept the manifest portrait preference and strengthened it to `portrait-primary`. Touch devices that still rotate into landscape now show a full-screen rotate-back gate; supported standalone browsers also receive a best-effort Screen Orientation lock request.
- Rebuilt 「已刪除項目」 rows using the existing Expense list grammar instead of tinted standalone cards. Deleted entries now use normal separators, existing typography, a trailing amount and a compact restore action. The deleted-items sheet no longer renders a separate tinted footer/dock surface.
- Fixed Data Operation summary Saved counts to read the current Portable Trip `snacks.items` collection when `savedPlaces` is not present on the live `tripData` shape.
- No Firestore Rules, indexes, Firebase configuration, membership logic, Backup payload schema, bottom navigation 「資料」 tab, or protected Profile Navigation compositor changes.

## Deployment

- Functional files changed: `index.html`, `assets/js/trip-schema-service.js`, `assets/js/expenses-module.js`, `assets/css/expenses.css`.
- Version/cache files changed: `sw.js`, `manifest.json`, `CHANGELOG.md`.
- Firestore Rules and indexes are unchanged; no Firebase Rules deployment is required.

---

# v7.7.6.1 · Data Management Visual Harmony

- Reused the established App Info section-heading grammar for Data Management group titles, including font size, weight, spacing, and inset.
- Fixed empty optional operation-sheet containers rendering as blank grey rounded bars on iOS Safari. Hidden options, secondary metadata, and progress UI now stay fully removed when unused.
- Applied the hidden-state fix to the shared Import/Data Operation sheet primitives so Backup export, trip.json export, Expenses Excel, manual Snapshot, Snapshot export/restore, and Full Backup restore follow one consistent behaviour.
- No Firebase schema, Rules, indexes, Expense data logic, Backup data logic, or protected Profile Navigation compositor changes.

# v7.7.6.0 · Data Management Menu & Unified Operation Sheets

## Data Management information architecture

• Added a dedicated 「資料管理」 page under 「我的」. The bottom navigation 「資料」 tab is unchanged and remains reserved for Visa / passport / travel-document information.
• Moved trip.json import, Full Backup export / restore, current trip.json export, Expense Excel, manual Snapshot and Version History into 「我的 → 資料管理」.
• Removed the duplicate trip.json import entry from 「我的旅程」, the old 行程匯出與備份 entry from 「旅程設定」, and the Expense Excel shortcut from 「支出管理」.
• Renamed 「App 與資料」 to 「App 資訊」 so system diagnostics are clearly separated from Trip data management.
• 「版本紀錄」 is now a child page of 「資料管理」; Snapshot detail returns to Version History.

## Unified Data Operation Sheets

• Promoted the proven 「匯入旅程」 bottom-sheet grammar to the canonical data-operation workflow. Export, Full Backup restore, Snapshot creation / export / restore and Expense Excel now use the same title, summary, status/warning and bottom-action hierarchy.
• Full Backup restore no longer renders an inline Settings-card preview. After file validation it opens a dedicated operation sheet with Trip summary, Backup type, settlement count and explicit Full / Trip-only / Expense-only restore scope selection.
• Snapshot restore no longer relies on a browser confirm dialog; the selected revision is previewed in the same operation sheet before the destructive action starts.
• Data Only v1 media limitations remain explicit. No Backup schema, Restore scope semantics or Firebase membership rules changed.

## Expense report route

• Added a direct `export:excel` Expense module action so 「資料管理 → 支出 Excel 報表」 can start the existing report exporter without opening the legacy Expense backup/settings sheet. The request waits for the live expense, settlement and activity-log snapshots before generating the workbook, avoiding an empty cold-start export.
• Removed the old Expense internal 「資料備份」 settings entry to avoid parallel export surfaces. The existing Excel engine itself is unchanged.

## Deployment

• Functional files changed: `index.html` and `assets/js/expenses-module.js`.
• Version/cache files changed: `sw.js`, `manifest.json`, `CHANGELOG.md`.
• Firestore Rules, indexes, Firebase configuration, `trip.json`, protected bottom navigation 「資料」 tab and protected Profile Navigation compositor are unchanged.

---

# v7.7.5.3 · Restore Preview Card Harmony

## Restore Preview card parity

• Rebuilt 「還原預覽」 using the same `profile-card + profile-backup-history-card` structure as 「版本紀錄」 instead of the separate `profile-menu-card + profile-meta-row` layout.
• Trip ID, backup content counts, media state and the append-only Audit Log note are now standard Settings rows inside the same card grammar as Snapshot history.
• Long Trip IDs and count summaries wrap inside `profile-row-copy` rather than stretching the card.
• Restore actions keep their existing Full / Trip Only / Expenses Only semantics and now sit in the same inset-row geometry as the version list below.
• Removed the v7.7.5.2 bespoke two-column Restore Preview containment rules; the preview now relies on the proven Version History card layout rather than a parallel card system.

## Regression scope

• No Backup data format, Restore logic, Expense logic, Firebase writes, Rules, indexes, Trip schema or protected Profile Navigation compositor changed.

## Deployment

• Functional file changed: `index.html` only.
• Version/cache files changed: `sw.js`, `manifest.json`, `CHANGELOG.md`.
• `assets/` is unchanged. Firestore Rules and indexes are unchanged.

---

# v7.7.5.2 · Expense Cold Start + Restore Preview Polish

## Expense Cold Start Self Healing

• Fixed a cold-start race where the 支出 module could mount before the current Trip membership snapshot had resolved, interpret the temporary `role: null / ready: false` state as read-only, and remain unusable until the PWA was quit and reopened.
• The Expense module now treats unresolved access as a distinct pending state, shows 「正在確認旅程權限…」, and only treats a missing role as genuine no-access after the Trip access service reports `ready: true`.
• Added a bounded self-healing refresh path at 0.7s / 2.2s / 5s while access remains unresolved. Refresh requests are routed through the App shell's existing versioned `trip-access-service` instance, so no duplicate Firebase module instance is created.
• Access refresh responses are Trip-scoped. A stale access event for another Trip cannot enable Expense writes against the currently mounted Trip.
• Full Add / Quick Add / OCR actions remain disabled while access is genuinely unresolved and immediately re-enable once an Owner / Admin / Member role becomes authoritative. The submit label now distinguishes access checking, read-only access and a locked Trip.

## Full Backup Restore Preview Responsive Polish

• Fixed long Trip IDs, backup count summaries and append-only audit notes overflowing the Restore Preview card on narrow iPhone layouts.
• Restore Preview metadata now uses a constrained two-column grid with a shrinkable value column, safe `overflow-wrap`, and normal multiline flow.
• The fix is scoped to `#trip-full-backup-preview`; the protected Profile navigation compositor and the general Apple Settings row geometry are unchanged.

## Deployment

• Functional files changed: `index.html` and `assets/js/expenses-module.js`.
• Version/cache files changed: `sw.js`, `manifest.json`, `CHANGELOG.md`.
• Firestore Rules and indexes are unchanged; no Firebase Rules deployment is required.

# v7.7.5.1 · Deferred Boot Fail Safe

## Boot regression repair

• Fixed the v7.7.5.0 regression where the Trip header, background and bottom navigation could appear while every `.app-view` remained hidden behind `trip-boot-deferred`.
• Root cause was identified in the new appearance refresh path: `applyFirebaseTripData()` referenced `tripDirty` without declaring it. The resulting runtime exception occurred after core rendering but before `releaseDeferredTripBoot()`, so the workspace stayed invisible.
• Added the missing Trip dirty-scope calculation and moved deferred-boot release to the point immediately after the core itinerary / Saved Places / Info / Weather views are usable. Optional appearance and library refreshers can no longer keep the whole App hidden if they fail.
• Destination and Team in-place theme refreshers are now non-critical guarded steps.

## Deferred boot fail-safe

• Added a 5 second boot watchdog. If the requested Trip has already rendered, the visibility gate is released. If the remembered Trip matches the bundled fallback, the same Trip can paint locally while Firebase continues reconciling in the background.
• When the remembered Trip differs from the bundled fallback, the watchdog does not expose the wrong Trip; it shows an explicit reconnecting placeholder instead.
• A schema-service startup failure now follows the same safe fallback rule instead of leaving the workspace permanently invisible.
• Releasing the boot gate always clears the watchdog to prevent late fallback actions.

## Regression scope

• No Firestore schema, Rules, indexes, Backup semantics, Restore modes, expense persistence, member permissions, active-Day realtime strategy or protected v7.3.13 Profile Navigation compositor changed.

---

# v7.7.5.0 · Backup Foundation + Appearance Consolidation

## Full Backup Foundation v1

• Added a versioned `travel-full-backup` Data Only v1 format containing the Firebase Trip structure, Portable Trip representation, actual expense records, settlements and activity logs.
• Added Owner / Admin Full Backup export from 「行程備份」. The file is explicitly marked `mediaIncluded: false`; Phase 3A will extend the same versioned lifecycle into a media-aware Backup Package rather than embedding photos in JSON.
• Added in-place Full Backup restore with three scopes: 完整還原, 只還原行程, and 只還原支出. Trip-only restore leaves expense settings / transactions untouched; expense-only restore leaves itinerary / Saved Places / general appearance untouched.
• Membership, Owner/Admin roles and access rights are never rolled back by Full Backup restore.
• Existing Activity Logs remain append-only for audit integrity. The backup file contains the historical logs for archival / future disaster recovery, while an in-place restore does not delete or rewind the live audit trail.
• Data Only v1 restore is intentionally limited to the same canonical Trip ID. Recreating a permanently deleted Trip from a local backup will be completed with Phase 2G creator entitlement / Trip lifecycle and Phase 3A media restore.

## Backup / report separation

• `trip.json` remains the lightweight Portable Trip format and continues to exclude actual expense transactions.
• The expense settings entry now presents the Excel report as the primary human-facing export. The old expense-only JSON button is removed from the UI because disaster recovery now belongs to Full Trip Backup.
• Existing Firebase Snapshots remain itinerary-version snapshots and keep their current safe restore behaviour.

## Appearance consolidation

• Added an editable Trip Accent Colour for Owner / Admin. This is the canonical `accentColor` already used by the App and is now manageable in the UI.
• Added Saved Places and Expenses feature colours. Each follows the Trip Accent by default and can be independently overridden or reset to follow the Trip again.
• Saved Places priority badges / filters now derive a tonal family from the Saved Places accent instead of fixed legacy pink / blue / beige colours.
• Expenses now consume `--expense-accent`, falling back to the Trip Accent. Semantic destructive / success / warning colours remain independent.
• Feature colours round-trip through Firebase general settings, Portable JSON, warm boot cache and Backup export to avoid first-paint colour flashes.

## Deferred to Phase 2G

• Trip ID registry creation is deliberately deferred until the new Entry & Access Gateway introduces Authorized Trip Creator entitlement. This prevents shipping a registry while arbitrary authenticated users can still create new Trips.
• Personal Archive, global Trip Lock, Permanent Delete and invite-only creation remain Phase 2G lifecycle work.

## Firebase deployment

• No Firestore Rules or index changes are required in this build. The new appearance writes and Full Backup restore operations use existing Owner / Admin permissions.

---

# v7.7.4.6 · Import Cold Start Reliability

## First import readiness

• Fixed the cold-start path where a valid JSON could remain stuck at 「正在比較 Firebase」 with the Import button disabled until the PWA was force-quit and reopened.
• Import inspection now reuses the App's already-known authenticated identity before waiting for a second auth initialisation path.
• The Trip Import service and Auth dependency are prewarmed during browser idle time and again when the Import control is touched; this loads code only and does not issue an extra Firestore read.
• JSON validation and Firebase inspection are decoupled from the file-picker event so a slow first Firebase handshake cannot leave the picker workflow itself pending indefinitely.

## Slow-response recovery

• Added an 8 second inspection watchdog. If Firebase is still responding, the modal changes to 「Firebase 回應較慢」 and offers 「重新檢查」 instead of remaining permanently disabled.
• The already-selected JSON stays in memory, so retry does not require choosing the file again.
• A slow original inspection may still complete normally and automatically enable the correct Import / Replace action; stale results are ignored if the user closes the sheet or starts a newer retry.
• Genuine offline state remains blocked, and no write is enabled until Firebase inspection has positively determined the import mode and permission.

## Regression scope

• No Firestore schema, Rules, indexes, Import write semantics, Snapshot logic, active-Day realtime loader, expense module, member roles or protected Profile Navigation compositor changed.
• Normal successful inspection does not add any Firestore read. An additional inspection occurs only if the user explicitly uses 「重新檢查」 after a slow / failed attempt.

---

# v7.7.4.5 · Snapshot Export + Operation Lock Reliability

## Snapshot export repair

• Fixed 「版本紀錄 → 匯出此版本」 by routing Current Trip and Snapshot exports through one canonical Portable JSON export boundary.
• The exporter now accepts both the current Firestore snapshot structure and older / imported snapshot payloads that already resemble Portable JSON.
• Snapshot export preserves the selected Snapshot revision and export metadata while keeping the same Portable JSON contract used by current Trip export.
• No backup restore semantics are expanded in this build; the planned Full Backup / Trip Only / Expenses Only restore work remains for v7.7.5.0.

## Multi device operation lock repair

• Moved the high risk Import / Restore coordination lock from `trips/{tripId}` to `trips/{tripId}/operations/current`.
• Import and Restore can now update the Trip parent document without invalidating the transaction that decides which device owns the operation lock.
• A second Owner / Admin attempting Import or Restore while another device holds the lock should fail quickly with the existing 「另一部裝置正在更新此旅程」 path instead of remaining stuck at 「準備還原」.
• The operation document is deleted on release and retains the existing 12 minute stale lock takeover behaviour.
• Snapshot restore no longer copies the legacy parent level `activeOperation*` fields back into the Trip document.

## Firebase deployment

• `firestore.rules` changed to permit Owner / Admin access to the new `operations/current` coordination document only.
• Firestore indexes are unchanged.
• **Firestore Rules must be redeployed for this build before testing Import / Restore concurrency.**

## Regression scope

• No itinerary UI, expense UI, active Day realtime loader, warm cache, Auth, member roles or expense lock behaviour changed.
• The protected v7.3.13 Profile Navigation compositor remains untouched.

---

# v7.7.4.4 · Full Add Uses OCR Sheet Layout

## Expense full-add sheet

• Rebuilt the Full Add sheet footer structure to match the working OCR Entry sheet instead of adding another safe-area CSS hotfix.
• `expenseForm` is now the scrollable sheet body directly under the modal card, matching OCR's `heading → body → footer` hierarchy.
• The primary action footer is now a direct child of the modal card, exactly like OCR Entry, rather than being nested inside the flex form.
• Removed the Full Add-only `sticky-modal-actions` path. The submit button uses the standard HTML `form="expenseForm"` association, so validation and the existing submit handler are unchanged.
• This deliberately leaves the v7.7.4.3 shared safe-area architecture untouched. The only remaining layout difference between OCR and Full Add is content length / detent, not footer ownership.

## Regression scope

• No Firestore schema, rules, indexes, loader, cache, auth, permissions, trip data or expense persistence logic changed.
• No visual changes to OCR Entry. It is the reference implementation for this fix.

---

# v7.7.4.3 · Expense Sheet Footer Architecture Cleanup

• Replaced the stacked v7.7.4.1 / v7.7.4.2 expense-sheet footer overrides with one authoritative finishing layer.
• Confirmed the remaining light band under the primary action was the iPhone bottom safe-area itself, not a hidden browser bar or an extra modal container.
• The full gesture-safe inset is still reserved. It is now rendered as a continuous action-dock surface with a subtle Trip-accent wash instead of an empty white strip.
• Sheet body, footer and modal card now share one surface model; footer backdrop blur / shadow layers that visually split the bottom area were removed.
• Content-driven compact / medium / large sheet ceilings and the v7.7.4.2 action-button hierarchy are preserved.
• No Firestore schema, rules, loader, expense data, or permission behaviour changed.

# v7.7.4.2 · Action Button Harmony + Expense Safe Area Polish

• Audited modal-level action buttons across the App and formalised one hierarchy: primary actions use the active accent colour, destructive actions use iOS red, and utility / secondary actions use neutral glass.
• Expense bottom sheets now keep modal-level actions in one bottom action dock. Close remains the circular X in the header; footer text Close buttons stay suppressed.
• Moved 支出備份 export actions and 支出鎖定 lock / unlock actions into the bottom action dock so compact sheets no longer mix top-body and bottom action placement.
• Normalised sheet CTA geometry to 48px height, 14px radius and full-width/equal-width layouts. Two long backup export actions stack vertically; detail Edit/Delete remain an equal two-column pair.
• Lock uses destructive red; Unlock / Save / Submit / OCR Confirm use the Trip accent; export utility actions use neutral glass.
• Reduced the extra expense footer clearance while preserving safe Home Indicator spacing, and matched footer/card backgrounds so the remaining safe area reads as one continuous sheet instead of a white bar.
• Harmonised non-expense modal CTAs (Trip Import, progress completion and itinerary detail utility actions) to the same height/radius/semantic colour tokens without changing menu rows, Day tabs or inline field controls.
• No Firestore schema, Rules, loader, caching or billing behaviour changes.

# v7.7.4.1 · Sheet Polish + Trip Status Fix

• Expense bottom sheets now use content-driven height instead of forcing every medium sheet to a 72% detent. Short sheets such as 資料備份 and 鎖定旅程 are explicitly compact.
• The sheet backdrop extends into the iOS top safe area to remove the exposed white hairline seen while a sheet is open.
• Removed the duplicate card-level bottom safe-area padding. The sticky footer is now the single owner of the home-indicator inset, eliminating the thick blank band below the full expense form action.
• Long sheets and 完整新增支出 keep their existing maximum detents and internal scrolling; only unused empty height is removed.
• My Trips now derives upcoming / active / completed display status from the Trip start and end dates at runtime. A Trip whose start date is today is therefore shown as 旅程中 even if an older imported Firestore status still says upcoming.
• No Firestore schema, Rules or index changes. Active-Day realtime, I/O diagnostics, warm boot and all Layer 0–3 optimisations are retained.

# v7.7.4.0 · Active Day Realtime / Firestore Read Efficiency

• Returning Firebase trips now seed inactive Day items from the trusted IndexedDB render cache instead of keeping every Day item collection subscribed in realtime.
• Only the currently selected Day keeps a live item listener during normal warm boot. Switching Day is instant from local cache, then that Day is refreshed live in the background.
• A newly seen Day hydrates once from Firestore, and a Trip revision mismatch temporarily performs a full Day-item hydration before automatically returning to active-Day-only realtime.
• Day selection is preserved across scoped Firebase item refreshes, so a live update cannot jump the itinerary back to Day 1.
• This is intentionally a quota-efficiency change with no Firebase schema or Rules change. Existing persistent cache, offline behaviour, operation locks and partial-render logic are retained.
• Expected Birthday Trip steady-state listener count after a warm boot: approximately 9 instead of 14, with inactive Day item documents no longer re-subscribed on every launch. Exact observed reads remain subject to Firestore cache/server behaviour and Firebase billing semantics.

# v7.7.3.3 · Recent Expenses Warm Cache

• 最近支出不再先顯示一張空白 card 再突然彈入資料。
• 支出模組 mount 後會先以固定高度 skeleton 保持 layout 穩定。
• 已登入且有 Persistent IndexedDB cache 時，會用 Firestore `getDocsFromCache()` 讀最近 5 筆作 warm preview。
• Cache only preview 不會建立額外 server request，也不增加 Firebase billing read；原本 realtime listener仍然係 authoritative source。
• Live snapshot 到達後原位替換 preview，避免整張 card 高度由零突然跳大。
• Auth / write throttle、Firestore I/O Audit、Layer 0 至 3、Native Warm Boot 全部保留。

# Travel WebApp — v7.7.3.2

## Phase 2F · Auth Singleton + Profile Write Throttle

This build removes a confirmed no-value Firestore write path found by the v7.7.3.1 I/O audit. No UI/UX behaviour changes.

### 1. Canonical Auth module identity

• The main UI now imports `assets/js/auth-service.js` using the same canonical URL used by dependent services.
• This removes the duplicate ES-module instance previously created by mixing `auth-service.js?v=<APP_VERSION>` with `auth-service.js`.
• Result: one Firebase Auth observer, one subscriber set, one profile-sync decision path per page process.

### 2. User profile heartbeat instead of write-on-every-boot

• `users/{uid}` is no longer updated on every refresh / cold launch solely to refresh `lastSeenAt`.
• Profile sync is now limited to: a genuinely new account/device, a changed Google display name/email/photo, or a 12-hour heartbeat.
• Existing installs are seeded from the remembered signed-in UID so upgrading to this build does not create a one-off migration write.
• The heartbeat marker is local only and does not add any Firebase reads.

### Expected I/O result

• A normal warm refresh or reopen with an unchanged Google profile should show `Writes issued: 0 calls · 0 docs`.
• First login on a new device/account, a Google identity change, or a heartbeat that is due may legitimately show one profile write.

### Scope / safety

• No Firestore Rules changes.
• No Firestore index changes.
• No Trip schema changes.
• No Loader / realtime subscription changes yet; the 74-server-document read footprint remains intentionally unchanged for the next measured optimisation step.

---

# Travel WebApp — v7.7.3.1

## Phase 2F · Firestore I/O Audit Lite

### Observed Firestore activity, with zero extra cloud traffic

• Added a memory-only Firestore observation layer around the existing Firebase modular SDK calls.
• The audit does not issue any additional Firestore read, write, listener, transaction, or background polling request.
• App & Data now shows active / peak listeners, listener subscriptions, snapshot callback count, cache/server documents delivered to listeners, explicit read calls/documents, writes, deletes, and transaction attempts for the current app process.
• The UI explicitly labels these counters as app-observed activity rather than Firebase billing metrics. Firebase Console remains the source of truth for billed reads / writes.
• All counters reset naturally on page reload / app relaunch and are never stored in localStorage, IndexedDB, Firestore, Analytics, or any remote service.

### Coverage

• Existing Firestore imports in Auth, Trip Loader, Trip Catalog, Trip Access, user preferences, member management, import / backup / restore, destination / Team colour settings, operation locks, activity logs, and Expenses now pass through the observation wrapper.
• Snapshot observation separates cache-delivered and server-delivered documents so Phase 2F quota analysis can distinguish local warm boot behaviour from server reconciliation.
• Explicit reads show both request count and returned document count.
• Batched writes count the number of document set/update/delete operations only after a successful commit.
• Transactions count calls and retry attempts; transaction reads and committed document writes are observed without changing transaction semantics.

### Architecture / behaviour

• No Firestore schema change.
• No Firestore Rules change.
• No Firestore indexes change.
• No UI / UX flow change outside the App & Data diagnostic rows.
• Layer 0–3, Native Warm Boot, Temporal Header Harmony, Team / Destination colour logic, offline behaviour, permissions, and Profile Navigation compositor are retained.
• Service Worker shell cache updated to `travel-shell-v7.7.3.1` and now precaches the observation wrapper because core modules depend on it.

## Build QA

• JavaScript syntax validation passed for all modules, inline scripts, and `sw.js`.
• JSON validation passed for `manifest.json`, `firebase.json`, `firestore.indexes.json`, and `trip.json`.
• No duplicate static HTML IDs were found.
• Firestore Rules structural sanity passed.
• `firestore.rules`, `firestore.indexes.json`, and `trip.json` remain unchanged from v7.7.3.0.
• ZIP integrity test passed.

---

# Travel WebApp — v7.7.3.0

## Phase 2F · Performance Lite Diagnostics

### Memory-only instrumentation

• Added a lightweight “效能診斷 · 本次啟動” card under 我的 → App 與資料.
• Records only a few `performance.now()` milestones and integer counters already reached by the normal runtime.
• No additional Firebase reads, Firebase writes, IndexedDB diagnostic writes, localStorage diagnostic logs, background polling or scroll-frame instrumentation are added.
• All diagnostic values reset naturally when the page process restarts.

### Milestones shown

• Visual Boot, App Shell, first Trip paint, Instant Render Cache paint, Google Auth ready, Firebase first data and Firebase server-ready timing.
• Full / partial render counts, Trip Loader callback count and render-cache save scheduling count.
• Navigation type identifies a normal launch versus explicit refresh.

### Scope / deployment

• Diagnostics observe existing code paths only; Firebase, Firestore schema, permissions, Loader data model, render-cache storage format, UI content and navigation behaviour are unchanged.
• Service Worker shell cache updated to `travel-shell-v7.7.3.0`.
• Firestore Rules and indexes are unchanged. No Rules deployment is required.

---

# Travel WebApp — v7.7.2.2

## Phase 2F · Temporal Header Harmony

### Status hierarchy cleanup

• Removed the floating secondary status card from the itinerary header.
• The top-right chip is now the single primary lifecycle indicator: 尚未出發 / Day N / 行程已完成 / 行程日期以外.
• Before departure, the countdown is shown as a lightweight contextual line below the trip date instead of a second card.
• After completion, the duplicate “行程已完成” message is removed; only the softer “多謝自己好好玩返轉” context remains below the date.
• During the trip, no secondary lifecycle note is shown because the Day chip already carries the active context.

### Deterministic warm-boot state

• Replaced imperative `status-square` display toggling with one deterministic `trip-temporal-note` state.
• Warm-boot visual snapshots now preserve the temporal note text/state together with the header chip, preventing the note from appearing or disappearing depending on cache timing.
• The temporal note is restored only for the matching remembered Trip and remains hidden in the Expense view.

### Scope / deployment

• No itinerary data, Firebase schema, permissions, destination / Team colour logic, Layer 3 runtime engine, Expense module or navigation compositor changed.
• Service Worker shell cache updated to `travel-shell-v7.7.2.2`.
• Firestore Rules and indexes are unchanged. No Rules deployment is required.

---

# Travel WebApp — v7.7.2.1

## Phase 2F · Native Warm Boot / Visual State Persistence

### First-paint appearance restore

• Added a tiny synchronous `travel_boot_visual_v1` localStorage snapshot for the active Trip.
• The document head now restores the remembered Trip background, accent colour, Team colours and saved font scale before the first body paint.
• The visual snapshot contains appearance/header hints only; Firestore remains authoritative and IndexedDB remains the complete render cache.
• The stored background is never cleared while the same Trip is being reconciled, so refresh / PWA reopen no longer falls back to the generic pink/generated background before restoring the real one.

### Same-Trip Instant Cache boot

• A remembered Firebase Trip now prefers the IndexedDB render cache even when its Trip ID is the same as bundled `trip.json`.
• This closes the default-colour flash where bundled destination / Team colours painted first and Firebase custom colours replaced them about a second later.
• A warm same-Trip boot keeps the itinerary views hidden until the cached Trip is ready, then reveals the correct state atomically instead of visibly rebuilding the page.
• The generic “正在載入上次旅程…” card is suppressed for a trusted same-Trip warm boot; it remains available when switching to a different remembered/deep-linked Trip.
• The last rendered header title/date/status hint is reused during the short cache bootstrap window so the top of the app does not jump back to generic placeholders.

### Warm-boot path acceleration

• Added a module preload hint for `trip-render-cache-service.js`, which is the first module required by pre-auth warm boot.
• Saved font scale is now applied in the head alongside Light / Dark Mode, preventing a visible text-size resize after first paint.
• The existing Layer 3 partial-render, Firebase dirty-section and batched IndexedDB logic is unchanged.

### Scope / deployment

• No Firestore schema, permissions, itinerary UI, destination / Team colour logic, navigation compositor or Expense behaviour changed.
• Service Worker shell cache updated to `travel-shell-v7.7.2.1`.
• Firestore Rules and indexes are unchanged. No Rules deployment is required.

---

# Travel WebApp — v7.7.2.0

## Phase 2F Harmony · Layer 3 Runtime Slimming

### Firestore live-loader coalescing

• Replaced whole-Trip `JSON.stringify()` duplicate detection with source-level dirty tracking.
• Collection listeners now apply Firestore `docChanges()` incrementally instead of rebuilding every Day / Item / Saved Place map on metadata-only callbacks.
• Audit-only and metadata-only snapshots no longer rebuild Portable JSON or trigger an application render.
• Cache → server metadata transitions emit a lightweight diagnostics event instead of a second full Trip payload.
• Real content changes from Trip, Days, Day Items, Saved Places, General Settings and Expense Settings are coalesced into one 120 ms UI commit with scoped `dirtySections`.

### Section-level render invalidation

• Split runtime render signatures into itinerary, Saved Places, Travel Info, Weather, visual theme, expense settings, destination colour and Team colour sections.
• Saved Place-only changes redraw Saved Places only.
• Travel Info / hotel-only changes redraw the 資料 view only.
• Weather coordinate / weather-setting changes refresh Weather only.
• Expense-setting changes no longer rebuild itinerary DOM.
• Destination / Team colour changes keep the existing in-place colour refresh path.
• Team label/member changes still rebuild the relevant itinerary / Travel Info UI; Team colour alone does not.
• Background / accent changes use the visual-theme path without forcing itinerary reconstruction when content is unchanged.

### Trip Library redraw slimming

• Added a compact Trip Library summary signature based only on fields that actually affect the My Trips / quick-switch summary.
• Item note/detail edits no longer revalidate the whole Portable Trip and redraw My Trips when title, dates, icon and item/day counts are unchanged.
• Loader source changes such as Firebase cache → server still update the source pill correctly.

### Render-cache write batching

• IndexedDB render-cache writes are debounced and coalesced; repeated Firestore callbacks for the same Trip keep only the latest complete state.
• Multiple pending Trip writes share one IndexedDB write transaction where possible.
• The IndexedDB connection is reused during the page session instead of open → write → prune → close on every callback.
• Pending cache writes flush when the app becomes hidden / pagehide, reducing the chance of losing the newest warm-boot state on quit.
• Render cache remains acceleration only; Firestore is unchanged as the authoritative source of truth.

### Behaviour retained

• No UI redesign, navigation timing, Day/Team ordering, permission model, Firestore schema or expense transaction model changed.
• Layer 0 + 1 Service Worker / first-paint optimisation, Layer 2 scroll-frame optimisation and v7.7.1.3 Appearance Menu Harmony are retained.
• Service Worker shell cache updated to `travel-shell-v7.7.2.0`.
• Firestore Rules and indexes are unchanged. No Rules deployment is required.

---

# Travel WebApp — v7.7.1.3

## Phase 2F Harmony · Appearance Menu Harmony

### Shared Settings row system

• Rebuilt **外觀與顯示** on the same `profile-menu-card` / `profile-row` system used by **我的旅程** and **旅程設定**.
• **文字大小**, **顯示模式**, **目的地顏色** and **Team 顏色** now share one card geometry, icon column, text inset, hairline separators, edge padding and row spacing.
• Direct controls remain direct controls: the text-size stepper stays inline, while the theme segmented control stays inside its own expanded Settings row.
• Navigation rows retain the standard disclosure chevron and press feedback; direct-control rows do not flash the whole row when the embedded control is touched.
• Team colour remains visible but disabled when the current Trip has no Team data.

### Scope

• UI hierarchy only. No destination colour, Team colour, Firebase, ordering, permission, itinerary, expense or navigation-compositor behaviour changed.
• Layer 0 + 1 Service Worker / first-paint work and Layer 2 scroll-frame optimisations are retained unchanged apart from the required version bump.

### Deployment

• Service Worker shell cache updated to `travel-shell-v7.7.1.3`.
• Firestore Rules and indexes are unchanged. No Rules deployment is required.

---

# Travel WebApp — v7.7.1.2

## Phase 2F Harmony · Appearance settings consolidation

### Appearance information architecture

• Merged the direct appearance controls and colour navigation rows into one Liquid Glass Settings card under **外觀與顯示**.
• **文字大小**, **顯示模式**, **目的地顏色** and **Team 顏色** now read as one coherent settings group instead of two visually separate menus.
• No destination / Team colour behaviour, Firebase data, ordering, permission or detail-page logic changed.
• Team colour remains visible but disabled when the current Trip has no Team data.

### Deployment

• Service Worker shell cache updated to `travel-shell-v7.7.1.2` for the cache-first navigation model.
• Firestore Rules and indexes are unchanged. No Rules deployment is required.

---

# Travel WebApp — v7.7.1.1

## Phase 2F Harmony · Team identity + Appearance colour settings

### Team ordering

• Team display order now follows Team `label` alphabetically, with numeric-aware Traditional Chinese / English collation.
• `sortOrder` is no longer a Team display source of truth. Portable traveller normalisation removes the short-lived v7.7.1.0 Team `sortOrder` field so JSON ↔ Firebase round trips cannot create a competing order.
• Team selector, Travel Details Team cards and Flight Team sections use the same label-derived order.

### Team colour settings

• Added **外觀與顯示 → Team 顏色** using the same iOS-safe palette / native colour-picker behaviour as destination colours.
• Team colours are stored in Firebase `settings/general.travellers.{teamKey}.color` and remain part of Portable JSON / backup data.
• Team colour changes update Team selector, flight labels, itinerary accent stripes, Team badges and Travel Details cards.
• Pure Team colour changes use in-place visual refresh instead of full Trip redraw, preserving the smoother no-flash update path.
• Team 1 / Team 2 legacy defaults remain blue / orange when no explicit colour is stored; other Team defaults are stable and deterministic.
• If the current Trip has no Team data, the **Team 顏色** row remains visible but disabled in the same visual style as **旅程鎖定**.

### Appearance information architecture

• Moved **目的地顏色** out of **旅程設定** and into **外觀與顯示**.
• Destination and Team colour controls now live together under Appearance & Display.
• Destination / Team colour detail pages return to **外觀與顯示**.

### Deployment

• Service Worker shell cache updated to `travel-shell-v7.7.1.1` and the new Team colour service is included as an optional precache module.
• Firestore Rules and indexes are unchanged. No Rules deployment is required.

---

# Travel WebApp — v7.7.1.0

## Phase 2F Harmony & Performance · Layer 2 + deterministic Team ordering

### Team ordering

• `meta.travellers[*].sortOrder` is now the canonical Team display order.
• Portable JSON normalisation assigns a stable `sortOrder` when an older Trip does not have one yet.
• Firebase runtime loader normalises legacy traveller maps so 行程 and 資料 use the same deterministic order.
• Export / backup now carries Team `sortOrder`, so future JSON → Firebase → JSON round trips preserve the order.
• Old Trips remain compatible: if no explicit order exists, their current source order becomes the stable fallback order.

### Layer 2 scroll-frame optimisation

• Removed the unused per-frame `--collapse-progress` CSS custom-property write.
• Cached static header, header child and Day Bar element references instead of querying them every animation frame.
• Reordered collapsing-header work into a read phase followed by a write phase, avoiding style-write → layout-read thrashing while scrolling.
• Resolved the Day Bar sticky top metric once and refresh it only on viewport resize / orientation changes, instead of calling `getComputedStyle()` on every scroll frame.
• UI, animation timing, collapse thresholds and Day Bar sticky behaviour are intentionally unchanged.

### Layer 0 + 1

• v7.7.0.15 Service Worker resilience, cache-first launch, explicit reload network semantics, deferred Expenses stylesheet and resource hints are retained unchanged apart from the required version bump.

### Deployment

• Service Worker shell cache updated to `travel-shell-v7.7.1.0`.
• Firestore Rules and indexes are unchanged. No Rules deployment is required.

---

# Travel WebApp — v7.7.0.15

## Phase 2F · Layer 0 + 1 resilience polish

### Service Worker install hardening

• Split App Shell precache into critical and optional groups.
• Critical shell assets are now transactional: if any required file cannot be fetched, the new Service Worker does not activate, so the last known-good worker and cache remain in control.
• Optional modules and gallery assets remain best-effort; one missing optional file cannot abort the whole install.
• Cache canonicalisation now removes only the `v` cache-buster instead of deleting the entire query string. Future semantic query parameters therefore remain part of the cache identity.
• Normal navigation remains cache-first with background revalidation. Explicit reload / pull-to-refresh remains network-first.
• Offline + uncached requests continue to surface the real network failure rather than resolving to an invalid undefined response.

### Layer 0 + 1 behaviour retained from v7.7.0.14

• `expenses.css` stays non-render-blocking at boot and is activated before the Expense view mounts.
• Firebase / Google resource hints remain enabled.
• `bg_trip_mobile.webp` remains part of the offline shell.
• Removed stale source comment that described the Service Worker as network-only.

### Package and Firebase

• App / manifest / Service Worker version references updated to v7.7.0.15.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required.

## Build QA

• JavaScript syntax, inline JavaScript, JSON validity, duplicate static IDs, Service Worker precache paths, Firestore Rules structural sanity, ZIP integrity and byte-identity of untouched files checked.
• Protected v7.3.13 Profile Navigation compositor source remains unchanged from v7.7.0.14.

---

# Travel WebApp — v7.7.0.14

## Phase 2F Cold-Start Pass (Layer 0 + Layer 1)

Internal only. No UI change, no UX change, no feature change, no Firestore
schema change, no permission model change, no navigation compositor change.
Three files touched: `sw.js`, `index.html`, `manifest.json`.

### 1. Service Worker precache was silently dead (correctness fix)

• `CORE_ASSETS` stored bare paths such as `./assets/js/trip-loader-service.js`, but every real request carried `?v=<APP_VERSION>`.
• `caches.match(request)` counts the query string by default, so **every precached file missed on every request** and the entire precache had been unused since cache busting was introduced.
• Same-origin requests are now normalised to a search-stripped cache key for both reads and writes. The `?v=` buster still forces a genuine network fetch when the app version changes, but it no longer fragments or bypasses the cache.
• Writes use the same normalised key, so repeated versions cannot accumulate duplicate cache entries.
• `install` now puts each asset individually instead of `cache.addAll()`, so one unavailable optional asset can no longer abort the whole precache.

### 2. Navigation changed from network-first to cache-first

• Previously every launch waited for a 433KB `index.html` over the network before the first paint, which cancelled out the IndexedDB instant cache entirely.
• Normal launches are now served from the shell cache immediately, with a background revalidate so the next launch already holds the newer build.
• **A forced reload keeps network-first semantics.** `下拉更新行程` and the refresh button issue a reload-mode navigation, which is detected and routed to the network first. Pull to refresh behaves exactly as before.
• Offline navigation still falls back to the cached shell. An offline request with no cache entry now surfaces the real network failure instead of resolving with `undefined`.

### 3. Cache-blocking meta tags removed

• `Cache-Control: no-cache, no-store, must-revalidate`, `Pragma` and `Expires` were removed from `<head>`.
• They forced every cold start back onto the network and directly contradicted the Service Worker shell strategy. Freshness is now owned by `SW_VERSION` plus the `?v=` cache busters.

### 4. `expenses.css` is no longer render-blocking

• 144KB of CSS was blocking the itinerary's first paint even though every rule is scoped under `.expenses-module` and the matching JavaScript module is lazily imported.
• First-paint CSS drops from roughly 315KB to roughly 171KB, a 46% reduction, with no change to the inline stylesheet.
• The link now starts as `media="print"`, so the browser still downloads it in parallel at low priority but never blocks paint or costs a style recalculation during boot.
• `ensureExpensesStylesheet()` flips it to `media="all"` and waits for it **before** the 支出 view mounts, so expenses markup can never render unstyled. Second and later opens mount synchronously.
• A failed or stalled stylesheet can never leave a dead 支出 tab: the gate falls through on `error` and on a 3 second timeout.
• A `<noscript>` fallback keeps the stylesheet fully blocking when JavaScript is unavailable.

### 5. Resource hints added

• The app makes 17 dynamic imports to `www.gstatic.com` and had zero resource hints, so the first Firebase import paid a full DNS plus TLS handshake.
• Added `preconnect` for `www.gstatic.com` and `firestore.googleapis.com`, and `dns-prefetch` for `identitytoolkit.googleapis.com` and `api.open-meteo.com`.

### 6. Offline shell completeness

• `assets/bg/bg_trip_mobile.webp` (176KB) is now precached. It is the largest and most visible asset and had been missing from the offline shell, while a 70KB airline logo was already included.

### Package and Firebase

• Service Worker shell cache updated to `travel-shell-v7.7.0.14`.
• Manifest, stylesheet and Service Worker cache-buster query strings updated to v7.7.0.14.
• Firestore Rules unchanged. Firestore indexes unchanged. No Firebase Rules redeploy required.
• `expenses-module.js`, `expenses.css` and every service under `assets/js/` are byte-identical to v7.7.0.13.

## Build QA

• 10 Service Worker behaviour tests pass: versioned asset cache hit, versioned stylesheet cache hit, cache-first navigation, background revalidate, forced-reload network-first, no duplicate cache entries, cross-origin passthrough, offline shell fallback, uncached network fallthrough, offline-and-uncached rejection.
• 7 stylesheet gate tests pass: no boot-time media flip, no unstyled mount, instant mount when already loaded, synchronous re-open, error fallthrough, stall timeout, missing-element fallthrough.
• Both `index.html` script blocks and `sw.js` pass syntax validation.
• `index.html` diff versus v7.7.0.13: 48 lines added, 10 removed, of which the majority are comments and version strings.

### Verification checklist after deploy

1. Open DevTools, Application, Service Workers and confirm `travel-shell-v7.7.0.14` is active, then Cache Storage should show entries **without** `?v=` suffixes.
2. Hard reload once, then close and relaunch. The second launch should paint the shell with no network request for `index.html` on the critical path.
3. Network tab: `expenses.css` should show priority Lowest and must not appear as render-blocking.
4. Tap 支出 and confirm the module renders fully styled on first open, including dark mode.
5. Pull to refresh on the itinerary and confirm `index.html` is fetched from the network.
6. Switch to airplane mode and relaunch. The shell, the background image and the itinerary from the render cache should all still appear.

---

# Travel WebApp — v7.7.0.13

## Phase 2F current build

### Trip Settings Menu Visual Parity

• `我的 → 旅程設定` now uses the exact same inset grouped menu shell as the root `我的旅程 / 外觀與顯示 / 旅程設定 / App 與資料` menu.
• Removed the generic card padding around the six Trip Settings rows. Icon alignment, row height, text inset, separators, press feedback, chevrons and rounded card clipping now come from the same `profile-menu-card` component as the preferred root menu.
• No navigation compositor code was changed.

### Smooth Firebase Live Update / Background Stability

• Fixed the full-screen background visibly flashing whenever a same-Trip Firebase update arrived, including Destination Colour saves.
• Root cause: every full render reset `--trip-bg-source` to a generated fallback gradient before asynchronously loading the same trip background image again. Glass cards therefore briefly recomposited against a different backdrop.
• Same-Trip updates with the same background now leave the existing decoded background untouched. When the actual Trip background changes, the next image is preloaded and swapped atomically instead of showing a fallback in between.
• Destination colour-only Firestore updates no longer rebuild the whole itinerary page. Colour identity is refreshed in place across Day pills, multi-city gradients, city badges and Weather destination pills.
• Weather data is no longer refetched merely because a destination colour changed.
• Other structural Firebase updates may still re-render affected app content, but the fixed background remains stable throughout instead of flashing.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.13.
• Corrected stale manifest / stylesheet / Service Worker cache-buster query strings to v7.7.0.13.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• JavaScript syntax, JSON validity, duplicate static IDs, Firestore Rules structural sanity, and ZIP integrity checked.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.12.
• The protected v7.3.13 Profile Navigation compositor source is unchanged from the v7.7.0.12 baseline.

---

# Travel WebApp — v7.7.0.12

## Phase 2F current build

### iOS Native Custom Colour Picker Stability Fix

• Fixed the Destination Colour “自訂顏色” native iOS colour picker closing as soon as the user touched or adjusted a colour value.
• Root cause: the colour `change` event saved to Firebase and immediately rebuilt the Destination Settings DOM. Replacing the active `<input type="color">` node causes iOS Safari / standalone PWA to dismiss the system colour picker.
• Custom colour changes now update the preview locally and persist to Firebase without replacing the active colour input while the native picker interaction is in progress.
• Firestore live refreshes are prevented from rebuilding the Destination Settings list while the native colour picker is the active editor.
• Preset swatches and “還原預設” continue to use the normal immediate re-render path.
• Destination colour data model, Day gradients, multi-city order, Firebase schema, and Profile Navigation compositor are unchanged.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.12.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• JavaScript syntax, JSON validity, duplicate static IDs, Firestore Rules structural sanity, and ZIP integrity checked.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.11.
• The protected v7.3.13 Profile Navigation compositor source is unchanged from the v7.7.0.11 baseline.

---

# Travel WebApp — v7.7.0.11

## Phase 2F current build

### Destination Colour Palette iOS Scroll / Ring Fix

• Fixed the selected colour swatch outer ring being clipped at the left / right or bottom edge of the palette.
• Added dedicated safe padding around the swatch strip so the `inset: -4px` selected ring always has room to render inside the palette viewport.
• Fixed an iOS Safari overflow interaction where a palette intended to scroll horizontally could also acquire a tiny vertical scroll range. This could leave a row visually shifted so the upper half of its colour circles appeared cut off.
• The palette now explicitly uses horizontal scrolling only (`overflow-x: auto`, `overflow-y: hidden`) and blocks internal vertical overscroll while the Profile page itself remains normally vertically scrollable.
• No destination colour data, Firebase schema, Day gradient logic, or Profile Navigation animation logic changed.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.11.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• JavaScript syntax, JSON validity, duplicate static IDs, Firestore Rules structural sanity, and ZIP integrity checked.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.10.
• The protected v7.3.13 Profile Navigation compositor source is byte for byte unchanged from the v7.7.0.10 baseline.

---

# Travel WebApp — v7.7.0.10

## Phase 2F current build

### Multi City Order Preservation

• Ordered `day.cities` is now preserved by the Portable JSON → Firestore import plan instead of being dropped from Day documents.
• A multi city Day such as `cities: ["kyoto", "osaka"]` therefore remains Kyoto → Osaka after Import, Replace, Loader, Snapshot and later JSON export.
• Runtime rendering treats ordered `day.cities` as authoritative for Day colour gradients and city badges.
• Older Firebase Trips created before this fix may not have `day.cities`. For those rows, the UI uses destination date windows as a deterministic compatibility fallback, sorted by destination start date, so the bundled Birthday Trip transition day returns to Kyoto → Osaka rather than depending on Firestore map order.
• General destination lists now follow itinerary first appearance rather than raw object / Firestore map ordering. This order is used by Weather, Day rendering and Travel Details.
• Destination manual reorder is intentionally not added to Settings. Overall order is derived from itinerary; per Day direction stays itinerary data.

### Destination Colour Settings

• Added `我的 → 旅程設定 → 目的地顏色`.
• Owner and Admin can choose a preset colour, use the native custom colour picker, or restore the default colour for each destination.
• Destination colour changes are written directly to Firebase `trips/{tripId}/settings/general` inside `cities.{cityKey}.color` and are therefore shared across devices.
• Viewer and Member can open the page in read only mode but cannot modify colours.
• Explicit Firebase / JSON destination colours now override the legacy Kyoto / Osaka / Kobe defaults, allowing those original destinations to be customised too.
• One destination colour identity is reused across the active Day pill, Day heading city badge, Weather active pill, and future compatible city UI.
• Multi city Day gradients are generated at render time from the ordered Day destination list and each destination colour. The gradient itself is not stored as separate data.
• Custom colours are automatically converted into matching Light Mode and Dark Mode variants.
• Destination colour changes are recorded in Trip Activity Log.

### Firebase and Portable JSON Contract

• Firebase remains the runtime source of truth. Destination colour Settings do not edit the bundled JSON file directly.
• Current Trip and Snapshot JSON exports carry the complete `cities` map, including any saved `color` values.
• Backup export parity was tightened to also retain `tripIcon`, `backgroundImage`, legacy `outbound` / `inbound`, `airlineLogo`, and `weather` metadata already supported by the Loader and Import schema.

### Package and Firebase

• Added `trip-destination-service.js` to the App Shell cache.
• Service Worker shell cache updated to v7.7.0.10.
• Firestore Rules are unchanged because existing `settings/{settingId}` manager write permissions already cover Owner / Admin destination settings.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• JavaScript syntax, JSON validity, duplicate static IDs, Firestore Rules structural sanity, ordered Day schema preservation, and ZIP integrity checked.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.9.
• The protected v7.3.13 Profile Navigation compositor source is byte for byte unchanged from the validated v7.7.0.9 baseline.

---

# Travel WebApp — v7.7.0.9

## Phase 2F current build

### Weather Destination Pill State Parity

• Weather destination pills now use the same selection logic as the Day tabs.
• Unselected destinations now use the same neutral Liquid Glass shell as unselected Day tabs in Light Mode instead of carrying a soft version of their destination colour.
• Only the selected destination shows its own identity colour: Kyoto green, Osaka coral / red, Kobe purple, and imported cities use their assigned or deterministic city colour.
• Dark Mode and Auto Dark Mode follow the same Day-tab state rule and neutral glass treatment: neutral unselected pills, destination-coloured selected pill.
• The coloured city badge beside each day heading remains unchanged, so destination identity is still visible in the itinerary heading.
• Weather switching behaviour, city-specific weather cache, request race protection, and generic imported-city support remain unchanged.
• No re-import is required; this is a render-only UX correction.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.9.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• JavaScript syntax, JSON validity, duplicate static IDs, Firestore Rules structural sanity, and ZIP integrity checked.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.8.
• The protected v7.3.13 Profile Navigation compositor source is unchanged from the v7.7.0.8 baseline.

---

# Travel WebApp — v7.7.0.8

## Phase 2F current build

### Destination Colour Identity Restoration

• Fixed the regression introduced by v7.7.0.7 where every selected Weather city pill used the same generic iOS blue colour.
• Restored the original destination identity colours for the bundled trip: Kyoto remains green, Osaka remains coral/red, and Kobe remains purple.
• The same destination colour is now reused consistently across three UI surfaces: Weather city pills, the active Day pill, and the city badge beside the day heading.
• Weather city pills now remain softly tinted by destination even when not selected; the active city uses the stronger version of that same destination colour.
• Removed the old limitation where only hard coded `kyoto`, `osaka`, and `kobe` CSS classes could display coloured Day badges. Any city key imported through `meta.cities` now receives a stable destination colour.
• Imported trips without explicit city colours receive a deterministic palette based on the city key, so Tokyo and Yokohama in the Phase 2F QA demo display as distinct coloured pills instead of plain text / colourless badges.
• Optional future city metadata fields `color`, `accentColor`, or `themeColor` are supported when a six digit hex colour is supplied. If present, the UI derives the light and dark destination theme from that accent.
• Multi city days continue to use a gradient Day pill assembled from the actual colours of the cities assigned to that day.
• No re import is required. Existing Firebase trips are recoloured at render time from their current `meta.cities` data.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.8.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• `node --check` passed for every JavaScript module, both inline scripts, and `sw.js`.
• JSON validation passed for `manifest.json`, `firebase.json`, `firestore.indexes.json`, and `trip.json`.
• No duplicate static HTML IDs were found.
• Firestore Rules structural sanity passed.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.7.
• The protected v7.3.13 Profile Navigation compositor source is unchanged from the validated v7.7.0.7 baseline.
• ZIP integrity test passed.

---

# Travel WebApp — v7.7.0.7

## Phase 2F current build

### Weather City Selector UX Fix

• Replaced hard coded weather selector active classes for Kyoto, Osaka, and Kobe with one generic active state that works for every city key imported through `meta.cities`.
• The selected weather city now receives an obvious iOS blue active pill in Light Mode, Auto Dark Mode, and explicit Dark Mode.
• Weather city pills now expose `aria-pressed` state and a city specific accessibility label.
• Tapping another city updates the selected pill immediately, recentres that pill when necessary, then loads that city's cached or live weather.
• The weather summary now prefixes the selected city name, for example `橫濱｜今日（08/14）`, so similar forecasts cannot make the switch look ineffective.
• Loading and error states also carry the selected city name.
• Added a request selection token so an older, slower weather response cannot overwrite the city the user selected more recently.
• Weather city tabs can horizontally scroll when a Trip has more destinations, without showing a scrollbar.

### Metadata QA Result

• The Phase 2F metadata demo successfully displayed both imported cities and the structured flight card in v7.7.0.6.
• The Firebase export retained `cities`, `flights`, `hotels`, `infoCard`, `galleryDefaults`, itinerary location coordinates, and saved place metadata.
• This confirms the current Import → Firestore → Loader → Export metadata path preserves the tested structured fields. The older Hokkaido JSON is missing its own `meta.cities` and `meta.flights`, rather than those fields being dropped by the current pipeline.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.7.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• `node --check` passed for every JavaScript module, both inline scripts, and `sw.js`.
• JSON validation passed for `manifest.json`, `firebase.json`, `firestore.indexes.json`, and `trip.json`.
• No duplicate static HTML IDs were found.
• Firestore Rules structural sanity passed.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.6.
• The protected v7.3.13 Profile Navigation compositor source is unchanged by this release; the v7.7.0.7 source diff is limited to weather selector UX, build version references, Service Worker cache version, manifest start URL, and this changelog.
• ZIP integrity test passed.

---

# Travel WebApp — v7.7.0.6

## Phase 2F current build

### Multi Trip Zero Wait Warm Boot

• v7.7.0.5 still had a visible short loading pause because the app waited for Firebase Auth restoration before it was allowed to read the uid bound render cache.
• v7.7.0.6 stores only the last authenticated Firebase UID as a local cache namespace hint on the trusted device.
• When the remembered active Trip differs from bundled trip.json, the app can now read that user's existing IndexedDB Trip render cache immediately after trip.json bootstrap, before the Firebase Auth callback completes.
• Firebase Auth still verifies the actual session immediately afterwards and Firestore remains the authoritative source of truth.
• If Auth resolves signed out, or the Trip later returns permission denied / not found, the existing fallback and cache invalidation paths still take over.
• Explicit Google sign out clears the remembered UID hint, so a signed out launch will not use the pre auth warm cache path.
• The normal v7.7.0.5 auth bound cache bootstrap remains as a second path when no trusted device hint is available.

Expected repeat launch UX after one successful v7.7.0.6 Firebase load:

`App open → remembered Trip cache paint → Auth verification + Firestore sync in background`

The first launch after upgrading may still need one normal authenticated load before the UID hint and latest Trip cache are available.

### Destination Weather Loading Fix

• Fixed a Firebase Trip weather UI bug where `meta.cities = {}` and `meta.weather = {}` were treated as valid weather configuration because empty objects are truthy in JavaScript.
• This caused the weather card to show `載入中… / 正在取得今日天氣…` forever even though no request could be started.
• Trips with no weather configuration now hide the weather card instead of displaying an endless loading state.
• Trips that declare a city/weather object but do not contain valid latitude and longitude now show a clear `未設定` state instead of spinning forever.
• Weather fetch now validates coordinates, checks HTTP status, and times out after 8 seconds instead of being allowed to hang indefinitely.
• Successful Open Meteo responses are cached locally for 30 minutes, so refresh / reopen can display recent weather immediately without waiting for another network request.
• Weather request cache keys now include latitude, longitude, and timezone, preventing data from one Trip or city being reused under another Trip merely because the city key is the same.
• Weather render signatures now include both `meta.cities` and legacy `meta.weather`, so Firebase weather metadata changes trigger a redraw correctly.

### Package and Firebase

• Service Worker shell cache updated to v7.7.0.6.
• Firestore Rules are unchanged.
• Firestore indexes are unchanged.
• No Firebase Rules redeploy is required for this build.
• Package continues to keep only one development document: CHANGELOG.md.

## Build QA

• `node --check` passed for every JavaScript module, both inline scripts, and `sw.js`.
• JSON validation passed for `manifest.json`, `firebase.json`, `firestore.indexes.json`, and `trip.json`.
• No duplicate static HTML IDs were found.
• Firestore Rules structural sanity passed.
• `firestore.rules` and `firestore.indexes.json` are byte for byte unchanged from v7.7.0.5.
• The protected v7.3.13 Profile Navigation compositor source is byte for byte unchanged from the validated v7.7.0.5 baseline, preserving protected SHA256 `15cef32014cf89aee69e344a101f5027344507b62d8738ed1355103140bfea0f`.
• ZIP integrity test passed.
