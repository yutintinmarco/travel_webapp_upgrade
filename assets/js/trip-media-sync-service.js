/*
 * v7.9.3.7 · Phase 3A Local-First Media Sync Queue + Itinerary Image
 *
 * Local commit happens first: compressed display / thumbnail Blobs are stored
 * in IndexedDB under their final Storage paths and a durable metadata-only job
 * is queued. Cloud commit then runs in the foreground whenever possible.
 * iOS may suspend a PWA at any time, so every unfinished job is resumable after
 * foreground, reconnect or a full relaunch.
 */

import { db } from "./firebase-service.js";
import { getCurrentUser, waitForInitialAuth } from "./auth-service.js";
import {
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  writeBatch
} from "./firestore-observed-service.js";
import { removeTripMediaCache } from "./trip-media-cache-service.js";
import {
  TRIP_MEDIA_OWNER_TYPES,
  deleteTripMedia,
  prepareTripImageLocalAsset,
  uploadPreparedTripImage
} from "./trip-media-service.js?release=7.9.3.7";

const MEDIA_SYNC_DB = "travel-trip-media-sync-v1";
const MEDIA_SYNC_STORE = "jobs";
const MEDIA_SYNC_DB_VERSION = 1;
let mediaSyncDatabasePromise = null;
function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}
function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
  });
}
function openMediaSyncDatabase() {
  if (mediaSyncDatabasePromise) return mediaSyncDatabasePromise;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  mediaSyncDatabasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_SYNC_DB, MEDIA_SYNC_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(MEDIA_SYNC_STORE)) {
        const store = database.createObjectStore(MEDIA_SYNC_STORE, { keyPath: "jobId" });
        store.createIndex("tripId", "tripId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open media sync queue"));
  }).catch(error => {
    console.warn("Trip media sync queue unavailable", error);
    return null;
  });
  return mediaSyncDatabasePromise;
}
async function putTripMediaPendingJob(jobInput) {
  const job = { ...(jobInput || {}) }, jobId = clean(job.jobId), tripId = clean(job.tripId);
  if (!jobId || !tripId) return false;
  const database = await openMediaSyncDatabase();
  if (!database) return false;
  try {
    const transaction = database.transaction(MEDIA_SYNC_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(MEDIA_SYNC_STORE).put({ ...job, jobId, tripId, updatedAt: finiteNumber(job.updatedAt, Date.now()) });
    await done;
    return true;
  } catch (error) {
    console.warn("Unable to persist Trip media sync job", error);
    return false;
  }
}
async function getTripMediaPendingJobs({ tripId = "" } = {}) {
  const database = await openMediaSyncDatabase();
  if (!database) return [];
  try {
    const transaction = database.transaction(MEDIA_SYNC_STORE, "readonly");
    const done = transactionDone(transaction), store = transaction.objectStore(MEDIA_SYNC_STORE);
    const safeTripId = clean(tripId);
    const records = safeTripId ? await requestPromise(store.index("tripId").getAll(safeTripId)) : await requestPromise(store.getAll());
    await done;
    return (records || []).map(record => ({ ...record })).sort((a,b) => finiteNumber(a.createdAt) - finiteNumber(b.createdAt));
  } catch (error) {
    console.warn("Unable to read Trip media sync jobs", error);
    return [];
  }
}
async function removeTripMediaPendingJob(jobIdInput) {
  const jobId = clean(jobIdInput);
  if (!jobId) return false;
  const database = await openMediaSyncDatabase();
  if (!database) return false;
  try {
    const transaction = database.transaction(MEDIA_SYNC_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(MEDIA_SYNC_STORE).delete(jobId);
    await done;
    return true;
  } catch (error) {
    console.warn("Unable to remove Trip media sync job", error);
    return false;
  }
}

const MANAGER_ROLES = new Set(["owner", "admin"]);
const BLOCKING_STATES = new Set(["queued", "uploading", "uploaded", "attaching", "failed"]);
const SETTLED_GRACE_MS = 15 * 1000;
const progressMemory = new Map();
let runtimeStarted = false;
let flushPromise = null;
let flushTimer = 0;
let flushTimerDueAt = 0;
let lastSnapshot = { jobs: [], pendingByTrip: {}, overlays: {}, updatedAt: 0 };

function clean(value) { return String(value ?? "").trim(); }
function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function nowJobId(slot = "media") {
  try {
    if (globalThis.crypto?.randomUUID) return `mjob_${clean(slot)}_${crypto.randomUUID().replace(/-/g, "")}`;
  } catch (error) {}
  return `mjob_${clean(slot)}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
function errorWithCode(message, code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}
function plainDescriptor(record = {}) {
  const mediaId = clean(record.mediaId || record.imageId);
  const descriptor = {
    imageId: mediaId,
    mediaId,
    mediaSchemaVersion: Math.max(1, finiteNumber(record.mediaSchemaVersion, 1)),
    source: "storage",
    tripId: clean(record.tripId),
    ownerType: clean(record.ownerType),
    ownerId: clean(record.ownerId),
    slot: clean(record.slot),
    storagePath: clean(record.storagePath),
    thumbnailStoragePath: clean(record.thumbnailStoragePath),
    contentType: clean(record.contentType),
    byteSize: finiteNumber(record.byteSize),
    width: finiteNumber(record.width),
    height: finiteNumber(record.height),
    generation: clean(record.generation),
    thumbnailContentType: clean(record.thumbnailContentType),
    thumbnailByteSize: finiteNumber(record.thumbnailByteSize),
    thumbnailWidth: finiteNumber(record.thumbnailWidth),
    thumbnailHeight: finiteNumber(record.thumbnailHeight),
    thumbnailGeneration: clean(record.thumbnailGeneration),
    sortOrder: finiteNumber(record.sortOrder)
  };
  return Object.fromEntries(Object.entries(descriptor).filter(([, value]) => value !== "" && value !== 0 && value != null));
}
function recordForDelete(descriptor, tripId) {
  if (!descriptor || typeof descriptor !== "object") return null;
  const mediaId = clean(descriptor.mediaId || descriptor.imageId || descriptor.id);
  const storagePath = clean(descriptor.storagePath);
  if (!mediaId || !storagePath) return null;
  return {
    ...clone(descriptor),
    tripId: clean(descriptor.tripId || tripId),
    mediaId,
    storagePath,
    thumbnailStoragePath: clean(descriptor.thumbnailStoragePath)
  };
}
function jobBlocksBackup(job) {
  return BLOCKING_STATES.has(clean(job?.state));
}
function slotField(slot) {
  if (slot === "icon") return "tripIconMedia";
  if (slot === "background") return "backgroundImageMedia";
  return "";
}
function activityFor(slot, user, job = null) {
  const kind = clean(job?.kind);
  if (kind === "item-image") {
    return {
      type: "trip.itinerary.image_updated",
      actionType: "trip.itinerary.image_updated",
      category: "itinerary",
      title: "更新行程相片",
      summary: "行程相片已由本機背景同步至 Firebase Storage",
      actorUid: user.uid,
      actorName: clean(user.displayName),
      actorEmail: clean(user.email).toLowerCase(),
      createdAt: serverTimestamp()
    };
  }
  if (slot === "icon") {
    return {
      type: "trip.media.icon_updated",
      actionType: "trip.media.icon_updated",
      category: "itinerary",
      title: "更新旅程圖示",
      summary: "旅程圖示已由本機背景同步至 Firebase Storage",
      actorUid: user.uid,
      actorName: clean(user.displayName),
      actorEmail: clean(user.email).toLowerCase(),
      createdAt: serverTimestamp()
    };
  }
  return {
    type: "trip.media.background_updated",
    actionType: "trip.media.background_updated",
    category: "itinerary",
    title: "更新旅程背景",
    summary: "旅程背景已由本機背景同步至 Firebase Storage",
    actorUid: user.uid,
    actorName: clean(user.displayName),
    actorEmail: clean(user.email).toLowerCase(),
    createdAt: serverTimestamp()
  };
}

function fatalSyncError(error) {
  const code = clean(error?.code).toLowerCase();
  return [
    "auth-required",
    "insufficient-role",
    "permission-denied",
    "firestore/permission-denied",
    "storage/unauthorized",
    "trip-global-locked",
    "trip-deleting",
    "not-found",
    "media-local-cache-missing",
    "invalid-media-record"
  ].includes(code);
}
function backoffMs(attempts) {
  return Math.min(60 * 1000, 1500 * Math.pow(2, Math.max(0, Math.min(5, finiteNumber(attempts) - 1))));
}
function dispatch(name, detail) {
  try { globalThis.dispatchEvent(new CustomEvent(name, { detail })); } catch (error) {}
}

async function buildSnapshot() {
  const jobs = await getTripMediaPendingJobs();
  const pendingByTrip = {};
  const overlays = {};
  for (const job of jobs) {
    const tripId = clean(job.tripId);
    const slot = clean(job.slot);
    if (!tripId || !slot) continue;
    if (jobBlocksBackup(job)) pendingByTrip[tripId] = finiteNumber(pendingByTrip[tripId]) + 1;
    if (clean(job.state) === "orphan-cleanup") continue;
    const current = overlays[tripId]?.[slot];
    if (!current || finiteNumber(job.createdAt) >= finiteNumber(current.createdAt)) {
      overlays[tripId] = overlays[tripId] || {};
      overlays[tripId][slot] = {
        jobId: clean(job.jobId),
        tripId,
        slot,
        state: clean(job.state),
        descriptor: plainDescriptor(job.readyDescriptor || job.record || {}),
        createdAt: finiteNumber(job.createdAt),
        blocking: jobBlocksBackup(job),
        lastErrorCode: clean(job.lastErrorCode),
        lastErrorMessage: clean(job.lastErrorMessage)
      };
    }
  }
  lastSnapshot = { jobs: jobs.map(job => ({ ...job, progress: progressMemory.get(clean(job.jobId)) || null })), pendingByTrip, overlays, updatedAt: Date.now() };
  return lastSnapshot;
}
async function publishState(extra = {}) {
  const snapshot = await buildSnapshot();
  dispatch("trip-media-sync-state", { ...snapshot, ...extra });
  return snapshot;
}

async function persistJob(job, patch = {}) {
  const next = { ...job, ...patch, updatedAt: Date.now() };
  const ok = await putTripMediaPendingJob(next);
  if (!ok) throw errorWithCode("Unable to persist media sync job", "media-local-cache-unavailable");
  return next;
}

function itemImageSlot(dayIdInput, itemIdInput) {
  const dayId = clean(dayIdInput), itemId = clean(itemIdInput);
  return dayId && itemId ? `item:${dayId}:${itemId}` : "";
}
function managedItemImage(imagesInput = [], itemIdInput = "") {
  const itemId = clean(itemIdInput);
  const images = Array.isArray(imagesInput) ? imagesInput : [];
  return images.find(image => image && typeof image === "object"
    && clean(image.slot) === "primary"
    && (!clean(image.ownerId) || clean(image.ownerId) === itemId)
    && clean(image.storagePath)) || null;
}
function nextItemImages(imagesInput = [], descriptorInput = null, itemIdInput = "") {
  const itemId = clean(itemIdInput);
  const images = (Array.isArray(imagesInput) ? imagesInput : []).map(image => clone(image));
  const current = managedItemImage(images, itemId);
  if (!descriptorInput) {
    return images.filter(image => image !== current && !(image && typeof image === "object"
      && clean(image.slot) === "primary"
      && (!clean(image.ownerId) || clean(image.ownerId) === itemId)
      && clean(image.storagePath)));
  }
  const descriptor = { ...plainDescriptor(descriptorInput), ownerType: "item", ownerId: itemId, slot: "primary" };
  const currentIndex = images.findIndex(image => image && typeof image === "object"
    && clean(image.slot) === "primary"
    && (!clean(image.ownerId) || clean(image.ownerId) === itemId)
    && clean(image.storagePath));
  const sortOrder = currentIndex >= 0
    ? finiteNumber(images[currentIndex]?.sortOrder, currentIndex)
    : images.reduce((max, image, index) => Math.max(max, finiteNumber(image?.sortOrder, index)), -1) + 1;
  descriptor.sortOrder = sortOrder;
  if (currentIndex >= 0) images.splice(currentIndex, 1, descriptor);
  else images.push(descriptor);
  return images;
}

async function attachItemDescriptor(job, descriptor, user) {
  const tripId = clean(job.tripId), dayId = clean(job.dayId), itemId = clean(job.itemId);
  if (!tripId || !dayId || !itemId) throw errorWithCode("Invalid itinerary media job", "invalid-media-record");
  const tripRef = doc(db, "trips", tripId);
  const itemRef = doc(db, "trips", tripId, "days", dayId, "items", itemId);
  const itemSnap = await getDoc(itemRef);
  if (!itemSnap.exists()) throw errorWithCode("Itinerary item not found", "not-found");
  const item = itemSnap.data() || {};
  const previous = managedItemImage(item.images, itemId);
  const images = nextItemImages(item.images, descriptor, itemId);
  const logRef = doc(collection(db, "trips", tripId, "activityLogs"));
  const batch = writeBatch(db);
  batch.update(itemRef, {
    images,
    updatedBy: user.uid,
    updatedAt: serverTimestamp()
  });
  // Any Day / Item mutation must bump the Trip revision. The Passive Backup
  // Sync Gate relies on this invariant to validate trusted inactive-Day seeds.
  batch.update(tripRef, {
    revision: increment(1),
    updatedBy: user.uid,
    updatedAt: serverTimestamp()
  });
  batch.set(logRef, activityFor(clean(job.slot), user, job));
  await batch.commit();
  return previous;
}

async function attachAppearanceDescriptor(job, descriptor, user) {
  const tripId = clean(job.tripId);
  const field = slotField(clean(job.slot));
  if (!tripId || !field) throw errorWithCode("Unsupported appearance media slot", "invalid-media-record");
  const tripRef = doc(db, "trips", tripId);
  const generalRef = doc(db, "trips", tripId, "settings", "general");
  const tripSnap = await getDoc(tripRef);
  if (!tripSnap.exists()) throw errorWithCode("Trip not found", "not-found");
  const trip = tripSnap.data() || {};
  if (trip.deletionState === "deleting") throw errorWithCode("Trip deletion is in progress", "trip-deleting");
  if (trip.globalLocked === true) throw errorWithCode("Trip is globally locked", "trip-global-locked");
  const previous = clone(trip[field] || null);
  const logRef = doc(collection(db, "trips", tripId, "activityLogs"));
  const batch = writeBatch(db);
  batch.update(tripRef, {
    [field]: descriptor,
    updatedBy: user.uid,
    updatedAt: serverTimestamp()
  });
  batch.set(generalRef, {
    [field]: descriptor,
    updatedBy: user.uid,
    updatedAt: serverTimestamp()
  }, { merge: true });
  batch.set(logRef, activityFor(clean(job.slot), user, job));
  await batch.commit();
  return previous;
}

async function cleanLocalJobBytes(job) {
  const record = job?.record || {};
  await Promise.allSettled([
    removeTripMediaCache(clean(record.storagePath)),
    removeTripMediaCache(clean(record.thumbnailStoragePath))
  ]);
}

async function settleJob(job, patch = {}) {
  const next = await persistJob(job, {
    ...patch,
    state: "settled",
    blocking: false,
    settleUntil: Date.now() + SETTLED_GRACE_MS,
    lastErrorCode: "",
    lastErrorMessage: "",
    nextAttemptAt: 0
  });
  progressMemory.delete(clean(next.jobId));
  await publishState({ changedJobId: clean(next.jobId) });
  scheduleFlush(SETTLED_GRACE_MS + 100);
  return next;
}

async function processCleanup(job, user) {
  const previous = recordForDelete(job.previousDescriptor, job.tripId);
  const readyId = clean(job.readyDescriptor?.mediaId || job.readyDescriptor?.imageId);
  if (previous && clean(previous.mediaId) !== readyId) {
    try {
      await deleteTripMedia(previous, { user });
    } catch (error) {
      if (fatalSyncError(error)) {
        await settleJob(job, { cleanupDeferred: true, cleanupErrorCode: clean(error?.code) });
        return false;
      }
      const attempts = finiteNumber(job.attempts) + 1;
      const delay = backoffMs(attempts);
      const next = await persistJob(job, {
        state: "cleanup",
        blocking: false,
        attempts,
        lastErrorCode: clean(error?.code),
        lastErrorMessage: clean(error?.message),
        nextAttemptAt: Date.now() + delay
      });
      await publishState({ changedJobId: clean(next.jobId), cleanupDeferred: true });
      scheduleFlush(delay);
      return false;
    }
  }
  await settleJob(job);
  return true;
}

async function cancelFatalJob(job, error, user, readyDescriptor = null) {
  const uploaded = recordForDelete(readyDescriptor || job.record, job.tripId);
  let orphanCleanupNeeded = false;
  if (uploaded && user?.uid) {
    try { await deleteTripMedia(uploaded, { user }); }
    catch (cleanupError) { orphanCleanupNeeded = true; }
  }
  await cleanLocalJobBytes(job);
  progressMemory.delete(clean(job.jobId));
  if (orphanCleanupNeeded) {
    await putTripMediaPendingJob({
      ...job,
      state: "orphan-cleanup",
      blocking: false,
      orphanDescriptor: uploaded,
      readyDescriptor: null,
      previousDescriptor: null,
      lastErrorCode: clean(error?.code),
      lastErrorMessage: clean(error?.message),
      nextAttemptAt: Date.now() + 10000,
      updatedAt: Date.now()
    });
    scheduleFlush(10100);
  } else {
    await removeTripMediaPendingJob(job.jobId);
  }
  await publishState({
    changedJobId: clean(job.jobId),
    fatal: true,
    fatalJob: { tripId: clean(job.tripId), slot: clean(job.slot), code: clean(error?.code), message: clean(error?.message) }
  });
}

async function processJob(job, user) {
  const state = clean(job.state || "queued");
  if (state === "settled") {
    if (finiteNumber(job.settleUntil) <= Date.now()) {
      await removeTripMediaPendingJob(job.jobId);
      progressMemory.delete(clean(job.jobId));
      await publishState({ changedJobId: clean(job.jobId) });
    }
    return;
  }
  if (state === "cleanup") {
    await processCleanup(job, user);
    return;
  }
  if (state === "orphan-cleanup") {
    const orphan = recordForDelete(job.orphanDescriptor, job.tripId);
    if (!orphan) {
      await removeTripMediaPendingJob(job.jobId);
      await publishState({ changedJobId: clean(job.jobId) });
      return;
    }
    try {
      await deleteTripMedia(orphan, { user });
      await removeTripMediaPendingJob(job.jobId);
      await publishState({ changedJobId: clean(job.jobId) });
    } catch (error) {
      if (fatalSyncError(error)) {
        await removeTripMediaPendingJob(job.jobId);
        await publishState({ changedJobId: clean(job.jobId), orphanCleanupDeferred: true });
        return;
      }
      const attempts = finiteNumber(job.attempts) + 1;
      const delay = backoffMs(attempts);
      await persistJob(job, { attempts, nextAttemptAt: Date.now() + delay, lastErrorCode: clean(error?.code), lastErrorMessage: clean(error?.message) });
      scheduleFlush(delay + 50);
    }
    return;
  }
  if (finiteNumber(job.nextAttemptAt) > Date.now()) return;

  let current = job;
  let readyDescriptor = job.readyDescriptor ? plainDescriptor(job.readyDescriptor) : null;
  try {
    if (!readyDescriptor || !clean(readyDescriptor.generation)) {
      const attempts = finiteNumber(current.attempts) + 1;
      current = await persistJob(current, { state: "uploading", blocking: true, attempts, nextAttemptAt: 0 });
      await publishState({ changedJobId: clean(current.jobId) });
      const ready = await uploadPreparedTripImage(current.record, {
        user,
        resume: attempts > 1,
        onProgress: progress => {
          progressMemory.set(clean(current.jobId), { ...progress, updatedAt: Date.now() });
          dispatch("trip-media-sync-progress", { jobId: clean(current.jobId), tripId: clean(current.tripId), slot: clean(current.slot), progress });
        }
      });
      readyDescriptor = plainDescriptor(ready);
      current = await persistJob(current, { state: "uploaded", blocking: true, readyDescriptor, nextAttemptAt: 0 });
      await publishState({ changedJobId: clean(current.jobId) });
    }

    current = await persistJob(current, { state: "attaching", blocking: true, readyDescriptor, nextAttemptAt: 0 });
    await publishState({ changedJobId: clean(current.jobId) });
    const previous = clean(current.kind) === "item-image"
      ? await attachItemDescriptor(current, readyDescriptor, user)
      : await attachAppearanceDescriptor(current, readyDescriptor, user);
    current = await persistJob(current, {
      state: "cleanup",
      blocking: false,
      previousDescriptor: previous,
      readyDescriptor,
      nextAttemptAt: 0,
      lastErrorCode: "",
      lastErrorMessage: ""
    });
    await publishState({ changedJobId: clean(current.jobId), cloudCommitted: true });
    await processCleanup(current, user);
  } catch (error) {
    if (fatalSyncError(error)) {
      await cancelFatalJob(current, error, user, readyDescriptor);
      return;
    }
    const attempts = Math.max(1, finiteNumber(current.attempts));
    const delay = backoffMs(attempts);
    current = await persistJob(current, {
      state: readyDescriptor ? "uploaded" : "queued",
      blocking: true,
      readyDescriptor: readyDescriptor || null,
      lastErrorCode: clean(error?.code),
      lastErrorMessage: clean(error?.message),
      nextAttemptAt: Date.now() + delay
    });
    await publishState({ changedJobId: clean(current.jobId), retrying: true });
    scheduleFlush(delay + 50);
  }
}

export async function getTripMediaSyncSnapshot() {
  return buildSnapshot();
}

export async function queueTripAppearanceMedia({
  tripId: tripIdInput,
  slot: slotInput,
  file,
  user: userInput = null
} = {}) {
  const tripId = clean(tripIdInput);
  const slot = clean(slotInput).toLowerCase();
  if (!tripId || !["icon", "background"].includes(slot)) throw errorWithCode("Invalid appearance media job", "invalid-media-record");
  if (!(file instanceof Blob)) throw errorWithCode("Image file is required", "invalid-media-file");
  const user = userInput || getCurrentUser() || await waitForInitialAuth();
  if (!user?.uid) throw errorWithCode("Google sign-in required", "auth-required");
  const existing = (await getTripMediaPendingJobs({ tripId })).find(job => clean(job.slot) === slot && jobBlocksBackup(job));
  if (existing) throw errorWithCode("A media sync job is already pending", "media-sync-pending", { jobId: clean(existing.jobId) });

  const prepared = await prepareTripImageLocalAsset({
    tripId,
    ownerType: TRIP_MEDIA_OWNER_TYPES.TRIP,
    ownerId: "",
    slot,
    file
  });
  const job = {
    jobId: nowJobId(slot),
    tripId,
    slot,
    uid: user.uid,
    state: "queued",
    blocking: true,
    record: prepared.record,
    readyDescriptor: null,
    previousDescriptor: null,
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastErrorCode: "",
    lastErrorMessage: ""
  };
  const saved = await putTripMediaPendingJob(job);
  if (!saved) {
    await cleanLocalJobBytes(job);
    throw errorWithCode("Unable to save media sync job", "media-local-cache-unavailable");
  }
  await publishState({ changedJobId: job.jobId, localCommitted: true });
  scheduleFlush(80);
  return { jobId: job.jobId, descriptor: plainDescriptor(prepared.record), queued: true };
}

export async function queueTripItemMedia({
  tripId: tripIdInput,
  dayId: dayIdInput,
  itemId: itemIdInput,
  file,
  user: userInput = null
} = {}) {
  const tripId = clean(tripIdInput), dayId = clean(dayIdInput), itemId = clean(itemIdInput);
  const slot = itemImageSlot(dayId, itemId);
  if (!tripId || !dayId || !itemId || !slot) throw errorWithCode("Invalid itinerary media job", "invalid-media-record");
  if (!(file instanceof Blob)) throw errorWithCode("Image file is required", "invalid-media-file");
  const user = userInput || getCurrentUser() || await waitForInitialAuth();
  if (!user?.uid) throw errorWithCode("Google sign-in required", "auth-required");
  const existing = (await getTripMediaPendingJobs({ tripId })).find(job => clean(job.slot) === slot && jobBlocksBackup(job));
  if (existing) throw errorWithCode("An itinerary image sync job is already pending", "media-sync-pending", { jobId: clean(existing.jobId) });

  const prepared = await prepareTripImageLocalAsset({
    tripId,
    ownerType: TRIP_MEDIA_OWNER_TYPES.ITEM,
    ownerId: itemId,
    slot: "primary",
    file
  });
  prepared.record.ownerType = "item";
  prepared.record.ownerId = itemId;
  prepared.record.slot = "primary";
  const job = {
    jobId: nowJobId("item"),
    kind: "item-image",
    tripId,
    dayId,
    itemId,
    slot,
    uid: user.uid,
    state: "queued",
    blocking: true,
    record: prepared.record,
    readyDescriptor: null,
    previousDescriptor: null,
    attempts: 0,
    nextAttemptAt: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastErrorCode: "",
    lastErrorMessage: ""
  };
  const saved = await putTripMediaPendingJob(job);
  if (!saved) {
    await cleanLocalJobBytes(job);
    throw errorWithCode("Unable to save media sync job", "media-local-cache-unavailable");
  }
  await publishState({ changedJobId: job.jobId, localCommitted: true });
  scheduleFlush(80);
  return { jobId: job.jobId, descriptor: plainDescriptor(prepared.record), queued: true };
}

export async function removeTripItemMedia({
  tripId: tripIdInput,
  dayId: dayIdInput,
  itemId: itemIdInput,
  user: userInput = null
} = {}) {
  const tripId = clean(tripIdInput), dayId = clean(dayIdInput), itemId = clean(itemIdInput);
  const slot = itemImageSlot(dayId, itemId);
  if (!tripId || !dayId || !itemId) throw errorWithCode("Invalid itinerary media target", "invalid-media-record");
  const user = userInput || getCurrentUser() || await waitForInitialAuth();
  if (!user?.uid) throw errorWithCode("Google sign-in required", "auth-required");
  const pending = (await getTripMediaPendingJobs({ tripId })).find(job => clean(job.slot) === slot && jobBlocksBackup(job));
  if (pending) throw errorWithCode("The itinerary image is still syncing", "media-sync-pending", { jobId: clean(pending.jobId) });

  const itemRef = doc(db, "trips", tripId, "days", dayId, "items", itemId);
  const tripRef = doc(db, "trips", tripId);
  const itemSnap = await getDoc(itemRef);
  if (!itemSnap.exists()) throw errorWithCode("Itinerary item not found", "not-found");
  const item = itemSnap.data() || {};
  const previous = managedItemImage(item.images, itemId);
  if (!previous) return { removed: false, cleanup: { cleaned: true } };
  const images = nextItemImages(item.images, null, itemId);
  const logRef = doc(collection(db, "trips", tripId, "activityLogs"));
  const batch = writeBatch(db);
  batch.update(itemRef, { images, updatedBy: user.uid, updatedAt: serverTimestamp() });
  batch.update(tripRef, { revision: increment(1), updatedBy: user.uid, updatedAt: serverTimestamp() });
  batch.set(logRef, {
    type: "trip.itinerary.image_removed",
    actionType: "trip.itinerary.image_removed",
    category: "itinerary",
    title: "移除行程相片",
    summary: "已移除行程自訂 Firebase 相片",
    actorUid: user.uid,
    actorName: clean(user.displayName),
    actorEmail: clean(user.email).toLowerCase(),
    createdAt: serverTimestamp()
  });
  await batch.commit();
  let cleaned = true;
  try { await deleteTripMedia(recordForDelete(previous, tripId), { user }); }
  catch (error) {
    cleaned = false;
    const orphanDescriptor = recordForDelete(previous, tripId);
    if (orphanDescriptor) {
      await putTripMediaPendingJob({
        jobId: nowJobId("orphan"),
        kind: "item-image-cleanup",
        tripId, dayId, itemId, slot, uid: user.uid,
        state: "orphan-cleanup", blocking: false,
        orphanDescriptor, readyDescriptor: null, previousDescriptor: null,
        attempts: 0, nextAttemptAt: Date.now() + 10000,
        createdAt: Date.now(), updatedAt: Date.now(),
        lastErrorCode: clean(error?.code), lastErrorMessage: clean(error?.message)
      });
      scheduleFlush(10100);
    }
  }
  await publishState({ itineraryMediaRemoved: true, tripId, dayId, itemId });
  return { removed: true, previous: clone(previous), cleanup: { cleaned } };
}

export async function flushTripMediaSyncQueue() {
  if (flushPromise) return flushPromise;
  flushPromise = (async () => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await publishState({ offline: true });
      return { flushed: 0, offline: true };
    }
    const user = getCurrentUser();
    if (!user?.uid) return { flushed: 0, authPending: true };
    const jobs = await getTripMediaPendingJobs();
    let flushed = 0;
    let nearestFuture = 0;
    for (const job of jobs) {
      if (job.uid && clean(job.uid) !== clean(user.uid)) continue;
      const nextAt = finiteNumber(job.nextAttemptAt);
      if (nextAt > Date.now()) {
        nearestFuture = nearestFuture ? Math.min(nearestFuture, nextAt) : nextAt;
        continue;
      }
      await processJob(job, user);
      flushed += 1;
    }
    if (nearestFuture) scheduleFlush(Math.max(100, nearestFuture - Date.now() + 50));
    await publishState();
    return { flushed };
  })().finally(() => { flushPromise = null; });
  return flushPromise;
}

export function scheduleFlush(delayMs = 120) {
  const delay = Math.max(50, finiteNumber(delayMs, 120));
  const dueAt = Date.now() + delay;
  if (flushTimer && flushTimerDueAt && dueAt >= flushTimerDueAt) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimerDueAt = dueAt;
  flushTimer = setTimeout(() => {
    flushTimer = 0;
    flushTimerDueAt = 0;
    flushTripMediaSyncQueue().catch(error => console.warn("Trip media background sync", error));
  }, delay);
}

export async function startTripMediaSyncRuntime() {
  if (!runtimeStarted) {
    runtimeStarted = true;
    globalThis.addEventListener?.("online", () => scheduleFlush(100));
    document?.addEventListener?.("visibilitychange", () => {
      if (document.visibilityState === "visible") scheduleFlush(120);
    });
    globalThis.addEventListener?.("focus", () => scheduleFlush(120));
  }
  await publishState();
  scheduleFlush(250);
  waitForInitialAuth().then(user => { if (user?.uid) scheduleFlush(100); }).catch(() => {});
  return lastSnapshot;
}
