# Phase 2E · Firebase Loader & Multi Trip Sync

Version: 7.6.0

## Purpose

Phase 2E changes the daily runtime source of truth from the bundled `trip.json` to Firestore for authenticated users who are members of a Trip.

The bundled `trip.json` is still kept as a fast, non blocking bootstrap and signed out fallback. It also remains the portable Import / Export format.

## Startup flow

1. Render bundled `trip.json` immediately so Firebase never blocks the first itinerary screen.
2. Restore Google Authentication.
3. Read the signed in user's Active Trip catalog.
4. Resolve the preferred Trip from the deep link / last selected Trip / available cloud Trips.
5. Start Firestore listeners for the selected Trip.
6. Assemble the Trip from Firestore parent, days, items, saved places and settings.
7. Replace the bundled view with cached or server Firestore data only after a complete Trip snapshot is ready.
8. Continue listening for changes and refresh the UI only when Trip content actually changes.

## Firestore listeners

The loader listens to:

* `trips/{tripId}`
* `trips/{tripId}/days`
* `trips/{tripId}/days/{dayId}/items`
* `trips/{tripId}/savedPlaces`
* `trips/{tripId}/settings/general`
* `trips/{tripId}/settings/expenses`

During JSON import or Snapshot restore the loader waits while `importState = importing` or `restoreState = restoring`. This prevents the UI from rendering a half written Trip.

## Local cache

Firestore is initialized with persistent local cache and multi tab support when the browser allows it. If persistent storage is unavailable, the App falls back to Firestore memory cache without blocking startup.

The App & Data screen reports whether the current source is Firebase, Firebase cache, or bundled JSON.

## Multi Trip switching

The top left Trip switcher and `我的 > 我的旅程` can switch between unarchived Firebase Trips in the current user's catalog.

The selected Trip ID is saved locally and added to the URL as `?trip=<tripId>` so refreshes return to the same Trip.

## Import / Restore behavior

When an active Trip is replaced through JSON import, the existing Firestore listeners receive the completed version and refresh the itinerary automatically.

When a Snapshot is restored, the restore service first marks the Trip as restoring, performs the writes, then marks it ready. The loader refreshes the UI only after the final ready state.

## Expenses compatibility

The legacy expense module owns long lived listeners bound to one Trip ID. If it has already been opened and the user switches to another Trip, Phase 2E persists the new active Trip and reloads the shell once so expenses cannot remain attached to the previous Trip. A cleaner hot switch can be introduced when the expense data layer is refactored.

## Not included in this build

* Creating itinerary items directly inside the App
* Google Maps route / Transit integration
* Firebase Storage photo upload
* Full offline App shell caching
* Email invitation and member management UI
* Final Phase 2F Security Rules hardening and regression suite
