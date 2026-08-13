import { db } from "./firebase-service.js";
import { getCurrentUser } from "./auth-service.js";
import { buildFirestoreTripPlan, getTripSummary, normalizePortableTrip, validatePortableTrip } from "./trip-schema-service.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

const WRITE_CHUNK_SIZE = 8;
const SNAPSHOT_SOFT_LIMIT_BYTES = 760_000;
const VALID_REPLACE_ROLES = new Set(["owner", "admin"]);

function clean(value) { return String(value ?? "").trim(); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function nowId() {
  const d = new Date();
  const stamp = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0"), "_", String(d.getHours()).padStart(2, "0"), String(d.getMinutes()).padStart(2, "0"), String(d.getSeconds()).padStart(2, "0")].join("");
  return `import_${stamp}_${Math.random().toString(36).slice(2, 7)}`;
}
function requireUser(user = getCurrentUser()) {
  if (!user?.uid) {
    const error = new Error("Google sign-in required");
    error.code = "auth-required";
    throw error;
  }
  return user;
}
function roleLabel(role) { return ({ owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" })[role] || ""; }
function approxJsonBytes(value) {
  try { return new Blob([JSON.stringify(value)]).size; } catch (error) { return Infinity; }
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
    if (typeof onProgress === "function") onProgress({ completed: progressBase + completed, total: Math.max(progressTotal, progressBase + completed) });
  }
}

function withAuditFields(data, user, { preserveCreated = false } = {}) {
  const output = { ...data, updatedAt: serverTimestamp(), updatedBy: user.uid };
  if (!preserveCreated) {
    output.createdAt = serverTimestamp();
    output.createdBy = clean(data?.createdBy) || user.uid;
  }
  return output;
}

function contentWriteOps(plan, user) {
  const tripId = plan.tripId;
  const ops = [];
  plan.days.forEach(day => {
    ops.push(opSet(doc(db, "trips", tripId, "days", day.id), withAuditFields(day.data, user)));
    day.items.forEach(item => ops.push(opSet(doc(db, "trips", tripId, "days", day.id, "items", item.id), withAuditFields(item.data, user))));
  });
  plan.savedPlaces.forEach(place => ops.push(opSet(doc(db, "trips", tripId, "savedPlaces", place.id), withAuditFields(place.data, user))));
  ops.push(opSet(doc(db, "trips", tripId, "settings", "general"), withAuditFields(plan.settings.general || {}, user)));
  ops.push(opSet(doc(db, "trips", tripId, "settings", "expenses"), withAuditFields(plan.settings.expenses || {}, user)));
  return ops;
}

async function readExistingStructure(tripId) {
  const tripRef = doc(db, "trips", tripId);
  const tripSnap = await getDoc(tripRef);
  if (!tripSnap.exists()) return null;

  const daySnaps = await getDocs(collection(db, "trips", tripId, "days"));
  const days = [];
  for (const daySnap of daySnaps.docs) {
    const itemSnaps = await getDocs(collection(db, "trips", tripId, "days", daySnap.id, "items"));
    days.push({
      id: daySnap.id,
      data: daySnap.data(),
      items: itemSnaps.docs.map(itemSnap => ({ id: itemSnap.id, data: itemSnap.data() }))
    });
  }
  const savedSnaps = await getDocs(collection(db, "trips", tripId, "savedPlaces"));
  const settingsGeneral = await getDoc(doc(db, "trips", tripId, "settings", "general"));
  const settingsExpenses = await getDoc(doc(db, "trips", tripId, "settings", "expenses"));
  return {
    tripId,
    tripDoc: tripSnap.data(),
    days,
    savedPlaces: savedSnaps.docs.map(s => ({ id: s.id, data: s.data() })),
    settings: {
      general: settingsGeneral.exists() ? settingsGeneral.data() : null,
      expenses: settingsExpenses.exists() ? settingsExpenses.data() : null
    }
  };
}

function staleDeleteOps(existing, plan) {
  if (!existing) return [];
  const ops = [];
  const nextDays = new Map(plan.days.map(day => [day.id, new Set(day.items.map(item => item.id))]));
  existing.days.forEach(day => {
    const nextItems = nextDays.get(day.id);
    day.items.forEach(item => {
      if (!nextItems || !nextItems.has(item.id)) ops.push(opDelete(doc(db, "trips", plan.tripId, "days", day.id, "items", item.id)));
    });
    if (!nextDays.has(day.id)) ops.push(opDelete(doc(db, "trips", plan.tripId, "days", day.id)));
  });
  const nextPlaces = new Set(plan.savedPlaces.map(place => place.id));
  existing.savedPlaces.forEach(place => {
    if (!nextPlaces.has(place.id)) ops.push(opDelete(doc(db, "trips", plan.tripId, "savedPlaces", place.id)));
  });
  return ops;
}

async function createSnapshot(existing, user) {
  if (!existing) return null;
  const size = approxJsonBytes(existing);
  if (size > SNAPSHOT_SOFT_LIMIT_BYTES) {
    const error = new Error("Existing trip is too large for a safe single-document import snapshot");
    error.code = "snapshot-too-large";
    error.approxBytes = size;
    throw error;
  }
  const snapshotId = nowId();
  await writeBatch(db)
    .set(doc(db, "trips", existing.tripId, "snapshots", snapshotId), {
      snapshotId,
      type: "pre-import",
      sourceRevision: Number(existing.tripDoc?.revision) || 0,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      payload: existing
    })
    .commit();
  return snapshotId;
}

export async function inspectTripImport(rawInput, userInput = null) {
  const user = requireUser(userInput);
  const validation = validatePortableTrip(rawInput);
  const summary = getTripSummary(validation.trip);
  if (!validation.valid) return { ...validation, summary, exists: false, role: null, canImport: false, mode: "invalid" };

  const tripRef = doc(db, "trips", validation.trip.tripId);
  const tripSnap = await getDoc(tripRef);
  if (!tripSnap.exists()) {
    return { ...validation, summary, exists: false, role: null, canImport: true, mode: "create", existingTrip: null };
  }
  const existingTrip = tripSnap.data() || {};
  const listedMember = Array.isArray(existingTrip.memberUids) && existingTrip.memberUids.includes(user.uid);
  if (!listedMember) {
    return {
      ...validation, summary, exists: true, role: null, roleLabel: "", canImport: false, mode: "replace", existingTrip
    };
  }
  const memberSnap = await getDoc(doc(db, "trips", validation.trip.tripId, "members", user.uid));
  const role = memberSnap.exists() ? clean(memberSnap.data()?.role) : null;
  return {
    ...validation,
    summary,
    exists: true,
    role,
    roleLabel: roleLabel(role),
    canImport: VALID_REPLACE_ROLES.has(role),
    mode: "replace",
    existingTrip
  };
}

export async function importTrip(rawInput, { mode = "create", user: userInput = null, onProgress = null } = {}) {
  const user = requireUser(userInput);
  const built = buildFirestoreTripPlan(rawInput, user);
  if (!built.valid || !built.plan) {
    const error = new Error(built.errors?.join("; ") || "Invalid portable trip JSON");
    error.code = "invalid-trip";
    error.validation = built;
    throw error;
  }
  const plan = built.plan;
  const tripRef = doc(db, "trips", plan.tripId);
  const tripSnap = await getDoc(tripRef);
  const exists = tripSnap.exists();

  if (mode === "create" && exists) {
    const error = new Error("Trip already exists");
    error.code = "trip-exists";
    throw error;
  }
  if (mode === "replace" && !exists) mode = "create";

  let existing = null;
  let snapshotId = null;
  let existingRole = null;
  if (mode === "replace") {
    const parentData = tripSnap.data() || {};
    if (!Array.isArray(parentData.memberUids) || !parentData.memberUids.includes(user.uid)) {
      const error = new Error("Current user is not a member of this trip");
      error.code = "insufficient-role";
      throw error;
    }
    const memberSnap = await getDoc(doc(db, "trips", plan.tripId, "members", user.uid));
    existingRole = memberSnap.exists() ? clean(memberSnap.data()?.role) : null;
    if (!VALID_REPLACE_ROLES.has(existingRole)) {
      const error = new Error("Owner or Admin role required to replace an existing trip");
      error.code = "insufficient-role";
      throw error;
    }
    existing = await readExistingStructure(plan.tripId);
    snapshotId = await createSnapshot(existing, user);
  }

  const baseExisting = exists ? tripSnap.data() || {} : {};
  const finalRevision = mode === "replace"
    ? Math.max(Number(baseExisting.revision || 0) + 1, Number(plan.tripDoc.revision || 1))
    : Math.max(1, Number(plan.tripDoc.revision || 1));

  if (mode === "create") {
    const batch = writeBatch(db);
    batch.set(tripRef, {
      ...plan.tripDoc,
      revision: finalRevision,
      importState: "importing",
      importedBy: user.uid,
      importedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    batch.set(doc(db, "trips", plan.tripId, "members", user.uid), {
      ...plan.memberDoc,
      joinedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await batch.commit();
  } else {
    await writeBatch(db).set(tripRef, {
      ...baseExisting,
      ...plan.tripDoc,
      revision: finalRevision,
      memberUids: Array.isArray(baseExisting.memberUids) ? baseExisting.memberUids : plan.tripDoc.memberUids,
      memberCount: Number(baseExisting.memberCount) || (Array.isArray(baseExisting.memberUids) ? baseExisting.memberUids.length : 1),
      createdBy: clean(baseExisting.createdBy) || plan.tripDoc.createdBy,
      createdAt: baseExisting.createdAt || serverTimestamp(),
      archived: baseExisting.archived === true,
      archivedAt: baseExisting.archivedAt || null,
      archivedBy: clean(baseExisting.archivedBy),
      importState: "importing",
      importedBy: user.uid,
      importedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }).commit();
  }

  const writes = contentWriteOps(plan, user);
  const deletes = staleDeleteOps(existing, plan);
  const totalOps = writes.length + deletes.length + 2;
  if (typeof onProgress === "function") onProgress({ completed: 1, total: totalOps });
  await commitOps(writes, onProgress, 1, totalOps);
  await commitOps(deletes, onProgress, 1 + writes.length, totalOps);

  const finalBatch = writeBatch(db);
  finalBatch.set(tripRef, {
    revision: finalRevision,
    schemaVersion: Number(plan.tripDoc.schemaVersion) || 2,
    importState: "ready",
    lastImportMode: mode,
    lastSnapshotId: snapshotId || "",
    importedBy: user.uid,
    importedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  const logRef = doc(collection(db, "trips", plan.tripId, "activityLogs"));
  finalBatch.set(logRef, {
    type: mode === "replace" ? "trip.import.replace" : "trip.import.create",
    actorUid: user.uid,
    actorName: clean(user.displayName),
    revision: finalRevision,
    schemaVersion: Number(plan.tripDoc.schemaVersion) || 2,
    snapshotId: snapshotId || "",
    createdAt: serverTimestamp()
  });
  await finalBatch.commit();
  if (typeof onProgress === "function") onProgress({ completed: totalOps, total: totalOps });

  return {
    tripId: plan.tripId,
    mode,
    role: mode === "create" ? "owner" : existingRole,
    revision: finalRevision,
    snapshotId,
    normalizedTrip: normalizePortableTrip(rawInput),
    summary: getTripSummary(rawInput)
  };
}

export async function setTripArchived(tripIdInput, archived, { user: userInput = null } = {}) {
  const user = requireUser(userInput);
  const tripId = clean(tripIdInput);
  if (!tripId) throw new Error("Missing tripId");
  const memberSnap = await getDoc(doc(db, "trips", tripId, "members", user.uid));
  const role = memberSnap.exists() ? clean(memberSnap.data()?.role) : null;
  if (!VALID_REPLACE_ROLES.has(role)) {
    const error = new Error("Owner or Admin role required");
    error.code = "insufficient-role";
    throw error;
  }
  const shouldArchive = archived === true;
  const batch = writeBatch(db);
  batch.set(doc(db, "trips", tripId), {
    archived: shouldArchive,
    archivedAt: shouldArchive ? serverTimestamp() : null,
    archivedBy: shouldArchive ? user.uid : "",
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  }, { merge: true });
  batch.set(doc(collection(db, "trips", tripId, "activityLogs")), {
    type: shouldArchive ? "trip.archive" : "trip.restore",
    actorUid: user.uid,
    actorName: clean(user.displayName),
    createdAt: serverTimestamp()
  });
  await batch.commit();
  return { tripId, archived: shouldArchive };
}
