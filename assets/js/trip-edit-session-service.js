import { db } from "./firebase-service.js";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp
} from "./firestore-observed-service.js";

const USER_EDITABLE_ITEM_FIELDS = ["time", "title", "note", "who"];
const PERSISTED_ITEM_FIELDS = ["time", "title", "note", "who", "booked", "sortOrder"];
const VALID_ITEM_KINDS = new Set(["stop", "transit"]);
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
function makeItemId() {
  try {
    if (globalThis.crypto?.randomUUID) return `itm_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  } catch (_) {}
  return `itm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
function normalizedKind(value) {
  const kind = clean(value).toLowerCase();
  return VALID_ITEM_KINDS.has(kind) ? kind : "stop";
}
function finiteCoordinate(value) {
  if (clean(value) === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}
function normalizeDraftLocation(record = {}, fallbackTitle = "") {
  const source = record?.location && typeof record.location === "object" ? record.location : record;
  const latitude = finiteCoordinate(source?.latitude ?? source?.lat);
  const longitude = finiteCoordinate(source?.longitude ?? source?.lng ?? source?.lon);
  return {
    name: clean(source?.name) || clean(fallbackTitle),
    placeId: clean(source?.placeId),
    latitude,
    longitude,
    address: clean(source?.address),
    mapsUrl: clean(source?.mapsUrl || source?.googleMapsUrl)
  };
}
function locationSnapshot(item = {}) {
  const source = item?.location && typeof item.location === "object" ? item.location : {};
  return normalizeDraftLocation({
    name: source?.name || item?.placeName || item?.title,
    placeId: source?.placeId || item?.googlePlaceId || item?.googleMapsPlaceId,
    latitude: source?.latitude ?? source?.lat ?? item?.latitude ?? item?.lat,
    longitude: source?.longitude ?? source?.lng ?? source?.lon ?? item?.longitude ?? item?.lng ?? item?.lon,
    address: source?.address || item?.address,
    mapsUrl: source?.mapsUrl || source?.googleMapsUrl || item?.maps || item?.mapsUrl || item?.googleMapsUrl
  }, item?.title);
}
function sameLocation(a = {}, b = {}) {
  const left = normalizeDraftLocation(a), right = normalizeDraftLocation(b);
  return clean(left.name) === clean(right.name)
    && clean(left.placeId) === clean(right.placeId)
    && finiteCoordinate(left.latitude) === finiteCoordinate(right.latitude)
    && finiteCoordinate(left.longitude) === finiteCoordinate(right.longitude)
    && clean(left.address) === clean(right.address)
    && clean(left.mapsUrl) === clean(right.mapsUrl);
}
function newDraftRecord(dayId, kindInput, fields = {}) {
  const kind = normalizedKind(kindInput);
  const title = clean(fields.title) || (kind === "transit" ? "Travel" : "新地點");
  const icon = clean(fields.icon) || (kind === "transit" ? "🚆" : "📍");
  return {
    dayId: clean(dayId),
    itemId: makeItemId(),
    isNew: true,
    kind,
    transportMode: kind === "transit" ? "transit" : "",
    time: clean(fields.time),
    title,
    note: clean(fields.note),
    sortOrder: normalizedSortOrder(fields.sortOrder),
    icon,
    who: clean(fields.who) || "all",
    popup: false,
    booked: Boolean(fields.booked),
    detail: "",
    maps: clean(fields.location?.mapsUrl),
    gallery: [],
    images: [],
    location: normalizeDraftLocation(fields.location || {}, title)
  };
}
function draftToNewItem(draft = {}) {
  const kind = normalizedKind(draft.kind);
  const title = clean(draft.title) || (kind === "transit" ? "Travel" : "新地點");
  return {
    itemId: clean(draft.itemId),
    kind,
    ...(kind === "transit" ? { transportMode: "transit" } : {}),
    time: clean(draft.time),
    icon: clean(draft.icon) || (kind === "transit" ? "🚆" : "📍"),
    title,
    note: clean(draft.note),
    who: clean(draft.who) || "all",
    popup: Boolean(draft.popup),
    booked: Boolean(draft.booked),
    detail: clean(draft.detail),
    maps: clean(draft.location?.mapsUrl || draft.maps),
    gallery: Array.isArray(draft.gallery) ? clonePlain(draft.gallery) : [],
    images: Array.isArray(draft.images) ? clonePlain(draft.images) : [],
    location: normalizeDraftLocation(draft.location || {}, title),
    sortOrder: normalizedSortOrder(draft.sortOrder)
  };
}
function normalizedSortOrder(value, fallback = 999999) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}
function itemSnapshot(item = {}, fallbackSortOrder = 999999) {
  const location = locationSnapshot(item);
  return {
    time: clean(item?.time),
    title: clean(item?.title),
    note: clean(item?.note),
    who: clean(item?.who) || "all",
    booked: Boolean(item?.booked),
    sortOrder: normalizedSortOrder(item?.sortOrder, fallbackSortOrder),
    location,
    maps: clean(location.mapsUrl)
  };
}
function samePersisted(a = {}, b = {}) {
  return PERSISTED_ITEM_FIELDS.every(field => field === "sortOrder"
    ? normalizedSortOrder(a?.[field]) === normalizedSortOrder(b?.[field])
    : field === "booked"
      ? Boolean(a?.[field]) === Boolean(b?.[field])
      : clean(a?.[field]) === clean(b?.[field])) && sameLocation(a?.location, b?.location);
}
function parseClockMinutes(value) {
  const match = clean(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}
function dayDraftRows(session, dayIdInput) {
  const dayId = clean(dayIdInput);
  const rows = [];
  session?.draftItems?.forEach?.((draft, key) => {
    if (session?.deletedItems?.has?.(key)) return;
    if (clean(draft?.dayId) === dayId) rows.push(draft);
  });
  return rows;
}
function stablePresentationOrder(rows = []) {
  return rows.slice().sort((a, b) => {
    const ao = normalizedSortOrder(a?.sortOrder), bo = normalizedSortOrder(b?.sortOrder);
    if (ao !== bo) return ao - bo;
    const at = parseClockMinutes(a?.time), bt = parseClockMinutes(b?.time);
    if (at != null && bt != null && at !== bt) return at - bt;
    return clean(a?.itemId).localeCompare(clean(b?.itemId));
  });
}
function renumberPresentationSortOrders(session, dayIdInput) {
  if (!session) return [];
  const ordered = stablePresentationOrder(dayDraftRows(session, dayIdInput));
  ordered.forEach((draft, index) => {
    session.draftItems.set(itemKey(draft.dayId, draft.itemId), { ...draft, sortOrder: index });
  });
  return ordered.map(row => clonePlain(row));
}
function stableChronologicalOrder(rows = []) {
  return rows.slice().sort((a, b) => {
    const at = parseClockMinutes(a?.time), bt = parseClockMinutes(b?.time);
    if (at != null && bt != null && at !== bt) return at - bt;
    if (at != null && bt == null) return -1;
    if (at == null && bt != null) return 1;
    const ao = normalizedSortOrder(a?.sortOrder), bo = normalizedSortOrder(b?.sortOrder);
    if (ao !== bo) return ao - bo;
    return clean(a?.itemId).localeCompare(clean(b?.itemId));
  });
}
function normalizeDaySortOrders(session, dayIdInput) {
  if (!session) return [];
  const ordered = stableChronologicalOrder(dayDraftRows(session, dayIdInput));
  ordered.forEach((draft, index) => {
    session.draftItems.set(itemKey(draft.dayId, draft.itemId), { ...draft, sortOrder: index });
  });
  return ordered.map(row => clonePlain(row));
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
    (Array.isArray(day?.items) ? day.items : []).forEach((item, index) => {
      const itemId = clean(item?.itemId);
      if (!itemId) return;
      const key = itemKey(dayId, itemId);
      const snap = itemSnapshot(item, index);
      baseItems.set(key, { dayId, itemId, ...snap });
      draftItems.set(key, { dayId, itemId, ...clonePlain(snap) });
    });
  });
  return {
    tripId,
    baseRevision,
    startedAt: Date.now(),
    dayIds: new Set((Array.isArray(trip.days) ? trip.days : []).map(day => clean(day?.dayId)).filter(Boolean)),
    baseItems,
    draftItems,
    deletedItems: new Set()
  };
}

export function getTripEditDraftItem(session, dayIdInput, itemIdInput) {
  if (!session) return null;
  const key = itemKey(dayIdInput, itemIdInput);
  if (session.deletedItems?.has?.(key)) return null;
  const row = session.draftItems?.get?.(key);
  return row ? clonePlain(row) : null;
}

export function addTripEditDraftItem(session, dayIdInput, kindInput, fields = {}) {
  if (!session) return null;
  const dayId = clean(dayIdInput);
  if (!dayId || !session.dayIds?.has?.(dayId)) {
    const error = new Error("Day is not part of this edit session");
    error.code = "edit-day-missing";
    throw error;
  }
  const currentRows = dayDraftRows(session, dayId);
  const maxSort = currentRows.reduce((max, row) => Math.max(max, normalizedSortOrder(row?.sortOrder, -1)), -1);
  const draft = newDraftRecord(dayId, kindInput, { ...fields, sortOrder: maxSort + 1 });
  session.draftItems.set(itemKey(dayId, draft.itemId), draft);
  normalizeDaySortOrders(session, dayId);
  return getTripEditDraftItem(session, dayId, draft.itemId);
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
  USER_EDITABLE_ITEM_FIELDS.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(patchInput || {}, field)) next[field] = clean(patchInput[field]);
  });
  if (!clean(next.who)) next.who = "all";
  if (Object.prototype.hasOwnProperty.call(patchInput || {}, "booked")) next.booked = Boolean(patchInput.booked);
  if (Object.prototype.hasOwnProperty.call(patchInput || {}, "location")) {
    next.location = normalizeDraftLocation(patchInput.location || {}, next.title);
    next.maps = clean(next.location?.mapsUrl);
  }
  if (next.isNew && Object.prototype.hasOwnProperty.call(patchInput || {}, "title")) {
    const location = normalizeDraftLocation(next.location || {}, next.title);
    if (!clean(location.name) || clean(location.name) === clean(current.title) || (!location.placeId && location.latitude == null && location.longitude == null && !location.address)) location.name = clean(next.title);
    next.location = location;
  }
  session.draftItems.set(key, next);
  if (Object.prototype.hasOwnProperty.call(patchInput || {}, "time") && clean(patchInput.time) !== clean(current.time)) {
    normalizeDaySortOrders(session, current.dayId);
  }
  return getTripEditDraftItem(session, current.dayId, current.itemId);
}

export function reorderTripEditDraftDayByTime(session, dayIdInput) {
  return normalizeDaySortOrders(session, dayIdInput);
}

export function getTripEditDraftPosition(session, dayIdInput, itemIdInput) {
  if (!session) return { index: -1, count: 0, canMoveUp: false, canMoveDown: false };
  const dayId = clean(dayIdInput), itemId = clean(itemIdInput);
  const ordered = stablePresentationOrder(dayDraftRows(session, dayId));
  const index = ordered.findIndex(row => clean(row?.itemId) === itemId);
  return {
    index,
    count: ordered.length,
    canMoveUp: index > 0,
    canMoveDown: index >= 0 && index < ordered.length - 1
  };
}

export function moveTripEditDraftItemToIndex(session, dayIdInput, itemIdInput, targetIndexInput) {
  if (!session) return null;
  const dayId = clean(dayIdInput), itemId = clean(itemIdInput);
  const key = itemKey(dayId, itemId);
  if (session.deletedItems?.has?.(key) || !session.draftItems?.has?.(key)) {
    const error = new Error("Itinerary item is not part of this edit session");
    error.code = "edit-item-missing";
    throw error;
  }
  const ordered = stablePresentationOrder(dayDraftRows(session, dayId));
  const fromIndex = ordered.findIndex(row => clean(row?.itemId) === itemId);
  if (fromIndex < 0) return null;
  const targetIndex = Math.max(0, Math.min(ordered.length - 1, Math.trunc(Number(targetIndexInput) || 0)));
  if (targetIndex !== fromIndex) {
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(targetIndex, 0, moved);
  }
  ordered.forEach((draft, index) => {
    session.draftItems.set(itemKey(draft.dayId, draft.itemId), { ...draft, sortOrder: index });
  });
  return getTripEditDraftItem(session, dayId, itemId);
}

export function removeTripEditDraftItem(session, dayIdInput, itemIdInput) {
  if (!session) return { removed: false, wasNew: false };
  const dayId = clean(dayIdInput), itemId = clean(itemIdInput), key = itemKey(dayId, itemId);
  const draft = session.draftItems?.get?.(key);
  if (!draft || session.deletedItems?.has?.(key)) return { removed: false, wasNew: false };
  const base = session.baseItems?.get?.(key);
  const wasNew = Boolean(draft?.isNew && !base);
  if (wasNew) session.draftItems.delete(key);
  else session.deletedItems.add(key);
  renumberPresentationSortOrders(session, dayId);
  return { removed: true, wasNew };
}

export function tripEditChanges(session) {
  if (!session) return [];
  const changes = [];
  session.deletedItems?.forEach?.(key => {
    const base = session.baseItems.get(key);
    if (base) changes.push({ operation: "delete", dayId: base.dayId, itemId: base.itemId });
  });
  session.draftItems.forEach((draft, key) => {
    if (session.deletedItems?.has?.(key)) return;
    const base = session.baseItems.get(key);
    if (!base) {
      if (draft?.isNew) changes.push({ operation: "create", dayId: draft.dayId, itemId: draft.itemId, item: draftToNewItem(draft) });
      return;
    }
    if (samePersisted(base, draft)) return;
    const patch = {};
    PERSISTED_ITEM_FIELDS.forEach(field => {
      if (field === "sortOrder") {
        if (normalizedSortOrder(base[field]) !== normalizedSortOrder(draft[field])) patch[field] = normalizedSortOrder(draft[field]);
      } else if (field === "booked") {
        if (Boolean(base[field]) !== Boolean(draft[field])) patch[field] = Boolean(draft[field]);
      } else if (clean(base[field]) !== clean(draft[field])) {
        patch[field] = field === "who" ? (clean(draft[field]) || "all") : clean(draft[field]);
      }
    });
    if (!sameLocation(base.location, draft.location)) {
      patch.location = normalizeDraftLocation(draft.location || {}, draft.title);
      patch.maps = clean(patch.location.mapsUrl);
    }
    changes.push({ operation: "update", dayId: draft.dayId, itemId: draft.itemId, patch });
  });
  return changes;
}

export function tripEditChangeCount(session) {
  return tripEditChanges(session).length;
}

export function applyTripEditDraftToTrip(session, tripInput, { revision = null } = {}) {
  const trip = clonePlain(tripInput || {}) || {};
  if (!session) return trip;
  const draftMap = new Map();
  session.draftItems.forEach(draft => draftMap.set(itemKey(draft.dayId, draft.itemId), draft));
  (Array.isArray(trip.days) ? trip.days : []).forEach(day => {
    const dayId = clean(day?.dayId);
    if (!Array.isArray(day?.items)) day.items = [];
    const existingIds = new Set(day.items.map(item => clean(item?.itemId)).filter(Boolean));
    day.items = day.items.map((item, index) => {
      const key = itemKey(dayId, item?.itemId);
      if (session.deletedItems?.has?.(key)) return null;
      const draft = draftMap.get(key);
      if (!draft) return clonePlain(item);
      return {
        ...clonePlain(item),
        time: clean(draft.time),
        title: clean(draft.title),
        note: clean(draft.note),
        who: clean(draft.who) || "all",
        booked: Boolean(draft.booked),
        sortOrder: normalizedSortOrder(draft.sortOrder, index),
        location: normalizeDraftLocation(draft.location || {}, draft.title),
        maps: clean(draft.maps)
      };
    }).filter(Boolean);
    session.draftItems.forEach(draft => {
      if (clean(draft?.dayId) !== dayId || !draft?.isNew || existingIds.has(clean(draft?.itemId))) return;
      day.items.push(draftToNewItem(draft));
    });
    day.items = day.items.sort((a, b) => {
      const ao = normalizedSortOrder(a?.sortOrder), bo = normalizedSortOrder(b?.sortOrder);
      if (ao !== bo) return ao - bo;
      return clean(a?.itemId).localeCompare(clean(b?.itemId));
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
      if (change.operation === "create") {
        tx.set(ref, {
          ...change.item,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid
        });
        return;
      }
      if (change.operation === "delete") {
        tx.delete(ref);
        return;
      }
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
      createdItems: changes.filter(change => change.operation === "create").length,
      deletedItems: changes.filter(change => change.operation === "delete").length,
      changedItemIds: changes.slice(0, 80).map(change => change.itemId),
      createdAt: serverTimestamp()
    });

    return { revision: nextRevision, changedItems: changes.length, noChange: false };
  });
}
