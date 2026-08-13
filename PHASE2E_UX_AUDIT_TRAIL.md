# Phase 2E v7.6.1 — Progress & Audit Trail

## Blocking progress
Import and Snapshot Restore now use one full-screen progress surface with a visible percentage, current stage, and processed-operation count. The overlay blocks repeated writes and trip switching until the operation finishes.

## Trip-wide operation record
Operation records now live under My > Trip Settings > Operation Records. The page combines itinerary/import, backup/restore, expense, settlement, and future member-permission events. Old log documents are mapped into human-readable titles; new log writers also store actionType, category, title, and summary.

The expense settings page no longer owns the operation-record entry.
