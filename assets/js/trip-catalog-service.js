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

  return onSnapshot(tripsQuery, snapshot => {
    const thisRun = ++runId;
    const base = snapshot.docs.map(normalizeTripDoc);
    attachRoles(base, uid).then(trips => {
      if (thisRun !== runId) return;
      trips.sort((a, b) => {
        const ad = a.startDate || "9999-99-99";
        const bd = b.startDate || "9999-99-99";
        return ad.localeCompare(bd) || a.title.localeCompare(b.title);
      });
      callback({ status: "ready", trips, error: null });
    });
  }, error => {
    callback({ status: error?.code === "permission-denied" ? "rules-pending" : (error?.code === "failed-precondition" ? "index-required" : "error"), trips: [], error });
  });
}
