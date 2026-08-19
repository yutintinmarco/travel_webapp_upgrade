import { firebaseConfig } from "./firebase-config.js";
import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  disableNetwork,
  enableNetwork
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

// v7.7.7.2 · iOS PWA export-resume recovery.
// After Safari hands a generated file to the system download UI, the existing
// Firestore transport can occasionally remain alive but stop completing new
// explicit reads until the PWA process is restarted. Cycling Firestore's
// network state is the supported SDK-level way to rebuild those transports
// while keeping the same app, cache, references and realtime listeners.
let firestoreNetworkRecoveryPromise = null;
async function recoverFirestoreNetwork() {
  if (firestoreNetworkRecoveryPromise) return firestoreNetworkRecoveryPromise;
  firestoreNetworkRecoveryPromise = (async () => {
    const startedAt = Date.now();
    await disableNetwork(db);
    await enableNetwork(db);
    try {
      window.dispatchEvent(new CustomEvent("app-firestore-network-recovered", {
        detail: { at: Date.now(), durationMs: Date.now() - startedAt }
      }));
    } catch (error) {}
    return true;
  })().finally(() => { firestoreNetworkRecoveryPromise = null; });
  return firestoreNetworkRecoveryPromise;
}

export { firebaseApp, auth, db, firebaseConfig, firestorePersistence, recoverFirestoreNetwork };
