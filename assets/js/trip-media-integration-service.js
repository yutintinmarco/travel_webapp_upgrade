/*
 * v7.9.1.0 · Phase 3A.2 Existing Media Integration
 *
 * Read-path bridge between the existing Travel WebApp renderers and the
 * Phase 3A Storage foundation. Existing static/remote media remains valid.
 * Storage-backed descriptors are resolved to short-lived Blob URLs via the
 * IndexedDB media cache without changing the existing UI grammar.
 */

import { getTripMediaBlob } from "./trip-media-service.js";

const objectUrls = new Map();
const inflight = new Map();
let bindToken = 0;

function clean(value) { return String(value ?? "").trim(); }
function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeTripMediaDescriptor(input, { tripId = "", sortOrder = 0 } = {}) {
  if (!input) return null;
  if (typeof input === "string") {
    const src = clean(input);
    if (!src) return null;
    return {
      source: src.startsWith("assets/") ? "static" : "remote",
      src,
      tripId: clean(tripId),
      sortOrder: finiteNumber(sortOrder)
    };
  }
  if (typeof input !== "object" || Array.isArray(input)) return null;
  const storagePath = clean(input.storagePath);
  const src = clean(input.src || input.url || input.path);
  if (!storagePath && !src) return null;
  const descriptor = {
    ...input,
    tripId: clean(input.tripId || tripId),
    mediaId: clean(input.mediaId || input.imageId || input.id),
    source: clean(input.source) || (storagePath ? "storage" : (src.startsWith("assets/") ? "static" : "remote")),
    src,
    storagePath,
    thumbnailStoragePath: clean(input.thumbnailStoragePath),
    generation: clean(input.generation),
    thumbnailGeneration: clean(input.thumbnailGeneration),
    contentType: clean(input.contentType),
    thumbnailContentType: clean(input.thumbnailContentType),
    sortOrder: finiteNumber(input.sortOrder, sortOrder)
  };
  return descriptor;
}

export function mediaDescriptorFromRecord(record = {}) {
  return normalizeTripMediaDescriptor({
    ...record,
    source: "storage",
    imageId: clean(record.imageId || record.mediaId),
    mediaId: clean(record.mediaId || record.imageId)
  }, { tripId: clean(record.tripId), sortOrder: finiteNumber(record.sortOrder) });
}

function selectedVariant(descriptor, variantInput) {
  const variant = clean(variantInput) === "thumbnail" ? "thumbnail" : "display";
  if (variant === "thumbnail") {
    return {
      variant,
      storagePath: clean(descriptor.thumbnailStoragePath || descriptor.storagePath),
      generation: clean(descriptor.thumbnailGeneration || descriptor.generation)
    };
  }
  return {
    variant,
    storagePath: clean(descriptor.storagePath),
    generation: clean(descriptor.generation)
  };
}

function objectUrlKey(descriptor, variantInput) {
  const selected = selectedVariant(descriptor, variantInput);
  return `${selected.variant}|${selected.storagePath}|${selected.generation}`;
}

export async function resolveTripMediaUrl(input, {
  tripId = "",
  variant = "display",
  useCache = true
} = {}) {
  const descriptor = normalizeTripMediaDescriptor(input, { tripId });
  if (!descriptor) return "";
  if (!descriptor.storagePath) return descriptor.src;

  const key = objectUrlKey(descriptor, variant);
  if (objectUrls.has(key)) return objectUrls.get(key).url;
  if (inflight.has(key)) return inflight.get(key);

  const task = (async () => {
    const result = await getTripMediaBlob(descriptor, { variant, useCache });
    const url = URL.createObjectURL(result.blob);
    objectUrls.set(key, {
      url,
      tripId: clean(descriptor.tripId || tripId),
      mediaId: clean(descriptor.mediaId),
      storagePath: clean(result.storagePath)
    });
    return url;
  })();
  inflight.set(key, task);
  try { return await task; }
  finally { inflight.delete(key); }
}

export function bindTripMediaImage(img, input, {
  tripId = "",
  variant = "display",
  fallbackSrc = ""
} = {}) {
  if (!(img instanceof HTMLImageElement)) return () => {};
  const descriptor = normalizeTripMediaDescriptor(input, { tripId });
  const token = String(++bindToken);
  img.dataset.tripMediaBindToken = token;
  const fallback = clean(fallbackSrc || descriptor?.src);
  if (fallback) img.src = fallback;
  if (!descriptor?.storagePath) return () => {};

  resolveTripMediaUrl(descriptor, { tripId, variant }).then(url => {
    if (!url || img.dataset.tripMediaBindToken !== token) return;
    img.src = url;
    img.dataset.tripMediaResolved = "true";
  }).catch(error => {
    if (img.dataset.tripMediaBindToken !== token) return;
    img.dataset.tripMediaResolved = "false";
    console.warn("Trip media image resolve", error);
  });
  return () => {
    if (img.dataset.tripMediaBindToken === token) delete img.dataset.tripMediaBindToken;
  };
}

export async function resolveTripMediaCssUrl(input, options = {}) {
  return resolveTripMediaUrl(input, { ...options, variant: options.variant || "display" });
}

export function releaseTripMediaObjectUrls({ tripId = "", keepStoragePaths = [] } = {}) {
  const wantedTripId = clean(tripId);
  const keep = new Set((Array.isArray(keepStoragePaths) ? keepStoragePaths : []).map(clean).filter(Boolean));
  let released = 0;
  [...objectUrls.entries()].forEach(([key, record]) => {
    if (wantedTripId && clean(record.tripId) !== wantedTripId) return;
    if (keep.has(clean(record.storagePath))) return;
    try { URL.revokeObjectURL(record.url); } catch (error) {}
    objectUrls.delete(key);
    released += 1;
  });
  return released;
}

export function releaseAllTripMediaObjectUrls() {
  let released = 0;
  [...objectUrls.values()].forEach(record => {
    try { URL.revokeObjectURL(record.url); } catch (error) {}
    released += 1;
  });
  objectUrls.clear();
  return released;
}
