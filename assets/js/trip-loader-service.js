import { db } from "./firebase-service.js";
import { normalizeTravellers } from "./trip-schema-service.js";
import {
  collection,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

const AUDIT_KEYS = new Set(["createdAt", "createdBy", "updatedAt", "updatedBy"]);

function clean(value) { return String(value ?? "").trim(); }
function clonePlain(value) {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (!value || typeof value !== "object") return value;
  if (typeof value.toDate === "function" || value.seconds != null) return undefined;
  const output = {};
  Object.entries(value).forEach(([key, next]) => {
    if (AUDIT_KEYS.has(key)) return;
    const cloned = clonePlain(next);
    if (typeof cloned !== "undefined") output[key] = cloned;
  });
  return output;
}
function safeArray(value) { return Array.isArray(value) ? value : []; }
function numberOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function normalizeTimestamp(value) {
  try {
    if (value?.toDate) return value.toDate().toISOString();
    if (value?.seconds != null) return new Date(Number(value.seconds) * 1000).toISOString();
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d.toISOString() : "";
  } catch (error) {
    return "";
  }
}

function assemblePortableTrip(tripId, state) {
  const tripDoc = state.tripDoc || {};
  const general = clonePlain(state.settings.general || {}) || {};
  const expenses = clonePlain(state.settings.expenses || {}) || {};
  const dayDocs = [...state.days.values()]
    .sort((a, b) => numberOr(a.data?.sortOrder) - numberOr(b.data?.sortOrder));

  const days = dayDocs.map(day => {
    const itemMap = state.itemsByDay.get(day.id) || new Map();
    const items = [...itemMap.values()]
      .map(item => ({ ...clonePlain(item.data || {}), itemId: clean(item.data?.itemId || item.id) }))
      .sort((a, b) => numberOr(a.sortOrder) - numberOr(b.sortOrder));
    return {
      ...clonePlain(day.data || {}),
      dayId: clean(day.data?.dayId || day.id),
      items
    };
  });

  const savedPlaces = [...state.savedPlaces.values()]
    .map(place => ({ ...clonePlain(place.data || {}), placeId: clean(place.data?.placeId || place.id) }))
    .sort((a, b) => numberOr(a.sortOrder) - numberOr(b.sortOrder));

  const savedPlacesMeta = general.savedPlacesMeta && typeof general.savedPlacesMeta === "object"
    ? clonePlain(general.savedPlacesMeta)
    : {};

  return {
    schemaVersion: Math.max(2, numberOr(tripDoc.schemaVersion, 2)),
    tripId,
    revision: Math.max(1, numberOr(tripDoc.revision, 1)),
    meta: {
      tripId,
      titleSmall: clean(tripDoc.titleSmall),
      titleMain: clean(tripDoc.titleHtml || tripDoc.title),
      dateRange: clean(tripDoc.dateRange),
      route: clean(tripDoc.route),
      accentColor: clean(tripDoc.accentColor),
      tripStartIso: clean(tripDoc.startDate),
      tripEndIso: clean(tripDoc.endDate),
      status: clean(tripDoc.status),
      coverImage: clean(tripDoc.coverImage),
      tripIcon: clean(tripDoc.tripIcon || general.tripIcon),
      backgroundImage: clean(tripDoc.backgroundImage || general.backgroundImage),
      travellers: normalizeTravellers(clonePlain(general.travellers || {}) || {}),
      cities: clonePlain(general.cities || {}) || {},
      flights: clonePlain(general.flights || []) || [],
      outbound: clonePlain(general.outbound || null) || null,
      inbound: clonePlain(general.inbound || null) || null,
      airlineLogo: clean(general.airlineLogo),
      weather: clonePlain(general.weather || {}) || {},
      hotels: clonePlain(general.hotels || {}) || {},
      infoCard: clonePlain(general.infoCard || {}) || {},
      galleryDefaults: clonePlain(general.galleryDefaults || {}) || {},
      footerNote: clean(general.footerNote),
      expenses
    },
    days,
    snacks: {
      ...(savedPlacesMeta || {}),
      items: savedPlaces
    },
    cloudMeta: {
      source: state.allFromCache() ? "cache" : "server",
      hasPendingWrites: state.hasPendingWrites(),
      updatedAt: normalizeTimestamp(tripDoc.updatedAt),
      importState: clean(tripDoc.importState || "ready"),
      restoreState: clean(tripDoc.restoreState || "ready")
    }
  };
}

export function subscribeTripData(tripIdInput, callback) {
  const tripId = clean(tripIdInput);
  if (!tripId || typeof callback !== "function") return () => {};

  const unsubs = [];
  const itemUnsubs = new Map();
  const sourceMeta = new Map();
  const initial = { trip: false, days: false, saved: false, general: false, expenses: false };
  const itemReady = new Set();
  const state = {
    tripDoc: null,
    days: new Map(),
    itemsByDay: new Map(),
    savedPlaces: new Map(),
    settings: { general: {}, expenses: {} },
    allFromCache() {
      const values = [...sourceMeta.values()];
      return values.length > 0 && values.every(meta => meta.fromCache === true);
    },
    hasPendingWrites() {
      return [...sourceMeta.values()].some(meta => meta.hasPendingWrites === true);
    }
  };

  let stopped = false;
  let lastSignature = "";
  let emitTimer = 0;

  function snapshotMeta(key, snapshot) {
    sourceMeta.set(key, {
      fromCache: snapshot?.metadata?.fromCache === true,
      hasPendingWrites: snapshot?.metadata?.hasPendingWrites === true
    });
  }

  function readyForEmit() {
    if (!initial.trip || !initial.days || !initial.saved || !initial.general || !initial.expenses) return false;
    for (const dayId of state.days.keys()) {
      if (!itemReady.has(dayId)) return false;
    }
    return true;
  }

  function emitStatus(status, extra = {}) {
    if (stopped) return;
    callback({ status, tripId, ...extra });
  }

  function scheduleEmit(reason = "change") {
    if (stopped || !readyForEmit() || !state.tripDoc) return;
    const importState = clean(state.tripDoc.importState || "ready");
    const restoreState = clean(state.tripDoc.restoreState || "ready");
    if (importState === "importing" || restoreState === "restoring") {
      emitStatus("syncing", {
        reason: importState === "importing" ? "import" : "restore",
        source: state.allFromCache() ? "cache" : "server"
      });
      return;
    }
    if (importState === "failed" || restoreState === "failed") {
      emitStatus("recovery-needed", {
        reason: importState === "failed" ? "import" : "restore",
        source: state.allFromCache() ? "cache" : "server"
      });
      return;
    }
    clearTimeout(emitTimer);
    emitTimer = setTimeout(() => {
      if (stopped || !readyForEmit() || !state.tripDoc) return;
      const data = assemblePortableTrip(tripId, state);
      const signature = JSON.stringify(data);
      if (signature === lastSignature && reason !== "metadata") return;
      lastSignature = signature;
      emitStatus("ready", {
        data,
        source: data.cloudMeta?.source || "server",
        fromCache: data.cloudMeta?.source === "cache",
        hasPendingWrites: data.cloudMeta?.hasPendingWrites === true,
        updatedAt: data.cloudMeta?.updatedAt || ""
      });
    }, 90);
  }

  function stopItemListener(dayId) {
    const stop = itemUnsubs.get(dayId);
    if (stop) {
      try { stop(); } catch (error) {}
      itemUnsubs.delete(dayId);
    }
    itemReady.delete(dayId);
    state.itemsByDay.delete(dayId);
    sourceMeta.delete(`items:${dayId}`);
  }

  function attachItemListener(dayId) {
    if (itemUnsubs.has(dayId)) return;
    state.itemsByDay.set(dayId, new Map());
    const stop = onSnapshot(
      collection(db, "trips", tripId, "days", dayId, "items"),
      { includeMetadataChanges: true },
      snapshot => {
        snapshotMeta(`items:${dayId}`, snapshot);
        const map = new Map();
        snapshot.docs.forEach(itemSnap => map.set(itemSnap.id, { id: itemSnap.id, data: itemSnap.data() || {} }));
        state.itemsByDay.set(dayId, map);
        itemReady.add(dayId);
        scheduleEmit(snapshot.metadata?.fromCache ? "cache" : "items");
      },
      error => emitStatus(error?.code === "permission-denied" ? "permission-denied" : "error", { error })
    );
    itemUnsubs.set(dayId, stop);
  }

  emitStatus("loading", { source: "unknown" });

  unsubs.push(onSnapshot(
    doc(db, "trips", tripId),
    { includeMetadataChanges: true },
    snapshot => {
      snapshotMeta("trip", snapshot);
      initial.trip = true;
      if (!snapshot.exists()) {
        state.tripDoc = null;
        emitStatus("not-found");
        return;
      }
      state.tripDoc = snapshot.data() || {};
      scheduleEmit(snapshot.metadata?.fromCache ? "cache" : "trip");
    },
    error => emitStatus(error?.code === "permission-denied" ? "permission-denied" : "error", { error })
  ));

  unsubs.push(onSnapshot(
    collection(db, "trips", tripId, "days"),
    { includeMetadataChanges: true },
    snapshot => {
      snapshotMeta("days", snapshot);
      initial.days = true;
      const nextDays = new Map();
      snapshot.docs.forEach(daySnap => nextDays.set(daySnap.id, { id: daySnap.id, data: daySnap.data() || {} }));
      [...state.days.keys()].forEach(dayId => {
        if (!nextDays.has(dayId)) stopItemListener(dayId);
      });
      state.days = nextDays;
      nextDays.forEach((_, dayId) => attachItemListener(dayId));
      scheduleEmit(snapshot.metadata?.fromCache ? "cache" : "days");
    },
    error => emitStatus(error?.code === "permission-denied" ? "permission-denied" : "error", { error })
  ));

  unsubs.push(onSnapshot(
    collection(db, "trips", tripId, "savedPlaces"),
    { includeMetadataChanges: true },
    snapshot => {
      snapshotMeta("saved", snapshot);
      initial.saved = true;
      const map = new Map();
      snapshot.docs.forEach(placeSnap => map.set(placeSnap.id, { id: placeSnap.id, data: placeSnap.data() || {} }));
      state.savedPlaces = map;
      scheduleEmit(snapshot.metadata?.fromCache ? "cache" : "saved");
    },
    error => emitStatus(error?.code === "permission-denied" ? "permission-denied" : "error", { error })
  ));

  ["general", "expenses"].forEach(settingId => {
    unsubs.push(onSnapshot(
      doc(db, "trips", tripId, "settings", settingId),
      { includeMetadataChanges: true },
      snapshot => {
        snapshotMeta(`settings:${settingId}`, snapshot);
        initial[settingId] = true;
        state.settings[settingId] = snapshot.exists() ? snapshot.data() || {} : {};
        scheduleEmit(snapshot.metadata?.fromCache ? "cache" : `settings:${settingId}`);
      },
      error => emitStatus(error?.code === "permission-denied" ? "permission-denied" : "error", { error })
    ));
  });

  return () => {
    stopped = true;
    clearTimeout(emitTimer);
    unsubs.forEach(stop => { try { stop(); } catch (error) {} });
    itemUnsubs.forEach(stop => { try { stop(); } catch (error) {} });
    itemUnsubs.clear();
  };
}
