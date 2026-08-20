import { db } from "./firebase-service.js";
import { subscribeAuthState } from "./auth-service.js";
import { doc, onSnapshot } from "./firestore-observed-service.js";

export const TRIP_ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
  VIEWER: "viewer"
});

const ROLE_RANK = Object.freeze({ viewer: 1, member: 2, admin: 3, owner: 4 });
const ROLE_LABELS = Object.freeze({ owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" });

let activeTripId = "";
let currentAccess = { tripId: "", role: null, signedIn: false, source: "none", ready: false, fromCache: false, serverConfirmed: false };
let stopMember = null;
let stopAuth = null;
let latestMemberData = null;
let latestUser = null;
let memberResolved = false;
let memberFromCache = false;
let memberServerConfirmed = false;
const subscribers = new Set();

function validRole(value) {
  return Object.values(TRIP_ROLES).includes(value) ? value : null;
}

function computeAccess() {
  const memberRole = validRole(latestMemberData?.role);
  const role = latestUser ? memberRole : null;
  currentAccess = {
    tripId: activeTripId,
    role,
    roleLabel: role ? ROLE_LABELS[role] : "",
    signedIn: !!latestUser,
    source: memberRole ? "member-doc" : (latestUser ? "no-membership" : "signed-out"),
    ready: !activeTripId || !latestUser || memberResolved,
    fromCache: memberFromCache,
    serverConfirmed: memberServerConfirmed
  };
  const snapshot = { ...currentAccess };
  window.__appTripAccess = snapshot;
  window.dispatchEvent(new CustomEvent("app-trip-access", { detail: snapshot }));
  subscribers.forEach(callback => {
    try { callback(snapshot); } catch (error) { console.error("Trip access subscriber", error); }
  });
}

function resetMemberListener({ preserveState = false } = {}) {
  if (stopMember) stopMember();
  stopMember = null;
  if (preserveState) return;
  latestMemberData = null;
  memberResolved = false;
  memberFromCache = false;
  memberServerConfirmed = false;
}

function attachMemberListener({ preserveState = false } = {}) {
  resetMemberListener({ preserveState });
  if (!activeTripId || !latestUser?.uid) {
    computeAccess();
    return;
  }

  stopMember = onSnapshot(doc(db, "trips", activeTripId, "members", latestUser.uid), { includeMetadataChanges: true }, snapshot => {
    memberResolved = true;
    memberFromCache = snapshot.metadata?.fromCache === true;
    if (!memberFromCache) memberServerConfirmed = true;
    latestMemberData = snapshot.exists() ? snapshot.data() : null;
    computeAccess();
  }, error => {
    memberResolved = true;
    memberFromCache = false;
    // Only an explicit permission-denied response is an authoritative revoke.
    // A transient online/network listener error must never throw away a usable
    // local Trip just because the device happens to be connected to Wi-Fi.
    const denied = error?.code === "permission-denied";
    memberServerConfirmed = denied;
    if (denied) latestMemberData = null;
    else console.warn("Trip member access listener", error);
    computeAccess();
  });
}

export function initTripAccess(tripId) {
  const nextTripId = String(tripId || "").trim();
  if (activeTripId === nextTripId && stopAuth) return;
  activeTripId = nextTripId;
  resetMemberListener();
  if (stopAuth) stopAuth();
  stopAuth = subscribeAuthState(user => {
    latestUser = user || null;
    attachMemberListener();
  });
  computeAccess();
}

export function getTripAccess() {
  return { ...currentAccess };
}

export function subscribeTripAccess(callback, { immediate = true } = {}) {
  if (typeof callback !== "function") return () => {};
  subscribers.add(callback);
  if (immediate) callback({ ...currentAccess });
  return () => subscribers.delete(callback);
}

export function isTripAccessVerified({ allowCachedOffline = true } = {}) {
  if (!currentAccess.role) return false;
  if (currentAccess.serverConfirmed) return true;
  return allowCachedOffline && navigator.onLine === false && currentAccess.fromCache;
}

export function hasTripRole(minimumRole = TRIP_ROLES.VIEWER) {
  const currentRank = ROLE_RANK[currentAccess.role] || 0;
  const requiredRank = ROLE_RANK[minimumRole] || Infinity;
  return currentRank >= requiredRank;
}

export function isOwner() { return currentAccess.role === TRIP_ROLES.OWNER; }
export function isAdminOrOwner() { return hasTripRole(TRIP_ROLES.ADMIN); }
export function isMemberOrAbove() { return hasTripRole(TRIP_ROLES.MEMBER); }
export function getRoleLabel(role = currentAccess.role) { return ROLE_LABELS[role] || ""; }

export function refreshTripAccess() {
  // Preserve the last verified access while the replacement listener attaches.
  // This avoids a transient no-role frame during iOS cold-start refreshes; an
  // authoritative server denial still clears access on the next callback.
  attachMemberListener({ preserveState: true });
  computeAccess();
}
