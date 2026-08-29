/*
 * v7.9.18.0 · Shared Airline Logo Registry
 *
 * Airline logos are shared app assets rather than Trip media. Upload a logo to
 * Firebase Storage at app-assets/airlines/{IATA}.png (for example CX.png).
 * The client reads the image with the signed-in Firebase Storage SDK, creates a
 * short-lived local object URL, and caches it for the current app session.
 */
import { firebaseApp } from "./firebase-service.js";
import { getBlob, getStorage, ref } from "https://www.gstatic.com/firebasejs/11.8.0/firebase-storage.js";

const storage = getStorage(firebaseApp);
const promiseCache = new Map();
const objectUrls = new Set();
const EXTENSIONS = ["png", "webp", "jpg", "jpeg", "svg"];

function clean(value) { return String(value ?? "").trim(); }

export function airlineCodeFromFlightNumber(value = "") {
  const match = clean(value).toUpperCase().match(/^([A-Z0-9]{2})(?=\s*\d)/);
  return match ? match[1] : "";
}

export function normalizeAirlineCode(codeInput = "", flightNumber = "") {
  const direct = clean(codeInput).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (direct || airlineCodeFromFlightNumber(flightNumber)).slice(0, 3);
}

async function fetchLogoObjectUrl(code) {
  for (const ext of EXTENSIONS) {
    try {
      const blob = await getBlob(ref(storage, `app-assets/airlines/${code}.${ext}`), 2 * 1024 * 1024);
      const url = URL.createObjectURL(blob);
      objectUrls.add(url);
      return url;
    } catch (error) {
      const codeValue = String(error?.code || "");
      if (codeValue.includes("unauthorized")) throw error;
    }
  }
  return "";
}

export async function resolveAirlineLogo({ airlineCode = "", flightNumber = "", fallbackUrl = "" } = {}) {
  const code = normalizeAirlineCode(airlineCode, flightNumber);
  if (!code) return clean(fallbackUrl);
  if (!promiseCache.has(code)) promiseCache.set(code, fetchLogoObjectUrl(code).catch(() => ""));
  const firebaseUrl = await promiseCache.get(code);
  if (firebaseUrl) return firebaseUrl;
  if (clean(fallbackUrl)) return clean(fallbackUrl);
  if (code === "CX") return "assets/icon/cx_logo.png";
  return "";
}

export function clearAirlineLogoSessionCache() {
  objectUrls.forEach(url => { try { URL.revokeObjectURL(url); } catch (_) {} });
  objectUrls.clear();
  promiseCache.clear();
}
