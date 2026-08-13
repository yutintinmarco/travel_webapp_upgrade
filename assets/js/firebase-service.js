import { firebaseConfig } from "./firebase-config.js";
import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

// Phase 2E: keep the most recently used Firestore data in IndexedDB so a trusted
// device can render cached trip data quickly and continue reading while offline.
// Safari / Chrome / Firefox support this mode. If persistence is unavailable
// (private mode, unsupported browser, storage restriction), fall back to the
// normal in-memory Firestore client without blocking the app.
let db;
let firestorePersistence = "memory";
try {
  db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
  firestorePersistence = "persistent";
} catch (error) {
  console.warn("Persistent Firestore cache unavailable; using memory cache", error);
  db = getFirestore(firebaseApp);
}

window.__firestorePersistence = firestorePersistence;

export { firebaseApp, auth, db, firebaseConfig, firestorePersistence };
