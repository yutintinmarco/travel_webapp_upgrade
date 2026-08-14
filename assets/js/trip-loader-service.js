import { db } from "./firebase-service.js";
import { normalizeTravellers } from "./trip-schema-service.js";
import {
  collection,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

const AUDIT_KEYS = new Set(["createdAt", "createdBy", "updatedAt", "updatedBy"]);
const EMIT_DEBOUNCE_MS = 120;

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
function contentSignature(value) {
  try { return JSON.stringify(clonePlain(value) || {}); }
  catch (error) { return ""; }
}
function changedTopLevelKeys(previous, next) {
  const a = clonePlain(previous || {}) || {};
  const b = clonePlain(next || {}) || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter(key => contentSignature(a[key]) !== contentSignature(b[key]));
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
  const documentSignatures = new Map();
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
  let emitTimer = 0;
  let firstReadyEmitted = false;
  let lastMetadataState = "";
  const dirtySections = new Set();

  function snapshotMeta(key, snapshot) {
    const next = {
      fromCache: snapshot?.metadata?.fromCache === true,
      hasPendingWrites: snapshot?.metadata?.hasPendingWrites === true
    };
    const prev = sourceMeta.get(key);
    sourceMeta.set(key, next);
    return !prev || prev.fromCache !== next.fromCache || prev.hasPendingWrites !== next.hasPendingWrites;
  }

  function markDirty(...sections) {
    sections.flat().filter(Boolean).forEach(section => dirtySections.add(String(section)));
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

  function currentMetadataState() {
    return `${state.allFromCache() ? "cache" : "server"}|${state.hasPendingWrites() ? "pending" : "clean"}`;
  }

  function scheduleEmit(reason = "change", sections = []) {
    markDirty(sections);
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

      const metadataState = currentMetadataState();
      const sectionsNow = [...dirtySections];
      dirtySections.clear();

      // Metadata-only cache → server transitions are common with
      // includeMetadataChanges. They should update diagnostics, not rebuild and
      // stringify the whole portable Trip or trigger an app render/cache write.
      if (firstReadyEmitted && sectionsNow.length === 0) {
        if (metadataState !== lastMetadataState) {
          lastMetadataState = metadataState;
          emitStatus("metadata", {
            source: state.allFromCache() ? "cache" : "server",
            fromCache: state.allFromCache(),
            hasPendingWrites: state.hasPendingWrites(),
            reason
          });
        }
        return;
      }

      const data = assemblePortableTrip(tripId, state);
      firstReadyEmitted = true;
      lastMetadataState = metadataState;
      emitStatus("ready", {
        data,
        dirtySections: sectionsNow.length ? sectionsNow : ["initial"],
        reason,
        source: data.cloudMeta?.source || "server",
        fromCache: data.cloudMeta?.source === "cache",
        hasPendingWrites: data.cloudMeta?.hasPendingWrites === true,
        updatedAt: data.cloudMeta?.updatedAt || ""
      });
    }, EMIT_DEBOUNCE_MS);
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

  function applyCollectionChanges(snapshot, targetMap, { idField = "", section = "" } = {}) {
    let contentChanged = false;
    const changes = snapshot.docChanges();
    changes.forEach(change => {
      const id = change.doc.id;
      if (change.type === "removed") {
        if (targetMap.delete(id)) contentChanged = true;
        return;
      }
      const data = change.doc.data() || {};
      const sig = contentSignature(data);
      const prev = targetMap.get(id);
      if (!prev || prev.signature !== sig) contentChanged = true;
      targetMap.set(id, { id, data, signature: sig, idField });
    });
    if (contentChanged && section) markDirty(section);
    return contentChanged;
  }

  function attachItemListener(dayId) {
    if (itemUnsubs.has(dayId)) return;
    state.itemsByDay.set(dayId, new Map());
    const stop = onSnapshot(
      collection(db, "trips", tripId, "days", dayId, "items"),
      { includeMetadataChanges: true },
      snapshot => {
        snapshotMeta(`items:${dayId}`, snapshot);
        const map = state.itemsByDay.get(dayId) || new Map();
        const changed = applyCollectionChanges(snapshot, map, { section: `items:${dayId}` });
        state.itemsByDay.set(dayId, map);
        itemReady.add(dayId);
        scheduleEmit(snapshot.metadata?.fromCache ? "cache" : "items", changed ? [`items:${dayId}`] : []);
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
      const next = snapshot.data() || {};
      const sig = contentSignature(next);
      const hadPrevious = documentSignatures.has("trip");
      const changed = documentSignatures.get("trip") !== sig;
      const previous = state.tripDoc;
      documentSignatures.set("trip", sig);
      state.tripDoc = next;
      const sections = changed ? (hadPrevious ? changedTopLevelKeys(previous, next).map(key => `trip:${key}`) : ["trip"]) : [];
      scheduleEmit(snapshot.metadata?.fromCache ? "cache" : "trip", sections.length ? sections : (changed ? ["trip"] : []));
    },
    error => emitStatus(error?.code === "permission-denied" ? "permission-denied" : "error", { error })
  ));

  unsubs.push(onSnapshot(
    collection(db, "trips", tripId, "days"),
    { includeMetadataChanges: true },
    snapshot => {
      snapshotMeta("days", snapshot);
      initial.days = true;
      const changes = snapshot.docChanges();
      let changed = false;
      changes.forEach(change => {
        const dayId = change.doc.id;
        if (change.type === "removed") {
          if (state.days.delete(dayId)) changed = true;
          stopItemListener(dayId);
          return;
        }
        const data = change.doc.data() || {};
        const sig = contentSignature(data);
        const prev = state.days.get(dayId);
        if (!prev || prev.signature !== sig) changed = true;
        state.days.set(dayId, { id: dayId, data, signature: sig });
      });
      state.days.forEach((_, dayId) => attachItemListener(dayId));
      scheduleEmit(snapshot.metadata?.fromCache ? "cache" : "days", changed ? ["days"] : []);
    },
    error => emitStatus(error?.code === "permission-denied" ? "permission-denied" : "error", { error })
  ));

  unsubs.push(onSnapshot(
    collection(db, "trips", tripId, "savedPlaces"),
    { includeMetadataChanges: true },
    snapshot => {
      snapshotMeta("saved", snapshot);
      initial.saved = true;
      const changed = applyCollectionChanges(snapshot, state.savedPlaces, { section: "snacks" });
      scheduleEmit(snapshot.metadata?.fromCache ? "cache" : "saved", changed ? ["snacks"] : []);
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
        const next = snapshot.exists() ? snapshot.data() || {} : {};
        const sig = contentSignature(next);
        const key = `settings:${settingId}`;
        const hadPrevious = documentSignatures.has(key);
        const changed = documentSignatures.get(key) !== sig;
        const previous = state.settings[settingId] || {};
        documentSignatures.set(key, sig);
        state.settings[settingId] = next;
        let sections = [];
        if (changed) {
          if (settingId === "general" && hadPrevious) {
            sections = changedTopLevelKeys(previous, next).map(field => `general:${field}`);
          } else {
            sections = [settingId];
          }
        }
        scheduleEmit(snapshot.metadata?.fromCache ? "cache" : key, sections.length ? sections : (changed ? [settingId] : []));
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
    dirtySections.clear();
  };
}
