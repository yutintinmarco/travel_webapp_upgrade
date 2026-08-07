import { firebaseConfig } from "./firebase-config.js";
import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-firestore.js";

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

export { firebaseApp, auth, db, firebaseConfig };
