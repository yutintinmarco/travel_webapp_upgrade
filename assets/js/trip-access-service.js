import { db } from "./firebase-service.js";
import { subscribeAuthState } from "./auth-service.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

export const TRIP_ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
  VIEWER: "viewer"
});

const ROLE_RANK = Object.freeze({ viewer: 1, member: 2, admin: 3, owner: 4 });
const ROLE_LABELS = Object.freeze({ owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" });

let activeTripId = "";
let currentAccess = { tripId: "", role: null, signedIn: false, source: "none", ready: false };
let stopMember = null;
let stopAuth = null;
let latestMemberData = null;
let latestUser = null;

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
    ready: !!activeTripId
  };
  window.__appTripAccess = { ...currentAccess };
  window.dispatchEvent(new CustomEvent("app-trip-access", { detail: { ...currentAccess } }));
}

function resetMemberListener() {
  if (stopMember) stopMember();
  stopMember = null;
  latestMemberData = null;
}

function attachMemberListener() {
  resetMemberListener();
  if (!activeTripId || !latestUser?.uid) {
    computeAccess();
    return;
  }

  stopMember = onSnapshot(doc(db, "trips", activeTripId, "members", latestUser.uid), snapshot => {
    latestMemberData = snapshot.exists() ? snapshot.data() : null;
    computeAccess();
  }, error => {
    latestMemberData = null;
    if (error?.code !== "permission-denied") console.warn("Trip member access listener", error);
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

export function hasTripRole(minimumRole = TRIP_ROLES.VIEWER) {
  const currentRank = ROLE_RANK[currentAccess.role] || 0;
  const requiredRank = ROLE_RANK[minimumRole] || Infinity;
  return currentRank >= requiredRank;
}

export function isOwner() { return currentAccess.role === TRIP_ROLES.OWNER; }
export function isAdminOrOwner() { return hasTripRole(TRIP_ROLES.ADMIN); }
export function isMemberOrAbove() { return hasTripRole(TRIP_ROLES.MEMBER); }
export function getRoleLabel(role = currentAccess.role) { return ROLE_LABELS[role] || ""; }
