const DB_NAME = "travel-webapp-render-cache";
const DB_VERSION = 1;
const STORE_NAME = "tripRenderCache";
const MAX_TRIPS_PER_USER = 6;

function clean(value) { return String(value ?? "").trim(); }
function cacheKey(uid, tripId) { return `${clean(uid)}::${clean(tripId)}`; }

function openDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      const error = new Error("IndexedDB unavailable");
      error.code = "indexeddb-unavailable";
      reject(error);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("uid", "uid", { unique: false });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open render cache"));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

function validTripData(data, tripId) {
  if (!data || typeof data !== "object") return false;
  const id = clean(data.tripId || data?.meta?.tripId || data?.meta?.expenses?.tripId);
  return !!id && id === clean(tripId) && Array.isArray(data.days);
}

async function pruneUserCache(db, uid) {
  // Keep Safari happy by never awaiting and then trying to reuse the same
  // IndexedDB transaction; WebKit may auto-close it between promise turns.
  const readTx = db.transaction(STORE_NAME, "readonly");
  const rows = await requestResult(readTx.objectStore(STORE_NAME).index("uid").getAll(clean(uid)));
  const sorted = (Array.isArray(rows) ? rows : []).sort((a, b) => Number(b?.savedAt || 0) - Number(a?.savedAt || 0));
  const stale = sorted.slice(MAX_TRIPS_PER_USER).filter(row => row?.key);
  if (!stale.length) return;
  const deleteTx = db.transaction(STORE_NAME, "readwrite");
  const store = deleteTx.objectStore(STORE_NAME);
  stale.forEach(row => store.delete(row.key));
  await transactionDone(deleteTx);
}

export async function readTripRenderCache(uidInput, tripIdInput) {
  const uid = clean(uidInput);
  const tripId = clean(tripIdInput);
  if (!uid || !tripId) return null;
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const record = await requestResult(tx.objectStore(STORE_NAME).get(cacheKey(uid, tripId)));
    if (!record || !validTripData(record.data, tripId)) return null;
    return {
      data: record.data,
      tripId,
      uid,
      revision: Number(record.revision) || Number(record.data?.revision) || 0,
      savedAt: Number(record.savedAt) || 0
    };
  } finally {
    try { db?.close(); } catch (error) {}
  }
}

export async function writeTripRenderCache(uidInput, tripIdInput, data) {
  const uid = clean(uidInput);
  const tripId = clean(tripIdInput);
  if (!uid || !tripId || !validTripData(data, tripId)) return false;
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      key: cacheKey(uid, tripId),
      uid,
      tripId,
      revision: Number(data?.revision) || 0,
      savedAt: Date.now(),
      data
    });
    await transactionDone(tx);
    await pruneUserCache(db, uid);
    return true;
  } catch (error) {
    // Render cache is an acceleration layer only. Firestore remains the source
    // of truth, so cache quota/private-mode failures must never block the app.
    console.warn("Trip render cache write skipped", error);
    return false;
  } finally {
    try { db?.close(); } catch (error) {}
  }
}

export async function deleteTripRenderCache(uidInput, tripIdInput) {
  const uid = clean(uidInput);
  const tripId = clean(tripIdInput);
  if (!uid || !tripId) return false;
  let db;
  try {
    db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(cacheKey(uid, tripId));
    await transactionDone(tx);
    return true;
  } catch (error) {
    console.warn("Trip render cache delete skipped", error);
    return false;
  } finally {
    try { db?.close(); } catch (error) {}
  }
}
