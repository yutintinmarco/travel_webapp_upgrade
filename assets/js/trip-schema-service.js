export const TRIP_SCHEMA_VERSION = 2;
export const TRIP_STATUS = Object.freeze({
  DRAFT: "draft",
  UPCOMING: "upcoming",
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived"
});

function clean(value) { return String(value ?? "").trim(); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function safeArray(value) { return Array.isArray(value) ? value : []; }

function fnv1a(input) {
  let hash = 0x811c9dc5;
  const text = String(input || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function slugify(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}


function inferTripStatus(startDate, endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;
  if (start && Number.isFinite(start.getTime()) && today < start) return TRIP_STATUS.UPCOMING;
  if (end && Number.isFinite(end.getTime()) && today > end) return TRIP_STATUS.COMPLETED;
  if (start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) return TRIP_STATUS.ACTIVE;
  return TRIP_STATUS.DRAFT;
}
function stripHtml(value) {
  return clean(value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function deriveTripId(raw) {
  const meta = raw?.meta || {};
  const explicit = clean(raw?.tripId || meta.tripId || meta?.expenses?.tripId);
  if (explicit) return explicit;
  const datePart = clean(meta.tripStartIso).replace(/-/g, "");
  const titlePart = slugify(stripHtml(meta.titleMain || meta.titleSmall || "trip")) || "trip";
  return `${titlePart}${datePart ? `-${datePart}` : ""}`.slice(0, 64);
}

function deriveDayId(day, index) {
  const explicit = clean(day?.dayId || day?.id);
  if (explicit) return explicit;
  const iso = clean(day?.isoDate).replace(/-/g, "");
  return iso ? `day_${iso}` : `day_${String(index + 1).padStart(2, "0")}_${fnv1a(day?.label || index)}`;
}

function deriveItemId(item, dayId, index) {
  const explicit = clean(item?.itemId || item?.id);
  if (explicit) return explicit;
  return `itm_${fnv1a([dayId, item?.time, item?.title, index].join("|"))}`;
}

function normalizeImages(item) {
  const existing = safeArray(item?.images);
  if (existing.length) {
    return existing.map((image, index) => {
      if (typeof image === "string") {
        return {
          imageId: `img_${fnv1a(image)}`,
          source: image.startsWith("assets/") ? "static" : "remote",
          src: image,
          sortOrder: index
        };
      }
      const src = clean(image?.src || image?.url || image?.path);
      return {
        imageId: clean(image?.imageId || image?.id) || `img_${fnv1a(src || index)}`,
        source: clean(image?.source) || (src.startsWith("assets/") ? "static" : "remote"),
        src,
        storagePath: clean(image?.storagePath),
        caption: clean(image?.caption),
        sortOrder: Number.isFinite(Number(image?.sortOrder)) ? Number(image.sortOrder) : index
      };
    }).filter(image => image.src || image.storagePath);
  }

  return safeArray(item?.gallery).map((src, index) => ({
    imageId: `img_${fnv1a(src)}`,
    source: String(src || "").startsWith("assets/") ? "static" : "remote",
    src: String(src || ""),
    sortOrder: index
  }));
}

function normalizeSavedPlace(place, index) {
  const title = clean(place?.title || place?.name || `Saved place ${index + 1}`);
  const placeId = clean(place?.placeId || place?.id) || `place_${fnv1a([title, place?.maps, index].join("|"))}`;
  return {
    ...clone(place),
    placeId,
    sortOrder: Number.isFinite(Number(place?.sortOrder)) ? Number(place.sortOrder) : index,
    images: normalizeImages(place)
  };
}

export function normalizePortableTrip(rawInput = {}) {
  const raw = clone(rawInput) || {};
  const meta = raw.meta || {};
  const tripId = deriveTripId(raw);
  const days = safeArray(raw.days).map((day, dayIndex) => {
    const dayId = deriveDayId(day, dayIndex);
    const items = safeArray(day?.items).map((item, itemIndex) => ({
      ...clone(item),
      itemId: deriveItemId(item, dayId, itemIndex),
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : itemIndex,
      images: normalizeImages(item)
    }));
    return {
      ...clone(day),
      dayId,
      sortOrder: Number.isFinite(Number(day?.sortOrder)) ? Number(day.sortOrder) : dayIndex,
      items
    };
  });

  const rawSnacks = raw.snacks;
  const normalizedSnackItems = (Array.isArray(rawSnacks) ? rawSnacks : safeArray(rawSnacks?.items)).map(normalizeSavedPlace);
  const snacks = Array.isArray(rawSnacks)
    ? normalizedSnackItems
    : {
        ...(clone(rawSnacks) || {}),
        items: normalizedSnackItems
      };

  return {
    ...raw,
    schemaVersion: Math.max(TRIP_SCHEMA_VERSION, Number(raw.schemaVersion) || 0),
    tripId,
    revision: Math.max(1, Number(raw.revision) || 1),
    meta: {
      ...clone(meta),
      tripId
    },
    days,
    snacks
  };
}

export function validatePortableTrip(rawInput = {}) {
  const trip = normalizePortableTrip(rawInput);
  const errors = [];
  const warnings = [];
  if (!trip.tripId) errors.push("Missing tripId");
  if (!trip.meta?.titleMain && !trip.meta?.titleSmall) warnings.push("Trip title is empty");
  if (!trip.meta?.tripStartIso) warnings.push("Trip start date is empty");
  if (!trip.meta?.tripEndIso) warnings.push("Trip end date is empty");
  if (!trip.days.length) warnings.push("Trip has no days");

  const seenDays = new Set();
  const seenItems = new Set();
  trip.days.forEach(day => {
    if (seenDays.has(day.dayId)) errors.push(`Duplicate dayId: ${day.dayId}`);
    seenDays.add(day.dayId);
    day.items.forEach(item => {
      if (seenItems.has(item.itemId)) errors.push(`Duplicate itemId: ${item.itemId}`);
      seenItems.add(item.itemId);
    });
  });
  const seenPlaces = new Set();
  const savedPlaces = Array.isArray(trip.snacks) ? trip.snacks : safeArray(trip.snacks?.items);
  savedPlaces.forEach(place => {
    if (seenPlaces.has(place.placeId)) errors.push(`Duplicate placeId: ${place.placeId}`);
    seenPlaces.add(place.placeId);
  });

  return { valid: errors.length === 0, errors, warnings, trip };
}

export function buildFirestoreTripPlan(rawInput = {}, ownerUser = null) {
  const { valid, errors, warnings, trip } = validatePortableTrip(rawInput);
  if (!valid) return { valid, errors, warnings, trip, plan: null };

  const meta = trip.meta || {};
  const title = stripHtml(meta.titleMain || meta.titleSmall || trip.tripId);
  const nowStatus = clean(meta.status) || inferTripStatus(clean(meta.tripStartIso), clean(meta.tripEndIso));
  const ownerUid = clean(ownerUser?.uid);
  const memberUids = ownerUid ? [ownerUid] : [];

  const tripDoc = {
    schemaVersion: TRIP_SCHEMA_VERSION,
    revision: trip.revision,
    title,
    titleSmall: clean(meta.titleSmall),
    titleHtml: clean(meta.titleMain),
    dateRange: clean(meta.dateRange),
    route: clean(meta.route),
    accentColor: clean(meta.accentColor),
    startDate: clean(meta.tripStartIso),
    endDate: clean(meta.tripEndIso),
    status: nowStatus,
    coverImage: clean(meta.coverImage),
    memberUids,
    memberCount: memberUids.length,
    createdBy: ownerUid,
    source: "portable-json"
  };

  const memberDoc = ownerUid ? {
    uid: ownerUid,
    role: "owner",
    status: "active",
    displayName: clean(ownerUser?.displayName),
    email: clean(ownerUser?.email).toLowerCase(),
    photoURL: clean(ownerUser?.photoURL)
  } : null;

  const days = trip.days.map(day => ({
    id: day.dayId,
    data: {
      dayId: day.dayId,
      label: clean(day.label),
      date: clean(day.date),
      isoDate: clean(day.isoDate),
      title: clean(day.title),
      subtitle: clean(day.subtitle),
      city: clean(day.city),
      sortOrder: Number(day.sortOrder) || 0
    },
    items: day.items.map(item => ({
      id: item.itemId,
      data: {
        ...clone(item),
        itemId: item.itemId,
        sortOrder: Number(item.sortOrder) || 0
      }
    }))
  }));

  const savedPlaceItems = Array.isArray(trip.snacks) ? trip.snacks : safeArray(trip.snacks?.items);
  const savedPlaces = savedPlaceItems.map(place => ({
    id: place.placeId,
    data: { ...clone(place), placeId: place.placeId }
  }));

  const settings = {
    general: {
      travellers: clone(meta.travellers || {}),
      cities: clone(meta.cities || {}),
      flights: clone(meta.flights || []),
      hotels: clone(meta.hotels || {}),
      infoCard: clone(meta.infoCard || {}),
      galleryDefaults: clone(meta.galleryDefaults || {}),
      savedPlacesMeta: Array.isArray(trip.snacks) ? {} : {
        title: clean(trip.snacks?.title),
        subtitle: clean(trip.snacks?.subtitle)
      },
      footerNote: clean(meta.footerNote)
    },
    expenses: clone(meta.expenses || {})
  };

  return {
    valid,
    errors,
    warnings,
    trip,
    plan: {
      tripId: trip.tripId,
      tripDoc,
      memberDoc,
      days,
      savedPlaces,
      settings
    }
  };
}

export function getTripSummary(rawInput = {}) {
  const trip = normalizePortableTrip(rawInput);
  const meta = trip.meta || {};
  return {
    tripId: trip.tripId,
    schemaVersion: trip.schemaVersion,
    revision: trip.revision,
    title: stripHtml(meta.titleMain || meta.titleSmall || trip.tripId),
    titleSmall: clean(meta.titleSmall),
    startDate: clean(meta.tripStartIso),
    endDate: clean(meta.tripEndIso),
    dateRange: clean(meta.dateRange),
    dayCount: trip.days.length,
    itemCount: trip.days.reduce((sum, day) => sum + safeArray(day.items).length, 0),
    savedPlaceCount: Array.isArray(trip.snacks) ? trip.snacks.length : safeArray(trip.snacks?.items).length
  };
}
