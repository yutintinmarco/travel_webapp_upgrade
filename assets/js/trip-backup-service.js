import { auth, db } from "./firebase-service.js";
import { assertCloudOperationAvailable, beginCloudOperation, endCloudOperation } from "./cloud-safety-service.js";
import { acquireTripOperation, releaseTripOperation } from "./trip-operation-service.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

const WRITE_CHUNK_SIZE = 8;
const SNAPSHOT_SOFT_LIMIT_BYTES = 760_000;
const SNAPSHOT_LIST_LIMIT = 10;
const MANAGE_ROLES = new Set(["owner", "admin"]);

function clean(value) { return String(value ?? "").trim(); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function safeArray(value) { return Array.isArray(value) ? value : []; }
function approxJsonBytes(value) {
  try { return new Blob([JSON.stringify(value)]).size; } catch (error) { return Infinity; }
}
function nowId(prefix = "snapshot") {
  const d = new Date();
  const stamp = [
    d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0"), "_",
    String(d.getHours()).padStart(2, "0"), String(d.getMinutes()).padStart(2, "0"), String(d.getSeconds()).padStart(2, "0")
  ].join("");
  return `${prefix}_${stamp}_${Math.random().toString(36).slice(2, 7)}`;
}
async function requireUser(userInput = null) {
  if (userInput?.uid) return userInput;
  if (auth?.currentUser?.uid) return auth.currentUser;
  try {
    if (typeof auth?.authStateReady === "function") await auth.authStateReady();
  } catch (error) {
    console.warn("Unable to wait for Firebase Auth state", error);
  }
  if (auth?.currentUser?.uid) return auth.currentUser;
  const error = new Error("Google sign-in required");
  error.code = "auth-required";
  throw error;
}
function roleLabel(role) {
  return ({ owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" })[role] || "";
}
async function getRole(tripId, user) {
  const memberSnap = await getDoc(doc(db, "trips", tripId, "members", user.uid));
  return memberSnap.exists() ? clean(memberSnap.data()?.role) : "";
}
async function requireManageRole(tripId, user) {
  const role = await getRole(tripId, user);
  if (!MANAGE_ROLES.has(role)) {
    const error = new Error("Owner or Admin role required");
    error.code = "insufficient-role";
    error.role = role;
    throw error;
  }
  return role;
}
function opSet(ref, data, options) { return { type: "set", ref, data, options }; }
function opDelete(ref) { return { type: "delete", ref }; }
async function commitOps(ops, onProgress = null, progressBase = 0, progressTotal = ops.length) {
  if (!ops.length) return;
  let completed = 0;
  for (let offset = 0; offset < ops.length; offset += WRITE_CHUNK_SIZE) {
    const chunk = ops.slice(offset, offset + WRITE_CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(op => {
      if (op.type === "delete") batch.delete(op.ref);
      else batch.set(op.ref, op.data, op.options || {});
    });
    await batch.commit();
    completed += chunk.length;
    if (typeof onProgress === "function") {
      onProgress({ completed: progressBase + completed, total: Math.max(progressTotal, progressBase + completed) });
    }
  }
}
function stripAudit(data = {}) {
  const output = { ...clone(data) };
  ["createdAt", "createdBy", "updatedAt", "updatedBy"].forEach(key => delete output[key]);
  return output;
}
function stripTripOperational(data = {}) {
  const output = { ...clone(data) };
  [
    "revision", "memberUids", "memberCount", "createdBy", "createdAt", "updatedBy", "updatedAt",
    "archived", "archivedAt", "archivedBy", "contentHash", "contentHashVersion", "importState",
    "lastImportMode", "lastSnapshotId", "importedBy", "importedAt", "restoredBy", "restoredAt",
    "restoredFromSnapshotId", "restoreState",
    "activeOperationId", "activeOperationType", "activeOperationBy",
    "activeOperationStartedAtMs", "activeOperationStartedAt"
  ].forEach(key => delete output[key]);
  return output;
}
function snapshotTypeLabel(type) {
  return ({
    "pre-import": "匯入前自動備份",
    "pre-restore": "還原前安全備份",
    "manual": "手動備份"
  })[clean(type)] || "旅程備份";
}
function toDateInfo(value) {
  let date = null;
  try {
    if (value?.toDate) date = value.toDate();
    else if (typeof value === "string" || typeof value === "number") date = new Date(value);
    else if (value?.seconds != null) date = new Date(Number(value.seconds) * 1000);
  } catch (error) {}
  if (!date || !Number.isFinite(date.getTime())) return { millis: 0, iso: "", date: null };
  return { millis: date.getTime(), iso: date.toISOString(), date };
}
function structureCounts(structure) {
  const days = safeArray(structure?.days);
  return {
    dayCount: days.length,
    itemCount: days.reduce((sum, day) => sum + safeArray(day?.items).length, 0),
    savedPlaceCount: safeArray(structure?.savedPlaces).length
  };
}

async function readTripStructure(tripId) {
  const tripRef = doc(db, "trips", tripId);
  const tripSnap = await getDoc(tripRef);
  if (!tripSnap.exists()) {
    const error = new Error("Firebase trip not found");
    error.code = "trip-not-found";
    throw error;
  }
  const [daySnaps, savedSnaps, settingsGeneral, settingsExpenses] = await Promise.all([
    getDocs(collection(db, "trips", tripId, "days")),
    getDocs(collection(db, "trips", tripId, "savedPlaces")),
    getDoc(doc(db, "trips", tripId, "settings", "general")),
    getDoc(doc(db, "trips", tripId, "settings", "expenses"))
  ]);
  const days = await Promise.all(daySnaps.docs.map(async daySnap => {
    const itemSnaps = await getDocs(collection(db, "trips", tripId, "days", daySnap.id, "items"));
    return {
      id: daySnap.id,
      data: daySnap.data(),
      items: itemSnaps.docs.map(itemSnap => ({ id: itemSnap.id, data: itemSnap.data() }))
    };
  }));
  return {
    tripId,
    tripDoc: tripSnap.data(),
    days,
    savedPlaces: savedSnaps.docs.map(placeSnap => ({ id: placeSnap.id, data: placeSnap.data() })),
    settings: {
      general: settingsGeneral.exists() ? settingsGeneral.data() : {},
      expenses: settingsExpenses.exists() ? settingsExpenses.data() : {}
    }
  };
}

function structureToPortableTrip(structure, { snapshotId = "" } = {}) {
  const tripDoc = structure?.tripDoc || {};
  const general = stripAudit(structure?.settings?.general || {});
  const expenses = stripAudit(structure?.settings?.expenses || {});
  const days = safeArray(structure?.days)
    .map(day => {
      const dayData = stripAudit(day?.data || {});
      const items = safeArray(day?.items)
        .map(item => ({ ...stripAudit(item?.data || {}), itemId: clean(item?.data?.itemId || item?.id) }))
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
      return { ...dayData, dayId: clean(dayData.dayId || day?.id), items };
    })
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const savedItems = safeArray(structure?.savedPlaces)
    .map(place => ({ ...stripAudit(place?.data || {}), placeId: clean(place?.data?.placeId || place?.id) }))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
  const savedMeta = general.savedPlacesMeta && typeof general.savedPlacesMeta === "object" ? clone(general.savedPlacesMeta) : {};
  const portable = {
    schemaVersion: Math.max(2, Number(tripDoc.schemaVersion) || 2),
    tripId: clean(structure?.tripId || tripDoc.tripId),
    revision: Math.max(1, Number(tripDoc.revision) || 1),
    meta: {
      tripId: clean(structure?.tripId || tripDoc.tripId),
      titleSmall: clean(tripDoc.titleSmall),
      titleMain: clean(tripDoc.titleHtml || tripDoc.title),
      dateRange: clean(tripDoc.dateRange),
      route: clean(tripDoc.route),
      accentColor: clean(tripDoc.accentColor),
      tripStartIso: clean(tripDoc.startDate),
      tripEndIso: clean(tripDoc.endDate),
      status: clean(tripDoc.status),
      coverImage: clean(tripDoc.coverImage),
      travellers: clone(general.travellers || {}),
      cities: clone(general.cities || {}),
      flights: clone(general.flights || []),
      hotels: clone(general.hotels || {}),
      infoCard: clone(general.infoCard || {}),
      galleryDefaults: clone(general.galleryDefaults || {}),
      footerNote: clean(general.footerNote),
      expenses: clone(expenses || {})
    },
    days,
    snacks: {
      ...savedMeta,
      items: savedItems
    },
    exportMeta: {
      source: snapshotId ? "firebase-snapshot" : "firebase-current",
      snapshotId: clean(snapshotId),
      exportedAt: new Date().toISOString()
    }
  };
  return portable;
}

async function writeSnapshot(tripId, structure, user, { type = "manual", restoreTargetSnapshotId = "" } = {}) {
  const size = approxJsonBytes(structure);
  if (size > SNAPSHOT_SOFT_LIMIT_BYTES) {
    const error = new Error("Current trip is too large for a safe single-document snapshot");
    error.code = "snapshot-too-large";
    error.approxBytes = size;
    throw error;
  }
  const snapshotId = nowId(type === "manual" ? "manual" : "restore");
  const counts = structureCounts(structure);
  await writeBatch(db)
    .set(doc(db, "trips", tripId, "snapshots", snapshotId), {
      snapshotId,
      type,
      sourceRevision: Number(structure?.tripDoc?.revision) || 0,
      title: clean(structure?.tripDoc?.title),
      dayCount: counts.dayCount,
      itemCount: counts.itemCount,
      savedPlaceCount: counts.savedPlaceCount,
      approxBytes: size,
      restoreTargetSnapshotId: clean(restoreTargetSnapshotId),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      payload: structure
    })
    .commit();
  return { snapshotId, type, sourceRevision: Number(structure?.tripDoc?.revision) || 0, ...counts, approxBytes: size };
}

function staleDeleteOps(current, target, tripId) {
  const ops = [];
  const targetDays = new Map(safeArray(target?.days).map(day => [day.id, new Set(safeArray(day?.items).map(item => item.id))]));
  safeArray(current?.days).forEach(day => {
    const nextItems = targetDays.get(day.id);
    safeArray(day?.items).forEach(item => {
      if (!nextItems || !nextItems.has(item.id)) ops.push(opDelete(doc(db, "trips", tripId, "days", day.id, "items", item.id)));
    });
    if (!targetDays.has(day.id)) ops.push(opDelete(doc(db, "trips", tripId, "days", day.id)));
  });
  const targetPlaces = new Set(safeArray(target?.savedPlaces).map(place => place.id));
  safeArray(current?.savedPlaces).forEach(place => {
    if (!targetPlaces.has(place.id)) ops.push(opDelete(doc(db, "trips", tripId, "savedPlaces", place.id)));
  });
  return ops;
}

function restoreWriteOps(target, tripId, user) {
  const ops = [];
  safeArray(target?.days).forEach(day => {
    const dayData = { ...stripAudit(day.data || {}), dayId: clean(day?.data?.dayId || day.id), createdAt: serverTimestamp(), createdBy: user.uid, updatedAt: serverTimestamp(), updatedBy: user.uid };
    ops.push(opSet(doc(db, "trips", tripId, "days", day.id), dayData));
    safeArray(day?.items).forEach(item => {
      const itemData = { ...stripAudit(item.data || {}), itemId: clean(item?.data?.itemId || item.id), createdAt: serverTimestamp(), createdBy: user.uid, updatedAt: serverTimestamp(), updatedBy: user.uid };
      ops.push(opSet(doc(db, "trips", tripId, "days", day.id, "items", item.id), itemData));
    });
  });
  safeArray(target?.savedPlaces).forEach(place => {
    const placeData = { ...stripAudit(place.data || {}), placeId: clean(place?.data?.placeId || place.id), createdAt: serverTimestamp(), createdBy: user.uid, updatedAt: serverTimestamp(), updatedBy: user.uid };
    ops.push(opSet(doc(db, "trips", tripId, "savedPlaces", place.id), placeData));
  });
  ["general", "expenses"].forEach(settingId => {
    const data = { ...stripAudit(target?.settings?.[settingId] || {}), createdAt: serverTimestamp(), createdBy: user.uid, updatedAt: serverTimestamp(), updatedBy: user.uid };
    ops.push(opSet(doc(db, "trips", tripId, "settings", settingId), data));
  });
  return ops;
}

export async function getTripBackupRole(tripIdInput, { user: userInput = null } = {}) {
  const user = await requireUser(userInput);
  const tripId = clean(tripIdInput);
  if (!tripId) throw new Error("Missing tripId");
  const role = await getRole(tripId, user);
  return { tripId, role, roleLabel: roleLabel(role), canManage: MANAGE_ROLES.has(role) };
}

export async function exportCurrentTrip(tripIdInput, { user: userInput = null } = {}) {
  const user = await requireUser(userInput);
  const tripId = clean(tripIdInput);
  if (!tripId) throw new Error("Missing tripId");
  const structure = await readTripStructure(tripId);
  const role = await getRole(tripId, user);
  if (!role) {
    const error = new Error("Current user is not a member of this trip");
    error.code = "insufficient-role";
    throw error;
  }
  const json = structureToPortableTrip(structure);
  const revision = Math.max(1, Number(structure?.tripDoc?.revision) || 1);
  return {
    tripId,
    revision,
    role,
    roleLabel: roleLabel(role),
    json,
    filename: `${tripId}-r${revision}.json`,
    counts: structureCounts(structure)
  };
}

export async function listTripSnapshots(tripIdInput, { user: userInput = null, maxItems = SNAPSHOT_LIST_LIMIT } = {}) {
  const user = await requireUser(userInput);
  const tripId = clean(tripIdInput);
  if (!tripId) throw new Error("Missing tripId");
  const role = await requireManageRole(tripId, user);
  const q = query(
    collection(db, "trips", tripId, "snapshots"),
    orderBy("createdAt", "desc"),
    limit(Math.max(1, Math.min(30, Number(maxItems) || SNAPSHOT_LIST_LIMIT)))
  );
  const snaps = await getDocs(q);
  const snapshots = snaps.docs.map(snap => {
    const data = snap.data() || {};
    const payload = data.payload || null;
    const counts = {
      dayCount: Number(data.dayCount) || structureCounts(payload).dayCount,
      itemCount: Number(data.itemCount) || structureCounts(payload).itemCount,
      savedPlaceCount: Number(data.savedPlaceCount) || structureCounts(payload).savedPlaceCount
    };
    const dateInfo = toDateInfo(data.createdAt);
    return {
      snapshotId: snap.id,
      type: clean(data.type),
      typeLabel: snapshotTypeLabel(data.type),
      sourceRevision: Number(data.sourceRevision) || Number(payload?.tripDoc?.revision) || 0,
      createdBy: clean(data.createdBy),
      createdAtMillis: dateInfo.millis,
      createdAtIso: dateInfo.iso,
      title: clean(data.title || payload?.tripDoc?.title),
      approxBytes: Number(data.approxBytes) || approxJsonBytes(payload),
      restoreTargetSnapshotId: clean(data.restoreTargetSnapshotId),
      ...counts
    };
  });
  return { tripId, role, roleLabel: roleLabel(role), canManage: true, snapshots };
}

export async function getTripSnapshot(tripIdInput, snapshotIdInput, { user: userInput = null } = {}) {
  const user = await requireUser(userInput);
  const tripId = clean(tripIdInput);
  const snapshotId = clean(snapshotIdInput);
  if (!tripId || !snapshotId) throw new Error("Missing snapshot reference");
  const role = await requireManageRole(tripId, user);
  const snap = await getDoc(doc(db, "trips", tripId, "snapshots", snapshotId));
  if (!snap.exists()) {
    const error = new Error("Snapshot not found");
    error.code = "snapshot-not-found";
    throw error;
  }
  const data = snap.data() || {};
  const payload = data.payload || null;
  if (!payload) {
    const error = new Error("Snapshot payload is missing");
    error.code = "snapshot-invalid";
    throw error;
  }
  const dateInfo = toDateInfo(data.createdAt);
  return {
    tripId,
    role,
    roleLabel: roleLabel(role),
    snapshotId,
    type: clean(data.type),
    typeLabel: snapshotTypeLabel(data.type),
    sourceRevision: Number(data.sourceRevision) || Number(payload?.tripDoc?.revision) || 0,
    createdBy: clean(data.createdBy),
    createdAtMillis: dateInfo.millis,
    createdAtIso: dateInfo.iso,
    title: clean(data.title || payload?.tripDoc?.title),
    approxBytes: Number(data.approxBytes) || approxJsonBytes(payload),
    restoreTargetSnapshotId: clean(data.restoreTargetSnapshotId),
    counts: structureCounts(payload),
    payload
  };
}

export async function exportSnapshotTrip(tripIdInput, snapshotIdInput, { user: userInput = null } = {}) {
  const snapshot = await getTripSnapshot(tripIdInput, snapshotIdInput, { user: userInput });
  const json = structureToPortableTrip(snapshot.payload, { snapshotId: snapshot.snapshotId });
  const revision = Math.max(1, Number(snapshot.sourceRevision) || Number(json.revision) || 1);
  json.revision = revision;
  return {
    ...snapshot,
    json,
    filename: `${snapshot.tripId}-snapshot-r${revision}-${snapshot.snapshotId}.json`
  };
}

export async function createManualSnapshot(tripIdInput, { user: userInput = null } = {}) {
  const user = await requireUser(userInput);
  assertCloudOperationAvailable("建立手動備份");
  const tripId = clean(tripIdInput);
  const localOperationToken = beginCloudOperation({type:"snapshot",tripId,label:"建立手動備份"});
  try {
  if (!tripId) throw new Error("Missing tripId");
  const role = await requireManageRole(tripId, user);
  const structure = await readTripStructure(tripId);
  const result = await writeSnapshot(tripId, structure, user, { type: "manual" });
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "trips", tripId, "activityLogs")), {
    type: "trip.snapshot.manual",
    actionType: "trip.snapshot.manual",
    category: "backup",
    title: "建立手動備份",
    summary: `Snapshot · Revision ${result.sourceRevision}`,
    actorUid: user.uid,
    actorName: clean(user.displayName),
    snapshotId: result.snapshotId,
    revision: result.sourceRevision,
    createdAt: serverTimestamp()
  });
  await batch.commit();
  return { tripId, role, roleLabel: roleLabel(role), ...result };
  } finally {
    endCloudOperation(localOperationToken);
  }
}
export async function restoreTripSnapshot(tripIdInput, snapshotIdInput, { user: userInput = null, onProgress = null } = {}) {
  const user = await requireUser(userInput);
  assertCloudOperationAvailable("還原旅程");
  const tripId = clean(tripIdInput);
  const snapshotId = clean(snapshotIdInput);
  if (!tripId || !snapshotId) throw new Error("Missing snapshot reference");
  const localOperationToken = beginCloudOperation({type:"restore",tripId,label:"還原旅程"});
  let serverOperation = null;
  let mutationStarted = false;
  try {
  const role = await requireManageRole(tripId, user);
  serverOperation = await acquireTripOperation(tripId,"restore",user);
  const snapshot = await getTripSnapshot(tripId, snapshotId, { user });
  const target = snapshot.payload;
  const current = await readTripStructure(tripId);

  const safety = await writeSnapshot(tripId, current, user, {
    type: "pre-restore",
    restoreTargetSnapshotId: snapshotId
  });
  if (typeof onProgress === "function") onProgress({ completed: 1, total: 4, stage: "safety-snapshot" });

  const tripRef = doc(db, "trips", tripId);
  const currentTrip = current.tripDoc || {};
  const targetTrip = target?.tripDoc || {};
  const nextRevision = Math.max(1, Number(currentTrip.revision) || 0) + 1;
  const restoredTripContent = stripTripOperational(targetTrip);

  // Phase 2E loader suppresses partial renders while a restore is writing many
  // documents. Mark the trip as restoring before replacing parent/content docs.
  mutationStarted = true;
  await writeBatch(db).set(tripRef, {
    restoreState: "restoring",
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  }, { merge: true }).commit();

  await writeBatch(db).set(tripRef, {
    ...restoredTripContent,
    revision: nextRevision,
    memberUids: safeArray(currentTrip.memberUids),
    memberCount: Number(currentTrip.memberCount) || safeArray(currentTrip.memberUids).length,
    createdBy: clean(currentTrip.createdBy),
    createdAt: currentTrip.createdAt || serverTimestamp(),
    archived: currentTrip.archived === true,
    archivedAt: currentTrip.archivedAt || null,
    archivedBy: clean(currentTrip.archivedBy),
    activeOperationId: clean(currentTrip.activeOperationId),
    activeOperationType: clean(currentTrip.activeOperationType),
    activeOperationBy: clean(currentTrip.activeOperationBy),
    activeOperationStartedAtMs: Number(currentTrip.activeOperationStartedAtMs)||0,
    activeOperationStartedAt: currentTrip.activeOperationStartedAt || null,
    contentHash: "",
    contentHashVersion: 1,
    importState: "ready",
    restoreState: "restoring",
    lastImportMode: "snapshot-restore",
    lastSnapshotId: safety.snapshotId,
    restoredFromSnapshotId: snapshotId,
    restoredBy: user.uid,
    restoredAt: serverTimestamp(),
    updatedBy: user.uid,
    updatedAt: serverTimestamp()
  }, { merge: false }).commit();
  if (typeof onProgress === "function") onProgress({ completed: 2, total: 4, stage: "trip" });

  const writes = restoreWriteOps(target, tripId, user);
  const deletes = staleDeleteOps(current, target, tripId);
  const totalContentOps = Math.max(1, writes.length + deletes.length);
  let lastContentCompleted = 0;
  const contentProgress = ({ completed, total }) => {
    lastContentCompleted = completed;
    if (typeof onProgress === "function") {
      const ratio = Math.min(1, completed / Math.max(1, total));
      onProgress({ completed: 2 + ratio, total: 4, stage: "content", detail: `${completed}/${total}` });
    }
  };
  await commitOps(writes, contentProgress, 0, totalContentOps);
  await commitOps(deletes, contentProgress, writes.length, totalContentOps);
  if (typeof onProgress === "function" && !lastContentCompleted) onProgress({ completed: 3, total: 4, stage: "content" });

  const finalBatch = writeBatch(db);
  finalBatch.set(doc(collection(db, "trips", tripId, "activityLogs")), {
    type: "trip.snapshot.restore",
    actionType: "trip.snapshot.restore",
    category: "backup",
    title: "還原旅程版本",
    summary: `由 Revision ${snapshot.sourceRevision || 0} 還原 · 新 Revision ${nextRevision}`,
    actorUid: user.uid,
    actorName: clean(user.displayName),
    snapshotId,
    safetySnapshotId: safety.snapshotId,
    sourceRevision: snapshot.sourceRevision,
    revision: nextRevision,
    createdAt: serverTimestamp()
  });
  finalBatch.set(tripRef, {
    restoreState: "ready",
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  }, { merge: true });
  await finalBatch.commit();
  if (typeof onProgress === "function") onProgress({ completed: 4, total: 4, stage: "done" });

  return {
    tripId,
    role,
    roleLabel: roleLabel(role),
    snapshotId,
    safetySnapshotId: safety.snapshotId,
    sourceRevision: snapshot.sourceRevision,
    revision: nextRevision,
    counts: structureCounts(target)
  };

  } catch (error) {
    try {
      if (mutationStarted) {
        await writeBatch(db).set(doc(db,"trips",tripId),{
          restoreState:"failed",updatedAt:serverTimestamp(),updatedBy:user.uid
        },{merge:true}).commit();
      }
    } catch (stateError) {
      console.warn("Unable to mark failed restore",stateError);
    }
    throw error;
  } finally {
    if (serverOperation) await releaseTripOperation(serverOperation,user);
    endCloudOperation(localOperationToken);
  }
}