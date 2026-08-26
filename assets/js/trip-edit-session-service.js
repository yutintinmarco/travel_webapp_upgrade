import { db } from "./firebase-service.js";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp
} from "./firestore-observed-service.js";

const EDITABLE_ITEM_FIELDS = ["time", "title", "note"];
const VALID_ROLES = new Set(["owner", "admin"]);

function clean(value) { return String(value ?? "").trim(); }
function clonePlain(value) {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (!value || typeof value !== "object") return value;
  const output = {};
  Object.entries(value).forEach(([key, next]) => {
    if (typeof next === "undefined") return;
    output[key] = clonePlain(next);
  });
  return output;
}
function itemKey(dayId, itemId) { return `${clean(dayId)}|${clean(itemId)}`; }
function editableSnapshot(item = {}) {
  const out = {};
  EDITABLE_ITEM_FIELDS.forEach(field => { out[field] = clean(item?.[field]); });
  return out;
}
function sameEditable(a = {}, b = {}) {
  return EDITABLE_ITEM_FIELDS.every(field => clean(a?.[field]) === clean(b?.[field]));
}

export function createTripEditSession(tripDataInput) {
  const trip = tripDataInput && typeof tripDataInput === "object" ? tripDataInput : {};
  const tripId = clean(trip.tripId || trip.meta?.tripId);
  if (!tripId) {
    const error = new Error("Trip ID is required");
    error.code = "edit-trip-missing";
    throw error;
  }
  const baseRevision = Math.max(1, Number(trip.revision) || 1);
  const baseItems = new Map();
  const draftItems = new Map();
  (Array.isArray(trip.days) ? trip.days : []).forEach(day => {
    const dayId = clean(day?.dayId);
    if (!dayId) return;
    (Array.isArray(day?.items) ? day.items : []).forEach(item => {
      const itemId = clean(item?.itemId);
      if (!itemId) return;
      const key = itemKey(dayId, itemId);
      const snap = editableSnapshot(item);
      baseItems.set(key, { dayId, itemId, ...snap });
      draftItems.set(key, { dayId, itemId, ...clonePlain(snap) });
    });
  });
  return {
    tripId,
    baseRevision,
    startedAt: Date.now(),
    baseItems,
    draftItems
  };
}

export function getTripEditDraftItem(session, dayIdInput, itemIdInput) {
  if (!session) return null;
  const row = session.draftItems?.get?.(itemKey(dayIdInput, itemIdInput));
  return row ? clonePlain(row) : null;
}

export function updateTripEditDraftItem(session, dayIdInput, itemIdInput, patchInput = {}) {
  if (!session) return null;
  const key = itemKey(dayIdInput, itemIdInput);
  const current = session.draftItems?.get?.(key);
  if (!current) {
    const error = new Error("Itinerary item is not part of this edit session");
    error.code = "edit-item-missing";
    throw error;
  }
  const next = { ...current };
  EDITABLE_ITEM_FIELDS.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(patchInput || {}, field)) next[field] = clean(patchInput[field]);
  });
  session.draftItems.set(key, next);
  return clonePlain(next);
}

export function tripEditChanges(session) {
  if (!session) return [];
  const changes = [];
  session.draftItems.forEach((draft, key) => {
    const base = session.baseItems.get(key);
    if (!base || sameEditable(base, draft)) return;
    const patch = {};
    EDITABLE_ITEM_FIELDS.forEach(field => {
      if (clean(base[field]) !== clean(draft[field])) patch[field] = clean(draft[field]);
    });
    changes.push({ dayId: draft.dayId, itemId: draft.itemId, patch });
  });
  return changes;
}

export function tripEditChangeCount(session) {
  return tripEditChanges(session).length;
}

export function applyTripEditDraftToTrip(session, tripInput, { revision = null } = {}) {
  const trip = clonePlain(tripInput || {}) || {};
  if (!session) return trip;
  const changes = new Map(tripEditChanges(session).map(change => [itemKey(change.dayId, change.itemId), change.patch]));
  (Array.isArray(trip.days) ? trip.days : []).forEach(day => {
    const dayId = clean(day?.dayId);
    (Array.isArray(day?.items) ? day.items : []).forEach(item => {
      const patch = changes.get(itemKey(dayId, item?.itemId));
      if (patch) Object.assign(item, clonePlain(patch));
    });
  });
  if (revision != null) trip.revision = Math.max(1, Number(revision) || Number(trip.revision) || 1);
  return trip;
}

export async function commitTripEditSession(session, { user: userInput = null } = {}) {
  if (!session?.tripId) {
    const error = new Error("No active edit session");
    error.code = "edit-session-missing";
    throw error;
  }
  const user = userInput;
  if (!user?.uid) {
    const error = new Error("Sign in is required");
    error.code = "auth-required";
    throw error;
  }
  const changes = tripEditChanges(session);
  if (!changes.length) return { revision: session.baseRevision, changedItems: 0, noChange: true };
  if (changes.length > 450) {
    const error = new Error("Too many itinerary changes in one edit session");
    error.code = "edit-too-large";
    throw error;
  }

  const tripRef = doc(db, "trips", session.tripId);
  const memberRef = doc(db, "trips", session.tripId, "members", user.uid);
  const logRef = doc(collection(db, "trips", session.tripId, "activityLogs"));

  return runTransaction(db, async tx => {
    const [tripSnap, memberSnap] = await Promise.all([tx.get(tripRef), tx.get(memberRef)]);
    if (!tripSnap.exists()) {
      const error = new Error("Trip no longer exists");
      error.code = "not-found";
      throw error;
    }
    const tripDoc = tripSnap.data() || {};
    if (tripDoc.globalLocked === true) {
      const error = new Error("Trip is globally locked");
      error.code = "trip-global-locked";
      throw error;
    }
    const role = clean(memberSnap.exists() ? memberSnap.data()?.role : "");
    if (!VALID_ROLES.has(role)) {
      const error = new Error("Owner or Admin role required");
      error.code = "insufficient-role";
      throw error;
    }
    const serverRevision = Math.max(1, Number(tripDoc.revision) || 1);
    if (serverRevision !== Math.max(1, Number(session.baseRevision) || 1)) {
      const error = new Error("Trip was updated after this edit session started");
      error.code = "edit-revision-conflict";
      error.serverRevision = serverRevision;
      error.baseRevision = session.baseRevision;
      throw error;
    }

    const nextRevision = serverRevision + 1;
    changes.forEach(change => {
      const ref = doc(db, "trips", session.tripId, "days", change.dayId, "items", change.itemId);
      tx.set(ref, {
        ...change.patch,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      }, { merge: true });
    });
    tx.set(tripRef, {
      revision: nextRevision,
      contentHash: "",
      contentHashVersion: 0,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid
    }, { merge: true });
    tx.set(logRef, {
      type: "trip.edit.save",
      actionType: "trip.edit.save",
      category: "itinerary",
      title: "儲存行程編輯",
      summary: `更新 ${changes.length} 個行程項目 · Revision ${nextRevision}`,
      actorUid: user.uid,
      actorName: clean(user.displayName),
      revision: nextRevision,
      changedItems: changes.length,
      changedItemIds: changes.slice(0, 80).map(change => change.itemId),
      createdAt: serverTimestamp()
    });

    return { revision: nextRevision, changedItems: changes.length, noChange: false };
  });
}
