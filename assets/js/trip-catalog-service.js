import { db } from "./firebase-service.js";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where
} from "./firestore-observed-service.js";

function clean(value) { return String(value ?? "").trim(); }

function localIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function effectiveTripStatus(storedStatus, startDate, endDate) {
  const stored = clean(storedStatus).toLowerCase();
  if (stored === "draft") return "draft";
  const start = clean(startDate);
  const end = clean(endDate);
  const today = localIsoDate();
  if (start && today < start) return "upcoming";
  if (end && today > end) return "completed";
  if ((start && today >= start) || (end && today <= end)) return "active";
  return stored || "upcoming";
}

function normalizeTripDoc(snapshot) {
  const data = snapshot.data() || {};
  return {
    tripId: snapshot.id,
    schemaVersion: Number(data.schemaVersion) || 0,
    revision: Number(data.revision) || 0,
    title: clean(data.title || data.titleSmall || snapshot.id),
    titleSmall: clean(data.titleSmall),
    dateRange: clean(data.dateRange),
    startDate: clean(data.startDate),
    endDate: clean(data.endDate),
    status: effectiveTripStatus(data.status, data.startDate, data.endDate),
    archived: data.archived === true,
    archivedAt: data.archivedAt || null,
    archivedBy: clean(data.archivedBy),
    importState: clean(data.importState || "ready"),
    coverImage: clean(data.coverImage),
    tripIcon: clean(data.tripIcon),
    backgroundImage: clean(data.backgroundImage),
    updatedAt: data.updatedAt || null,
    createdBy: clean(data.createdBy),
    memberCount: Number(data.memberCount) || 0,
    role: null
  };
}

async function attachRoles(trips, uid) {
  if (!uid || !trips.length) return trips;
  return Promise.all(trips.map(async trip => {
    try {
      const member = await getDoc(doc(db, "trips", trip.tripId, "members", uid));
      const role = member.exists() ? clean(member.data()?.role) : null;
      return { ...trip, role: role || null };
    } catch (error) {
      return { ...trip, role: null };
    }
  }));
}

export function subscribeUserTrips(user, callback, { archived = false } = {}) {
  if (typeof callback !== "function") return () => {};
  const uid = clean(user?.uid);
  if (!uid) {
    callback({ status: "signed-out", trips: [], error: null });
    return () => {};
  }

  callback({ status: "loading", trips: [], error: null });
  // Active and archived trips are deliberately separate queries. Archived trips
  // are only subscribed when the archive UI is explicitly opened.
  const tripsQuery = query(
    collection(db, "trips"),
    where("memberUids", "array-contains", uid),
    where("archived", "==", archived === true)
  );
  let runId = 0;
  let lastTrips = null;
  let serverConfirmed = false;

  return onSnapshot(tripsQuery, { includeMetadataChanges: true }, snapshot => {
    const thisRun = ++runId;
    const fromCache = snapshot.metadata?.fromCache === true;
    if (!fromCache) serverConfirmed = true;

    // Metadata-only cache → server confirmation must not repeat the per-Trip
    // member role reads. Reuse the last normalized rows when document content
    // did not change; this keeps the new entry gate authoritative without
    // undoing the Phase 2F read optimisation.
    let contentChanged = lastTrips === null;
    if (!contentChanged) {
      try { contentChanged = snapshot.docChanges({ includeMetadataChanges: false }).length > 0; }
      catch (error) { contentChanged = true; }
    }

    if (!contentChanged && lastTrips) {
      callback({ status: "ready", trips: lastTrips.map(trip => ({ ...trip })), error: null, fromCache, serverConfirmed });
      return;
    }

    const base = snapshot.docs.map(normalizeTripDoc);
    attachRoles(base, uid).then(trips => {
      if (thisRun !== runId) return;
      trips.sort((a, b) => {
        const ad = a.startDate || "9999-99-99";
        const bd = b.startDate || "9999-99-99";
        return ad.localeCompare(bd) || a.title.localeCompare(b.title);
      });
      lastTrips = trips.map(trip => ({ ...trip }));
      callback({ status: "ready", trips, error: null, fromCache, serverConfirmed });
    });
  }, error => {
    callback({ status: error?.code === "permission-denied" ? "rules-pending" : (error?.code === "failed-precondition" ? "index-required" : "error"), trips: [], error, fromCache: false, serverConfirmed: false });
  });
}
