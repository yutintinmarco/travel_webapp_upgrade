import { auth, db } from "./firebase-service.js";
import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  doc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

let currentUser = auth.currentUser || null;
let authReady = false;
let resolveInitialAuth;
const initialAuthPromise = new Promise(resolve => { resolveInitialAuth = resolve; });
const subscribers = new Set();

function publicUser(user) {
  return user ? {
    uid: user.uid || "",
    displayName: user.displayName || "",
    email: user.email || "",
    photoURL: user.photoURL || ""
  } : null;
}

function dispatchAuthState(user) {
  const safeUser = publicUser(user);
  window.__appAuthUser = safeUser;
  window.dispatchEvent(new CustomEvent("app-auth-state", { detail: { user: safeUser } }));
  subscribers.forEach(callback => {
    try { callback(user, safeUser); } catch (error) { console.error("Auth subscriber error", error); }
  });
}

async function ensureUserProfile(user) {
  if (!user?.uid) return;
  try {
    await setDoc(doc(db, "users", user.uid), {
      displayName: user.displayName || "",
      email: String(user.email || "").trim().toLowerCase(),
      photoURL: user.photoURL || "",
      lastSeenAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    // Existing Phase 1 rules may not allow /users yet. Phase 2F will deploy the new rules.
    if (error?.code !== "permission-denied") console.warn("Unable to update user profile", error);
  }
}

onAuthStateChanged(auth, user => {
  currentUser = user || null;
  ensureUserProfile(user);
  dispatchAuthState(user);
  if (!authReady) {
    authReady = true;
    resolveInitialAuth(user || null);
  }
});

getRedirectResult(auth).catch(error => {
  console.error("Google redirect login error:", error?.code, error?.message, error);
  window.dispatchEvent(new CustomEvent("app-auth-error", { detail: { error } }));
});

export function subscribeAuthState(callback, { immediate = true } = {}) {
  if (typeof callback !== "function") return () => {};
  subscribers.add(callback);
  if (immediate && authReady) callback(currentUser, publicUser(currentUser));
  return () => subscribers.delete(callback);
}

export function getCurrentUser() {
  return currentUser;
}

export function getPublicCurrentUser() {
  return publicUser(currentUser);
}

export function waitForInitialAuth() {
  return authReady ? Promise.resolve(currentUser) : initialAuthPromise;
}

export async function signInWithGoogle() {
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    const redirectCodes = new Set([
      "auth/popup-blocked",
      "auth/cancelled-popup-request",
      "auth/operation-not-supported-in-this-environment"
    ]);
    if (redirectCodes.has(error?.code)) {
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
}

export function signOutCurrentUser() {
  try { localStorage.removeItem("travel_last_auth_uid"); } catch (error) {}
  return signOut(auth);
}

export { auth, db, publicUser };
