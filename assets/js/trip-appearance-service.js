import { db } from "./firebase-service.js";
import { getCurrentUser, waitForInitialAuth } from "./auth-service.js";
import { assertCloudOperationAvailable } from "./cloud-safety-service.js";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch
} from "./firestore-observed-service.js";

const MANAGER_ROLES = new Set(["owner", "admin"]);
const FEATURE_KEYS = new Set(["savedPlaces", "expenses"]);

function clean(value) { return String(value ?? "").trim(); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function normalizeHex(value) {
  const raw = clean(value).toUpperCase();
  return /^#[0-9A-F]{6}$/.test(raw) ? raw : "";
}

async function requireUser(input = null) {
  const user = input || getCurrentUser() || await waitForInitialAuth();
  if (!user?.uid) {
    const error = new Error("Google sign-in required");
    error.code = "auth-required";
    throw error;
  }
  return user;
}

async function requireManager(tripId, user) {
  const memberSnap = await getDoc(doc(db, "trips", tripId, "members", user.uid));
  const role = memberSnap.exists() ? clean(memberSnap.data()?.role).toLowerCase() : "";
  if (!MANAGER_ROLES.has(role)) {
    const error = new Error("Insufficient role");
    error.code = "insufficient-role";
    error.role = role;
    throw error;
  }
  return role;
}

function activityPayload({ user, type, title, summary, feature = "", color = "" }) {
  return {
    type,
    actionType: type,
    category: "itinerary",
    title,
    summary,
    actorUid: user.uid,
    actorName: clean(user.displayName),
    actorEmail: clean(user.email).toLowerCase(),
    feature,
    color,
    createdAt: serverTimestamp()
  };
}

export async function updateTripAccentColor(tripIdInput, colorInput, { user: userInput = null } = {}) {
  const tripId = clean(tripIdInput);
  const color = normalizeHex(colorInput);
  const user = await requireUser(userInput);
  assertCloudOperationAvailable("旅程主色設定");
  if (!tripId) {
    const error = new Error("Missing trip");
    error.code = "invalid-trip";
    throw error;
  }
  if (!color) {
    const error = new Error("Invalid colour");
    error.code = "invalid-colour";
    throw error;
  }
  await requireManager(tripId, user);
  const tripRef = doc(db, "trips", tripId);
  const logRef = doc(collection(db, "trips", tripId, "activityLogs"));
  const batch = writeBatch(db);
  batch.update(tripRef, {
    accentColor: color,
    updatedBy: user.uid,
    updatedAt: serverTimestamp()
  });
  batch.set(logRef, activityPayload({
    user,
    type: "trip.appearance.accent_updated",
    title: "更新旅程主色",
    summary: `旅程主色已更新為 ${color}`,
    color
  }));
  await batch.commit();
  return { tripId, color };
}

export async function updateFeatureColor(tripIdInput, featureInput, colorInput, { user: userInput = null } = {}) {
  const tripId = clean(tripIdInput);
  const feature = clean(featureInput);
  const color = normalizeHex(colorInput);
  const user = await requireUser(userInput);
  assertCloudOperationAvailable("功能顏色設定");
  if (!tripId || !FEATURE_KEYS.has(feature)) {
    const error = new Error("Invalid feature");
    error.code = "invalid-feature";
    throw error;
  }
  if (!color) {
    const error = new Error("Invalid colour");
    error.code = "invalid-colour";
    throw error;
  }
  await requireManager(tripId, user);
  const generalRef = doc(db, "trips", tripId, "settings", "general");
  const generalSnap = await getDoc(generalRef);
  const generalData = generalSnap.exists() ? (generalSnap.data() || {}) : {};
  const featureColors = generalData?.featureColors && typeof generalData.featureColors === "object"
    ? clone(generalData.featureColors)
    : {};
  featureColors[feature] = color;
  const label = feature === "savedPlaces" ? "收藏" : "支出";
  const logRef = doc(collection(db, "trips", tripId, "activityLogs"));
  const batch = writeBatch(db);
  batch.set(generalRef, {
    featureColors,
    updatedBy: user.uid,
    updatedAt: serverTimestamp()
  }, { merge: true });
  batch.set(logRef, activityPayload({
    user,
    type: "trip.appearance.feature_color_updated",
    title: `更新${label}顏色`,
    summary: `${label}已改用自訂顏色 ${color}`,
    feature,
    color
  }));
  await batch.commit();
  return { tripId, feature, color, followsTrip: false };
}

export async function resetFeatureColor(tripIdInput, featureInput, { user: userInput = null } = {}) {
  const tripId = clean(tripIdInput);
  const feature = clean(featureInput);
  const user = await requireUser(userInput);
  assertCloudOperationAvailable("功能顏色設定");
  if (!tripId || !FEATURE_KEYS.has(feature)) {
    const error = new Error("Invalid feature");
    error.code = "invalid-feature";
    throw error;
  }
  await requireManager(tripId, user);
  const generalRef = doc(db, "trips", tripId, "settings", "general");
  const generalSnap = await getDoc(generalRef);
  const generalData = generalSnap.exists() ? (generalSnap.data() || {}) : {};
  const featureColors = generalData?.featureColors && typeof generalData.featureColors === "object"
    ? clone(generalData.featureColors)
    : {};
  delete featureColors[feature];
  const label = feature === "savedPlaces" ? "收藏" : "支出";
  const logRef = doc(collection(db, "trips", tripId, "activityLogs"));
  const batch = writeBatch(db);
  batch.set(generalRef, {
    featureColors,
    updatedBy: user.uid,
    updatedAt: serverTimestamp()
  }, { merge: true });
  batch.set(logRef, activityPayload({
    user,
    type: "trip.appearance.feature_color_updated",
    title: `更新${label}顏色`,
    summary: `${label}已恢復跟隨旅程主色`,
    feature,
    color: ""
  }));
  await batch.commit();
  return { tripId, feature, color: "", followsTrip: true };
}
