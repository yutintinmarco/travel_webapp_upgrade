import { db } from "./firebase-service.js";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp
} from "./firestore-observed-service.js";

const USER_EDITABLE_ITEM_FIELDS = ["time", "title", "note", "who", "icon", "detail"];
const PERSISTED_ITEM_FIELDS = ["time", "title", "note", "who", "icon", "detail", "booked", "sortOrder"];
const VALID_ITEM_KINDS = new Set(["stop", "transit"]);
const VALID_ROLES = new Set(["owner", "admin"]);
const PERSISTED_DAY_FIELDS = ["label", "date", "isoDate", "title", "subtitle", "city", "cities", "sortOrder"];

function clean(value) { return String(value ?? "").trim(); }
function clonePlain(value) {
  if (Array.isArray(value)) return value.map(clonePlain);
  if (!value || typeof value !== "object") return value;
  const output = {};
  Object.entries(value).forEach(([key, next]) => {
    if (typeof next === "undefined") return;
    output[key] = clonePlain(next);
  });
  return output;
}
function stripHtml(value) { return clean(value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(); }
function stableComparable(value) {
  if (Array.isArray(value)) return value.map(stableComparable);
  if (!value || typeof value !== "object") return value;
  const out = {};
  Object.keys(value).sort().forEach(key => {
    if (typeof value[key] === "undefined") return;
    out[key] = stableComparable(value[key]);
  });
  return out;
}
function stableJson(value) {
  try { return JSON.stringify(stableComparable(value)); }
  catch (_) { return ""; }
}
function validIsoDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(clean(value)); }
function formatTripDateRange(startInput, endInput) {
  const start = clean(startInput), end = clean(endInput);
  if (!validIsoDate(start) || !validIsoDate(end)) return "";
  const [sy, sm, sd] = start.split("-").map(Number), [ey, em, ed] = end.split("-").map(Number);
  if (![sy, sm, sd, ey, em, ed].every(Number.isFinite)) return "";
  return sy === ey
    ? `${sm}月${sd}日 至 ${em}月${ed}日`
    : `${sy}年${sm}月${sd}日 至 ${ey}年${em}月${ed}日`;
}
function inferTripStatus(startInput, endInput) {
  const start = clean(startInput), end = clean(endInput);
  if (!validIsoDate(start) || !validIsoDate(end)) return "";
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (todayIso < start) return "upcoming";
  if (todayIso > end) return "completed";
  return "active";
}
function isoDateUtc(value) {
  const iso = clean(value);
  if (!validIsoDate(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}
function isoFromUtcDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
function inclusiveIsoDates(startInput, endInput) {
  const start = isoDateUtc(startInput), end = isoDateUtc(endInput);
  if (!start || !end || end < start) return [];
  const out = [];
  for (let cursor = new Date(start.getTime()); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) out.push(isoFromUtcDate(cursor));
  return out;
}
function formatDayDateLabel(isoInput) {
  const date = isoDateUtc(isoInput);
  if (!date) return "";
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日（${weekdays[date.getUTCDay()]}）`;
}
function dayIdFromIso(isoInput) { return `day_${clean(isoInput).replace(/-/g, "")}`; }
function daySnapshot(day = {}, fallbackSortOrder = 999999) {
  return {
    dayId: clean(day?.dayId || day?.id),
    label: clean(day?.label),
    date: clean(day?.date),
    isoDate: clean(day?.isoDate),
    title: clean(day?.title),
    subtitle: clean(day?.subtitle),
    city: clean(day?.city),
    cities: Array.isArray(day?.cities) ? day.cities.map(clean).filter(Boolean) : [],
    sortOrder: normalizedSortOrder(day?.sortOrder, fallbackSortOrder)
  };
}
function sameDay(a = {}, b = {}) {
  return PERSISTED_DAY_FIELDS.every(field => field === "sortOrder"
    ? normalizedSortOrder(a?.[field]) === normalizedSortOrder(b?.[field])
    : field === "cities"
      ? stableJson(Array.isArray(a?.cities) ? a.cities.map(clean).filter(Boolean) : []) === stableJson(Array.isArray(b?.cities) ? b.cities.map(clean).filter(Boolean) : [])
      : clean(a?.[field]) === clean(b?.[field]));
}
function dayHasDraftItems(session, dayIdInput) {
  const dayId = clean(dayIdInput);
  let has = false;
  session?.draftItems?.forEach?.((draft, key) => {
    if (has || session?.deletedItems?.has?.(key)) return;
    if (clean(draft?.dayId) === dayId) has = true;
  });
  return has;
}
function uniqueDayId(session, isoInput) {
  const base = dayIdFromIso(isoInput);
  if (!session?.draftDays?.has?.(base) && !session?.baseDays?.has?.(base)) return base;
  let suffix = 2;
  while (session?.draftDays?.has?.(`${base}_${suffix}`) || session?.baseDays?.has?.(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}
function reconcileDraftDaysForDateRange(session, startInput, endInput) {
  if (!session) return [];
  const desiredDates = inclusiveIsoDates(startInput, endInput);
  if (!desiredDates.length) return [];
  const desiredSet = new Set(desiredDates);
  const currentDays = [...(session.draftDays?.values?.() || [])];
  const byIso = new Map();
  currentDays.forEach(day => { const iso = clean(day?.isoDate); if (iso && !byIso.has(iso)) byIso.set(iso, day); });
  currentDays.forEach(day => {
    const iso = clean(day?.isoDate);
    if (iso && desiredSet.has(iso)) return;
    if (dayHasDraftItems(session, day.dayId)) {
      const error = new Error("Cannot remove a day that still contains itinerary items");
      error.code = "edit-trip-day-not-empty";
      error.dayId = clean(day.dayId);
      error.dayLabel = clean(day.label) || clean(day.date) || clean(day.isoDate);
      throw error;
    }
  });
  const nextDays = new Map();
  desiredDates.forEach((iso, index) => {
    const existing = byIso.get(iso);
    const day = existing ? clonePlain(existing) : {
      dayId: uniqueDayId(session, iso),
      label: `Day ${index + 1}`,
      date: formatDayDateLabel(iso),
      isoDate: iso,
      title: "待安排",
      subtitle: "",
      city: "",
      cities: [],
      sortOrder: index,
      isNew: true
    };
    day.label = `Day ${index + 1}`;
    day.date = formatDayDateLabel(iso);
    day.isoDate = iso;
    day.sortOrder = index;
    nextDays.set(clean(day.dayId), day);
  });
  session.draftDays = nextDays;
  session.dayIds = new Set([...nextDays.keys()]);
  return [...nextDays.values()].map(clonePlain);
}
function tripDetailsSnapshot(trip = {}) {
  const meta = trip?.meta && typeof trip.meta === "object" ? trip.meta : {};
  const startDate = clean(meta.tripStartIso), endDate = clean(meta.tripEndIso);
  return {
    titleSmall: clean(meta.titleSmall),
    titleMain: clean(meta.titleMain),
    startDate,
    endDate,
    dateRange: clean(meta.dateRange) || formatTripDateRange(startDate, endDate),
    route: clean(meta.route),
    status: clean(meta.status) || inferTripStatus(startDate, endDate)
  };
}
function normalizeTripDetails(input = {}, fallback = {}) {
  const next = {
    titleSmall: clean(input.titleSmall ?? fallback.titleSmall),
    titleMain: clean(input.titleMain ?? fallback.titleMain),
    startDate: clean(input.startDate ?? fallback.startDate),
    endDate: clean(input.endDate ?? fallback.endDate),
    route: clean(input.route ?? fallback.route)
  };
  if (!next.titleMain) next.titleMain = next.titleSmall;
  if (!next.titleSmall) next.titleSmall = stripHtml(next.titleMain);
  next.dateRange = formatTripDateRange(next.startDate, next.endDate) || clean(input.dateRange ?? fallback.dateRange);
  next.status = inferTripStatus(next.startDate, next.endDate) || clean(input.status ?? fallback.status);
  return next;
}
function normalizeTravellersForEdit(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const out = {};
  Object.entries(source).forEach(([keyInput, cfgInput]) => {
    const key = clean(keyInput);
    if (!key) return;
    const cfg = cfgInput && typeof cfgInput === "object" && !Array.isArray(cfgInput) ? clonePlain(cfgInput) : { label: clean(cfgInput) };
    delete cfg.sortOrder;
    cfg.label = clean(cfg.label) || key;
    cfg.members = clean(cfg.members);
    out[key] = cfg;
  });
  return out;
}
function normalizeFlightsForEdit(input = []) {
  return Array.isArray(input) ? input.map(row => clonePlain(row || {})) : [];
}
function sameTripDetails(a = {}, b = {}) { return stableJson(normalizeTripDetails(a, a)) === stableJson(normalizeTripDetails(b, b)); }
function sameTravellers(a = {}, b = {}) { return stableJson(normalizeTravellersForEdit(a)) === stableJson(normalizeTravellersForEdit(b)); }
function sameFlights(a = [], b = []) { return stableJson(normalizeFlightsForEdit(a)) === stableJson(normalizeFlightsForEdit(b)); }
function itemKey(dayId, itemId) { return `${clean(dayId)}|${clean(itemId)}`; }
function makeItemId() {
  try {
    if (globalThis.crypto?.randomUUID) return `itm_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  } catch (_) {}
  return `itm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
function normalizedKind(value) {
  const kind = clean(value).toLowerCase();
  return VALID_ITEM_KINDS.has(kind) ? kind : "stop";
}
function finiteCoordinate(value) {
  if (clean(value) === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}
function normalizeDraftLocation(record = {}, fallbackTitle = "") {
  const source = record?.location && typeof record.location === "object" ? record.location : record;
  const latitude = finiteCoordinate(source?.latitude ?? source?.lat);
  const longitude = finiteCoordinate(source?.longitude ?? source?.lng ?? source?.lon);
  return {
    name: clean(source?.name) || clean(fallbackTitle),
    placeId: clean(source?.placeId),
    latitude,
    longitude,
    address: clean(source?.address),
    mapsUrl: clean(source?.mapsUrl || source?.googleMapsUrl)
  };
}
function locationSnapshot(item = {}) {
  const source = item?.location && typeof item.location === "object" ? item.location : {};
  return normalizeDraftLocation({
    name: source?.name || item?.placeName || item?.title,
    placeId: source?.placeId || item?.googlePlaceId || item?.googleMapsPlaceId,
    latitude: source?.latitude ?? source?.lat ?? item?.latitude ?? item?.lat,
    longitude: source?.longitude ?? source?.lng ?? source?.lon ?? item?.longitude ?? item?.lng ?? item?.lon,
    address: source?.address || item?.address,
    mapsUrl: source?.mapsUrl || source?.googleMapsUrl || item?.maps || item?.mapsUrl || item?.googleMapsUrl
  }, item?.title);
}
function sameLocation(a = {}, b = {}) {
  const left = normalizeDraftLocation(a), right = normalizeDraftLocation(b);
  return clean(left.name) === clean(right.name)
    && clean(left.placeId) === clean(right.placeId)
    && finiteCoordinate(left.latitude) === finiteCoordinate(right.latitude)
    && finiteCoordinate(left.longitude) === finiteCoordinate(right.longitude)
    && clean(left.address) === clean(right.address)
    && clean(left.mapsUrl) === clean(right.mapsUrl);
}
function newDraftRecord(dayId, kindInput, fields = {}) {
  const kind = normalizedKind(kindInput);
  const title = clean(fields.title) || (kind === "transit" ? "Travel" : "新地點");
  const icon = clean(fields.icon) || (kind === "transit" ? "🚆" : "📍");
  return {
    dayId: clean(dayId),
    itemId: makeItemId(),
    isNew: true,
    kind,
    transportMode: kind === "transit" ? "transit" : "",
    time: clean(fields.time),
    title,
    note: clean(fields.note),
    sortOrder: normalizedSortOrder(fields.sortOrder),
    icon,
    who: clean(fields.who) || "all",
    popup: false,
    booked: Boolean(fields.booked),
    detail: clean(fields.detail),
    maps: clean(fields.location?.mapsUrl),
    gallery: [],
    images: Array.isArray(fields.images) ? clonePlain(fields.images) : [],
    location: normalizeDraftLocation(fields.location || {}, title)
  };
}
function draftToNewItem(draft = {}) {
  const kind = normalizedKind(draft.kind);
  const title = clean(draft.title) || (kind === "transit" ? "Travel" : "新地點");
  return {
    itemId: clean(draft.itemId),
    kind,
    ...(kind === "transit" ? { transportMode: "transit" } : {}),
    time: clean(draft.time),
    icon: clean(draft.icon) || (kind === "transit" ? "🚆" : "📍"),
    title,
    note: clean(draft.note),
    who: clean(draft.who) || "all",
    popup: Boolean(draft.popup),
    booked: Boolean(draft.booked),
    detail: clean(draft.detail),
    maps: clean(draft.location?.mapsUrl || draft.maps),
    gallery: Array.isArray(draft.gallery) ? clonePlain(draft.gallery) : [],
    images: Array.isArray(draft.images) ? clonePlain(draft.images) : [],
    location: normalizeDraftLocation(draft.location || {}, title),
    sortOrder: normalizedSortOrder(draft.sortOrder)
  };
}
function normalizedSortOrder(value, fallback = 999999) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}
function itemSnapshot(item = {}, fallbackSortOrder = 999999) {
  const location = locationSnapshot(item);
  return {
    time: clean(item?.time),
    title: clean(item?.title),
    note: clean(item?.note),
    who: clean(item?.who) || "all",
    booked: Boolean(item?.booked),
    icon: clean(item?.icon),
    detail: clean(item?.detail),
    sortOrder: normalizedSortOrder(item?.sortOrder, fallbackSortOrder),
    gallery: Array.isArray(item?.gallery) ? clonePlain(item.gallery) : [],
    images: Array.isArray(item?.images) ? clonePlain(item.images) : [],
    location,
    maps: clean(location.mapsUrl)
  };
}
function samePersisted(a = {}, b = {}) {
  return PERSISTED_ITEM_FIELDS.every(field => field === "sortOrder"
    ? normalizedSortOrder(a?.[field]) === normalizedSortOrder(b?.[field])
    : field === "booked"
      ? Boolean(a?.[field]) === Boolean(b?.[field])
      : clean(a?.[field]) === clean(b?.[field])) && sameLocation(a?.location, b?.location);
}
function parseClockMinutes(value) {
  const match = clean(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}
function dayDraftRows(session, dayIdInput) {
  const dayId = clean(dayIdInput);
  const rows = [];
  session?.draftItems?.forEach?.((draft, key) => {
    if (session?.deletedItems?.has?.(key)) return;
    if (clean(draft?.dayId) === dayId) rows.push(draft);
  });
  return rows;
}
function stablePresentationOrder(rows = []) {
  return rows.slice().sort((a, b) => {
    const ao = normalizedSortOrder(a?.sortOrder), bo = normalizedSortOrder(b?.sortOrder);
    if (ao !== bo) return ao - bo;
    const at = parseClockMinutes(a?.time), bt = parseClockMinutes(b?.time);
    if (at != null && bt != null && at !== bt) return at - bt;
    return clean(a?.itemId).localeCompare(clean(b?.itemId));
  });
}
function renumberPresentationSortOrders(session, dayIdInput) {
  if (!session) return [];
  const ordered = stablePresentationOrder(dayDraftRows(session, dayIdInput));
  ordered.forEach((draft, index) => {
    session.draftItems.set(itemKey(draft.dayId, draft.itemId), { ...draft, sortOrder: index });
  });
  return ordered.map(row => clonePlain(row));
}
function stableChronologicalOrder(rows = []) {
  return rows.slice().sort((a, b) => {
    const at = parseClockMinutes(a?.time), bt = parseClockMinutes(b?.time);
    if (at != null && bt != null && at !== bt) return at - bt;
    if (at != null && bt == null) return -1;
    if (at == null && bt != null) return 1;
    const ao = normalizedSortOrder(a?.sortOrder), bo = normalizedSortOrder(b?.sortOrder);
    if (ao !== bo) return ao - bo;
    return clean(a?.itemId).localeCompare(clean(b?.itemId));
  });
}
function normalizeDaySortOrders(session, dayIdInput) {
  if (!session) return [];
  const ordered = stableChronologicalOrder(dayDraftRows(session, dayIdInput));
  ordered.forEach((draft, index) => {
    session.draftItems.set(itemKey(draft.dayId, draft.itemId), { ...draft, sortOrder: index });
  });
  return ordered.map(row => clonePlain(row));
}

export function createTripEditSession(tripDataInput) {
  const trip = tripDataInput && typeof tripDataInput === "object" ? tripDataInput : {};
  const tripId = clean(trip.tripId || trip.meta?.tripId);
  if (!tripId) {
    const error = new Error("Trip ID is required");
    error.code = "edit-trip-missing";
    throw error;
  }
  const baseRevision = Math.max(1, Number(trip.revision) || 1);
  const baseItems = new Map();
  const baseItemPayloads = new Map();
  const draftItems = new Map();
  const baseDays = new Map();
  const draftDays = new Map();
  (Array.isArray(trip.days) ? trip.days : []).forEach((day, dayIndex) => {
    const dayId = clean(day?.dayId);
    if (!dayId) return;
    const daySnap = daySnapshot(day, dayIndex);
    baseDays.set(dayId, daySnap);
    draftDays.set(dayId, clonePlain(daySnap));
    (Array.isArray(day?.items) ? day.items : []).forEach((item, index) => {
      const itemId = clean(item?.itemId);
      if (!itemId) return;
      const key = itemKey(dayId, itemId);
      const snap = itemSnapshot(item, index);
      baseItems.set(key, { dayId, itemId, ...snap });
      baseItemPayloads.set(key, clonePlain(item));
      draftItems.set(key, { dayId, originDayId: dayId, itemId, ...clonePlain(snap) });
    });
  });
  const baseTripDetails = tripDetailsSnapshot(trip);
  const baseTravellers = normalizeTravellersForEdit(trip?.meta?.travellers || {});
  const baseFlights = normalizeFlightsForEdit(trip?.meta?.flights || []);
  return {
    tripId,
    baseRevision,
    startedAt: Date.now(),
    dayIds: new Set([...draftDays.keys()]),
    baseDays,
    draftDays,
    baseItems,
    baseItemPayloads,
    draftItems,
    deletedItems: new Set(),
    baseTripDetails,
    draftTripDetails: clonePlain(baseTripDetails),
    baseTravellers,
    draftTravellers: clonePlain(baseTravellers),
    baseFlights,
    draftFlights: clonePlain(baseFlights)
  };
}

export function getTripEditDraftTripDetails(session) {
  return session?.draftTripDetails ? clonePlain(session.draftTripDetails) : null;
}

export function updateTripEditDraftTripDetails(session, patchInput = {}) {
  if (!session) return null;
  const current = session.draftTripDetails || session.baseTripDetails || {};
  const next = normalizeTripDetails({ ...current, ...(patchInput || {}) }, current);
  if (!clean(next.titleMain)) {
    const error = new Error("Trip title is required");
    error.code = "edit-trip-title-required";
    throw error;
  }
  if (next.startDate && !validIsoDate(next.startDate)) { const error = new Error("Invalid start date"); error.code = "edit-trip-date-invalid"; throw error; }
  if (next.endDate && !validIsoDate(next.endDate)) { const error = new Error("Invalid end date"); error.code = "edit-trip-date-invalid"; throw error; }
  if (next.startDate && next.endDate && next.endDate < next.startDate) { const error = new Error("End date is before start date"); error.code = "edit-trip-date-order"; throw error; }
  if (next.startDate && next.endDate) reconcileDraftDaysForDateRange(session, next.startDate, next.endDate);
  session.draftTripDetails = next;
  return clonePlain(next);
}

export function getTripEditDraftTeamState(session) {
  if (!session) return { travellers: {}, flights: [] };
  return {
    travellers: clonePlain(session.draftTravellers || {}),
    flights: clonePlain(session.draftFlights || [])
  };
}

export function replaceTripEditDraftTeamState(session, { travellers = {}, flights = [] } = {}) {
  if (!session) return { travellers: {}, flights: [] };
  const nextTravellers = normalizeTravellersForEdit(travellers);
  const nextFlights = normalizeFlightsForEdit(flights);
  const labels = new Set();
  Object.entries(nextTravellers).forEach(([key, cfg]) => {
    const labelKey = clean(cfg?.label).toLocaleLowerCase();
    if (!labelKey) { const error = new Error("Team label is required"); error.code = "edit-team-label-required"; error.teamKey = key; throw error; }
    if (labels.has(labelKey)) { const error = new Error("Team labels must be unique"); error.code = "edit-team-label-duplicate"; error.teamKey = key; throw error; }
    labels.add(labelKey);
  });
  nextFlights.forEach(row => {
    const key = clean(row?.teamKey);
    if (key && key !== "all" && !nextTravellers[key]) {
      const error = new Error("Flight still references a removed Team");
      error.code = "edit-team-flight-reference";
      error.teamKey = key;
      throw error;
    }
  });
  session.draftTravellers = nextTravellers;
  session.draftFlights = nextFlights;
  session.draftItems?.forEach?.((draft, key) => {
    const who = clean(draft?.who) || "all";
    if (who === "all" || nextTravellers[who]) return;
    session.draftItems.set(key, { ...draft, who: "all" });
  });
  return getTripEditDraftTeamState(session);
}

export function getTripEditDraftItem(session, dayIdInput, itemIdInput) {
  if (!session) return null;
  const key = itemKey(dayIdInput, itemIdInput);
  if (session.deletedItems?.has?.(key)) return null;
  const row = session.draftItems?.get?.(key);
  return row ? clonePlain(row) : null;
}

export function addTripEditDraftItem(session, dayIdInput, kindInput, fields = {}) {
  if (!session) return null;
  const dayId = clean(dayIdInput);
  if (!dayId || !session.dayIds?.has?.(dayId)) {
    const error = new Error("Day is not part of this edit session");
    error.code = "edit-day-missing";
    throw error;
  }
  const currentRows = dayDraftRows(session, dayId);
  const maxSort = currentRows.reduce((max, row) => Math.max(max, normalizedSortOrder(row?.sortOrder, -1)), -1);
  const draft = newDraftRecord(dayId, kindInput, { ...fields, sortOrder: maxSort + 1 });
  session.draftItems.set(itemKey(dayId, draft.itemId), draft);
  normalizeDaySortOrders(session, dayId);
  return getTripEditDraftItem(session, dayId, draft.itemId);
}

export function updateTripEditDraftItem(session, dayIdInput, itemIdInput, patchInput = {}) {
  if (!session) return null;
  const key = itemKey(dayIdInput, itemIdInput);
  const current = session.draftItems?.get?.(key);
  if (!current) {
    const error = new Error("Itinerary item is not part of this edit session");
    error.code = "edit-item-missing";
    throw error;
  }
  const next = { ...current };
  USER_EDITABLE_ITEM_FIELDS.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(patchInput || {}, field)) next[field] = clean(patchInput[field]);
  });
  if (!clean(next.who)) next.who = "all";
  if (Object.prototype.hasOwnProperty.call(patchInput || {}, "booked")) next.booked = Boolean(patchInput.booked);
  if (Object.prototype.hasOwnProperty.call(patchInput || {}, "gallery")) next.gallery = Array.isArray(patchInput.gallery) ? clonePlain(patchInput.gallery) : [];
  if (Object.prototype.hasOwnProperty.call(patchInput || {}, "images")) next.images = Array.isArray(patchInput.images) ? clonePlain(patchInput.images) : [];
  if (Object.prototype.hasOwnProperty.call(patchInput || {}, "location")) {
    next.location = normalizeDraftLocation(patchInput.location || {}, next.title);
    next.maps = clean(next.location?.mapsUrl);
  }
  if (next.isNew && Object.prototype.hasOwnProperty.call(patchInput || {}, "title")) {
    const location = normalizeDraftLocation(next.location || {}, next.title);
    if (!clean(location.name) || clean(location.name) === clean(current.title) || (!location.placeId && location.latitude == null && location.longitude == null && !location.address)) location.name = clean(next.title);
    next.location = location;
  }
  session.draftItems.set(key, next);
  if (Object.prototype.hasOwnProperty.call(patchInput || {}, "time") && clean(patchInput.time) !== clean(current.time)) {
    normalizeDaySortOrders(session, current.dayId);
  }
  return getTripEditDraftItem(session, current.dayId, current.itemId);
}

export function reorderTripEditDraftDayByTime(session, dayIdInput) {
  return normalizeDaySortOrders(session, dayIdInput);
}

export function getTripEditDraftPosition(session, dayIdInput, itemIdInput) {
  if (!session) return { index: -1, count: 0, canMoveUp: false, canMoveDown: false };
  const dayId = clean(dayIdInput), itemId = clean(itemIdInput);
  const ordered = stablePresentationOrder(dayDraftRows(session, dayId));
  const index = ordered.findIndex(row => clean(row?.itemId) === itemId);
  return {
    index,
    count: ordered.length,
    canMoveUp: index > 0,
    canMoveDown: index >= 0 && index < ordered.length - 1
  };
}

export function moveTripEditDraftItemToIndex(session, dayIdInput, itemIdInput, targetIndexInput) {
  if (!session) return null;
  const dayId = clean(dayIdInput), itemId = clean(itemIdInput);
  const key = itemKey(dayId, itemId);
  if (session.deletedItems?.has?.(key) || !session.draftItems?.has?.(key)) {
    const error = new Error("Itinerary item is not part of this edit session");
    error.code = "edit-item-missing";
    throw error;
  }
  const ordered = stablePresentationOrder(dayDraftRows(session, dayId));
  const fromIndex = ordered.findIndex(row => clean(row?.itemId) === itemId);
  if (fromIndex < 0) return null;
  const targetIndex = Math.max(0, Math.min(ordered.length - 1, Math.trunc(Number(targetIndexInput) || 0)));
  if (targetIndex !== fromIndex) {
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(targetIndex, 0, moved);
  }
  ordered.forEach((draft, index) => {
    session.draftItems.set(itemKey(draft.dayId, draft.itemId), { ...draft, sortOrder: index });
  });
  return getTripEditDraftItem(session, dayId, itemId);
}

export function moveTripEditDraftItemToDay(session, dayIdInput, itemIdInput, targetDayIdInput) {
  if (!session) return null;
  const dayId = clean(dayIdInput), itemId = clean(itemIdInput), targetDayId = clean(targetDayIdInput);
  if (!targetDayId || !session.dayIds?.has?.(targetDayId)) {
    const error = new Error("Target day is not part of this edit session");
    error.code = "edit-day-missing";
    throw error;
  }
  const currentKey = itemKey(dayId, itemId);
  const current = session.draftItems?.get?.(currentKey);
  if (!current || session.deletedItems?.has?.(currentKey)) {
    const error = new Error("Itinerary item is not part of this edit session");
    error.code = "edit-item-missing";
    throw error;
  }
  if (dayId === targetDayId) return getTripEditDraftItem(session, dayId, itemId);
  const originDayId = clean(current.originDayId || current.dayId);
  session.draftItems.delete(currentKey);
  const maxSort = dayDraftRows(session, targetDayId).reduce((max, row) => Math.max(max, normalizedSortOrder(row?.sortOrder, -1)), -1);
  const moved = { ...current, dayId: targetDayId, originDayId, sortOrder: maxSort + 1 };
  session.draftItems.set(itemKey(targetDayId, itemId), moved);
  renumberPresentationSortOrders(session, dayId);
  normalizeDaySortOrders(session, targetDayId);
  return getTripEditDraftItem(session, targetDayId, itemId);
}

export function removeTripEditDraftItem(session, dayIdInput, itemIdInput) {
  if (!session) return { removed: false, wasNew: false };
  const dayId = clean(dayIdInput), itemId = clean(itemIdInput), key = itemKey(dayId, itemId);
  const draft = session.draftItems?.get?.(key);
  if (!draft || session.deletedItems?.has?.(key)) return { removed: false, wasNew: false };
  const originDayId = clean(draft.originDayId || draft.dayId);
  const originKey = itemKey(originDayId, itemId);
  const base = session.baseItems?.get?.(originKey);
  const wasNew = Boolean(draft?.isNew && !base);
  session.draftItems.delete(key);
  if (!wasNew && base) session.deletedItems.add(originKey);
  renumberPresentationSortOrders(session, dayId);
  return { removed: true, wasNew };
}

export function tripEditChanges(session) {
  if (!session) return [];
  const changes = [];
  session.deletedItems?.forEach?.(key => {
    const base = session.baseItems.get(key);
    if (base) changes.push({ operation: "delete", dayId: base.dayId, itemId: base.itemId, base: clonePlain(base) });
  });
  session.draftItems.forEach((draft, key) => {
    const originDayId = clean(draft?.originDayId || draft?.dayId);
    const originKey = itemKey(originDayId, draft?.itemId);
    if (session.deletedItems?.has?.(originKey)) return;
    const base = session.baseItems.get(originKey);
    if (!base) {
      if (draft?.isNew) changes.push({ operation: "create", dayId: draft.dayId, itemId: draft.itemId, item: draftToNewItem(draft) });
      return;
    }
    const moved = clean(draft.dayId) !== clean(base.dayId);
    const patch = {};
    PERSISTED_ITEM_FIELDS.forEach(field => {
      if (field === "sortOrder") {
        if (normalizedSortOrder(base[field]) !== normalizedSortOrder(draft[field])) patch[field] = normalizedSortOrder(draft[field]);
      } else if (field === "booked") {
        if (Boolean(base[field]) !== Boolean(draft[field])) patch[field] = Boolean(draft[field]);
      } else if (clean(base[field]) !== clean(draft[field])) {
        patch[field] = field === "who" ? (clean(draft[field]) || "all") : clean(draft[field]);
      }
    });
    if (stableJson(base.gallery || []) !== stableJson(draft.gallery || [])) patch.gallery = clonePlain(Array.isArray(draft.gallery) ? draft.gallery : []);
    if (stableJson(base.images || []) !== stableJson(draft.images || [])) patch.images = clonePlain(Array.isArray(draft.images) ? draft.images : []);
    if (!sameLocation(base.location, draft.location)) {
      patch.location = normalizeDraftLocation(draft.location || {}, draft.title);
      patch.maps = clean(patch.location.mapsUrl);
    }
    if (moved) {
      changes.push({ operation: "move", fromDayId: base.dayId, dayId: draft.dayId, itemId: draft.itemId, patch });
      return;
    }
    if (!Object.keys(patch).length) return;
    changes.push({ operation: "update", dayId: draft.dayId, itemId: draft.itemId, patch });
  });
  return changes;
}

export function tripEditDayChanges(session) {
  if (!session) return [];
  const changes = [];
  session.baseDays?.forEach?.((base, dayId) => {
    if (!session.draftDays?.has?.(dayId)) changes.push({ operation: "delete", dayId });
  });
  session.draftDays?.forEach?.((draft, dayId) => {
    const base = session.baseDays?.get?.(dayId);
    if (!base) {
      const data = clonePlain(draft);
      delete data.isNew;
      changes.push({ operation: "create", dayId, data });
      return;
    }
    if (sameDay(base, draft)) return;
    const patch = {};
    PERSISTED_DAY_FIELDS.forEach(field => {
      if (field === "sortOrder") {
        if (normalizedSortOrder(base[field]) !== normalizedSortOrder(draft[field])) patch[field] = normalizedSortOrder(draft[field]);
      } else if (field === "cities") {
        const left = Array.isArray(base.cities) ? base.cities.map(clean).filter(Boolean) : [];
        const right = Array.isArray(draft.cities) ? draft.cities.map(clean).filter(Boolean) : [];
        if (stableJson(left) !== stableJson(right)) patch.cities = right;
      } else if (clean(base[field]) !== clean(draft[field])) patch[field] = clean(draft[field]);
    });
    changes.push({ operation: "update", dayId, patch });
  });
  return changes;
}

function mediaIdentity(row = {}) {
  return clean(row?.mediaId || row?.imageId || row?.id) || clean(row?.storagePath);
}

export function tripEditMediaDelta(session) {
  if (!session) return { additions: [], removals: [] };
  const additions = [], removals = [];
  const seenAdd = new Set(), seenRemove = new Set();
  session.draftItems?.forEach?.(draft => {
    (Array.isArray(draft?.images) ? draft.images : []).forEach(row => {
      if (!row || typeof row !== "object" || row.editDraft !== true) return;
      const id = mediaIdentity(row); if (!id || seenAdd.has(id)) return;
      seenAdd.add(id); additions.push(clonePlain(row));
    });
  });
  session.baseItems?.forEach?.((base, key) => {
    const baseImages = Array.isArray(base?.images) ? base.images : [];
    const itemId = clean(base?.itemId), dayId = clean(base?.dayId);
    const deleted = session.deletedItems?.has?.(key);
    let draft = null;
    if (!deleted) draft = [...(session.draftItems?.values?.() || [])].find(row => clean(row?.itemId) === itemId && clean(row?.originDayId || row?.dayId) === dayId) || null;
    const nextIds = new Set((Array.isArray(draft?.images) ? draft.images : []).map(mediaIdentity).filter(Boolean));
    baseImages.forEach(row => {
      const id = mediaIdentity(row); if (!id || (!deleted && nextIds.has(id)) || seenRemove.has(id)) return;
      seenRemove.add(id); removals.push(clonePlain(row));
    });
  });
  return { additions, removals };
}

export function replaceTripEditDraftMediaDescriptors(session, replacementsInput = {}) {
  if (!session) return 0;
  const replacements = replacementsInput instanceof Map ? replacementsInput : new Map(Object.entries(replacementsInput || {}));
  let count = 0;
  session.draftItems?.forEach?.((draft, key) => {
    if (!Array.isArray(draft?.images)) return;
    let changed = false;
    const images = draft.images.map(row => {
      const id = mediaIdentity(row), replacement = id ? replacements.get(id) : null;
      if (!replacement) return row;
      changed = true; count += 1; return clonePlain(replacement);
    }).map((row, index) => ({ ...row, sortOrder: index }));
    if (changed) session.draftItems.set(key, { ...draft, images });
  });
  return count;
}

export function tripEditDomainChanges(session) {
  if (!session) return { tripDetailsChanged: false, travellersChanged: false, flightsChanged: false, teamChangeCount: 0, daysChanged: false, dayChangeCount: 0 };
  const tripDetailsChanged = !sameTripDetails(session.baseTripDetails || {}, session.draftTripDetails || {});
  const travellersChanged = !sameTravellers(session.baseTravellers || {}, session.draftTravellers || {});
  const flightsChanged = !sameFlights(session.baseFlights || [], session.draftFlights || []);
  const baseKeys = new Set(Object.keys(session.baseTravellers || {})), draftKeys = new Set(Object.keys(session.draftTravellers || {}));
  let teamChangeCount = 0;
  new Set([...baseKeys, ...draftKeys]).forEach(key => {
    if (stableJson(session.baseTravellers?.[key] || null) !== stableJson(session.draftTravellers?.[key] || null)) teamChangeCount += 1;
  });
  const dayChangeCount = tripEditDayChanges(session).length;
  return { tripDetailsChanged, travellersChanged, flightsChanged, teamChangeCount, daysChanged: dayChangeCount > 0, dayChangeCount };
}

export function tripEditChangeCount(session) {
  const itemCount = tripEditChanges(session).length;
  const domain = tripEditDomainChanges(session);
  return itemCount + domain.dayChangeCount + (domain.tripDetailsChanged ? 1 : 0) + domain.teamChangeCount + (domain.flightsChanged && !domain.travellersChanged ? 1 : 0);
}

export function applyTripEditDraftToTrip(session, tripInput, { revision = null } = {}) {
  const trip = clonePlain(tripInput || {}) || {};
  if (!session) return trip;
  const draftByCurrentKey = new Map();
  const draftByOriginKey = new Map();
  session.draftItems.forEach(draft => {
    draftByCurrentKey.set(itemKey(draft.dayId, draft.itemId), draft);
    draftByOriginKey.set(itemKey(draft.originDayId || draft.dayId, draft.itemId), draft);
  });
  const sourceDays = new Map((Array.isArray(trip.days) ? trip.days : []).map(day => [clean(day?.dayId), day]));
  const sourceItemPayloads = new Map();
  (Array.isArray(trip.days) ? trip.days : []).forEach(day => {
    const dayId = clean(day?.dayId);
    (Array.isArray(day?.items) ? day.items : []).forEach(item => sourceItemPayloads.set(itemKey(dayId, item?.itemId), clonePlain(item)));
  });
  const orderedDays = [...(session.draftDays?.values?.() || [])].sort((a, b) => normalizedSortOrder(a?.sortOrder) - normalizedSortOrder(b?.sortOrder));
  trip.days = orderedDays.map(dayDraft => {
    const dayId = clean(dayDraft?.dayId);
    const source = clonePlain(sourceDays.get(dayId) || {}) || {};
    const day = { ...source, ...clonePlain(dayDraft), dayId };
    delete day.isNew;
    const items = [];
    (Array.isArray(source.items) ? source.items : []).forEach((item, index) => {
      const originalKey = itemKey(dayId, item?.itemId);
      if (session.deletedItems?.has?.(originalKey)) return;
      const draft = draftByOriginKey.get(originalKey);
      if (!draft) { items.push(clonePlain(item)); return; }
      if (clean(draft.dayId) !== dayId) return;
      items.push({
        ...clonePlain(item),
        time: clean(draft.time), title: clean(draft.title), note: clean(draft.note),
        icon: clean(draft.icon), detail: clean(draft.detail), who: clean(draft.who) || "all",
        booked: Boolean(draft.booked), sortOrder: normalizedSortOrder(draft.sortOrder, index),
        gallery: clonePlain(Array.isArray(draft.gallery) ? draft.gallery : []),
        images: clonePlain(Array.isArray(draft.images) ? draft.images : []),
        location: normalizeDraftLocation(draft.location || {}, draft.title), maps: clean(draft.maps)
      });
    });
    session.draftItems.forEach(draft => {
      if (clean(draft?.dayId) !== dayId) return;
      const originDayId = clean(draft.originDayId || draft.dayId);
      const originKey = itemKey(originDayId, draft.itemId);
      const sourcePayload = sourceItemPayloads.get(originKey);
      const already = items.some(item => clean(item?.itemId) === clean(draft?.itemId));
      if (already) return;
      if (!sourcePayload && !draft.isNew) return;
      if (draft.isNew && !sourcePayload) { items.push(draftToNewItem(draft)); return; }
      items.push({
        ...clonePlain(sourcePayload || {}), itemId: clean(draft.itemId),
        time: clean(draft.time), title: clean(draft.title), note: clean(draft.note),
        icon: clean(draft.icon), detail: clean(draft.detail), who: clean(draft.who) || "all",
        booked: Boolean(draft.booked), sortOrder: normalizedSortOrder(draft.sortOrder),
        gallery: clonePlain(Array.isArray(draft.gallery) ? draft.gallery : []),
        images: clonePlain(Array.isArray(draft.images) ? draft.images : []),
        location: normalizeDraftLocation(draft.location || {}, draft.title), maps: clean(draft.maps)
      });
    });
    day.items = items.sort((a, b) => {
      const ao = normalizedSortOrder(a?.sortOrder), bo = normalizedSortOrder(b?.sortOrder);
      if (ao !== bo) return ao - bo;
      return clean(a?.itemId).localeCompare(clean(b?.itemId));
    });
    return day;
  });
  if (!trip.meta || typeof trip.meta !== "object") trip.meta = {};
  const details = normalizeTripDetails(session.draftTripDetails || session.baseTripDetails || {}, tripDetailsSnapshot(trip));
  trip.meta.titleSmall = details.titleSmall;
  trip.meta.titleMain = details.titleMain;
  trip.meta.tripStartIso = details.startDate;
  trip.meta.tripEndIso = details.endDate;
  trip.meta.dateRange = details.dateRange;
  trip.meta.route = details.route;
  trip.meta.status = details.status;
  trip.meta.travellers = normalizeTravellersForEdit(session.draftTravellers || {});
  trip.meta.flights = normalizeFlightsForEdit(session.draftFlights || []);
  if (revision != null) trip.revision = Math.max(1, Number(revision) || Number(trip.revision) || 1);
  return trip;
}

export async function commitTripEditSession(session, { user: userInput = null } = {}) {
  if (!session?.tripId) {
    const error = new Error("No active edit session");
    error.code = "edit-session-missing";
    throw error;
  }
  const user = userInput;
  if (!user?.uid) {
    const error = new Error("Sign in is required");
    error.code = "auth-required";
    throw error;
  }
  const mediaDelta = tripEditMediaDelta(session);
  if (mediaDelta.additions.length) {
    const error = new Error("Edit media is not ready for commit");
    error.code = "edit-media-not-ready";
    throw error;
  }
  const changes = tripEditChanges(session);
  const dayChanges = tripEditDayChanges(session);
  const domainChanges = tripEditDomainChanges(session);
  const anyDomainChange = domainChanges.tripDetailsChanged || domainChanges.travellersChanged || domainChanges.flightsChanged || dayChanges.length > 0;
  if (!changes.length && !anyDomainChange) return { revision: session.baseRevision, changedItems: 0, changedDays: 0, changedTrip: false, changedTeams: 0, noChange: true };
  if (changes.length + dayChanges.length > 448) {
    const error = new Error("Too many itinerary changes in one edit session");
    error.code = "edit-too-large";
    throw error;
  }

  const tripRef = doc(db, "trips", session.tripId);
  const generalRef = doc(db, "trips", session.tripId, "settings", "general");
  const memberRef = doc(db, "trips", session.tripId, "members", user.uid);
  const logRef = doc(collection(db, "trips", session.tripId, "activityLogs"));

  return runTransaction(db, async tx => {
    const [tripSnap, memberSnap] = await Promise.all([tx.get(tripRef), tx.get(memberRef)]);
    if (!tripSnap.exists()) {
      const error = new Error("Trip no longer exists");
      error.code = "not-found";
      throw error;
    }
    const tripDoc = tripSnap.data() || {};
    if (tripDoc.globalLocked === true) {
      const error = new Error("Trip is globally locked");
      error.code = "trip-global-locked";
      throw error;
    }
    const role = clean(memberSnap.exists() ? memberSnap.data()?.role : "");
    if (!VALID_ROLES.has(role)) {
      const error = new Error("Owner or Admin role required");
      error.code = "insufficient-role";
      throw error;
    }
    const serverRevision = Math.max(1, Number(tripDoc.revision) || 1);
    if (serverRevision !== Math.max(1, Number(session.baseRevision) || 1)) {
      const error = new Error("Trip was updated after this edit session started");
      error.code = "edit-revision-conflict";
      error.serverRevision = serverRevision;
      error.baseRevision = session.baseRevision;
      throw error;
    }

    const nextRevision = serverRevision + 1;
    dayChanges.forEach(change => {
      const ref = doc(db, "trips", session.tripId, "days", change.dayId);
      if (change.operation === "delete") { tx.delete(ref); return; }
      if (change.operation === "create") {
        tx.set(ref, { ...change.data, dayId: change.dayId, createdAt: serverTimestamp(), createdBy: user.uid, updatedAt: serverTimestamp(), updatedBy: user.uid });
        return;
      }
      tx.set(ref, { ...change.patch, updatedAt: serverTimestamp(), updatedBy: user.uid }, { merge: true });
    });
    changes.forEach(change => {
      const ref = doc(db, "trips", session.tripId, "days", change.dayId, "items", change.itemId);
      if (change.operation === "create") {
        tx.set(ref, { ...change.item, createdAt: serverTimestamp(), createdBy: user.uid, updatedAt: serverTimestamp(), updatedBy: user.uid });
        return;
      }
      if (change.operation === "delete") { tx.delete(ref); return; }
      if (change.operation === "move") {
        const fromRef = doc(db, "trips", session.tripId, "days", change.fromDayId, "items", change.itemId);
        const originKey = itemKey(change.fromDayId, change.itemId);
        const draft = [...session.draftItems.values()].find(row => clean(row?.itemId) === clean(change.itemId) && clean(row?.originDayId || row?.dayId) === clean(change.fromDayId));
        const sourcePayload = clonePlain(session.baseItemPayloads?.get?.(originKey) || {});
        const source = sourcePayload && Object.keys(sourcePayload).length
          ? {
              ...sourcePayload,
              itemId: change.itemId,
              time: clean(draft?.time), title: clean(draft?.title), note: clean(draft?.note),
              icon: clean(draft?.icon), detail: clean(draft?.detail), who: clean(draft?.who) || "all",
              booked: Boolean(draft?.booked), sortOrder: normalizedSortOrder(draft?.sortOrder),
              gallery: clonePlain(Array.isArray(draft?.gallery) ? draft.gallery : []),
              images: clonePlain(Array.isArray(draft?.images) ? draft.images : []),
              location: normalizeDraftLocation(draft?.location || {}, draft?.title), maps: clean(draft?.maps),
              ...change.patch
            }
          : { ...draftToNewItem(draft || {}), ...change.patch, itemId: change.itemId };
        delete source.originDayId; delete source.isNew;
        tx.delete(fromRef);
        tx.set(ref, { ...source, updatedAt: serverTimestamp(), updatedBy: user.uid });
        return;
      }
      tx.set(ref, { ...change.patch, updatedAt: serverTimestamp(), updatedBy: user.uid }, { merge: true });
    });
    const tripPatch = {
      revision: nextRevision,
      contentHash: "",
      contentHashVersion: 0,
      updatedAt: serverTimestamp(),
      updatedBy: user.uid
    };
    if (domainChanges.tripDetailsChanged) {
      const details = normalizeTripDetails(session.draftTripDetails || {}, session.baseTripDetails || {});
      tripPatch.title = stripHtml(details.titleMain || details.titleSmall || session.tripId);
      tripPatch.titleSmall = details.titleSmall;
      tripPatch.titleHtml = details.titleMain;
      tripPatch.dateRange = details.dateRange;
      tripPatch.route = details.route;
      tripPatch.startDate = details.startDate;
      tripPatch.endDate = details.endDate;
      tripPatch.status = details.status;
    }
    tx.set(tripRef, tripPatch, { merge: true });
    if (domainChanges.travellersChanged || domainChanges.flightsChanged) {
      // v7.9.15.1 · travellers/flights are canonical aggregate fields. Using
      // merge:true recursively merges nested map keys, so deleting one Team
      // can leave the removed key on the server and make it reappear after a
      // fresh app launch. mergeFields treats these top-level fields as atomic
      // replacements while still preserving unrelated settings/general data.
      tx.set(generalRef, {
        travellers: normalizeTravellersForEdit(session.draftTravellers || {}),
        flights: normalizeFlightsForEdit(session.draftFlights || []),
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      }, { mergeFields: ["travellers", "flights", "updatedAt", "updatedBy"] });
    }
    const summaryParts = [];
    if (changes.length) summaryParts.push(`${changes.length} 個行程項目`);
    if (dayChanges.length) summaryParts.push(`${dayChanges.length} 個行程日`);
    if (domainChanges.tripDetailsChanged) summaryParts.push("旅程資料");
    if (domainChanges.teamChangeCount || domainChanges.flightsChanged) summaryParts.push(`${domainChanges.teamChangeCount} 個 Team`);
    tx.set(logRef, {
      type: "trip.edit.save",
      actionType: "trip.edit.save",
      category: "itinerary",
      title: "儲存旅程編輯",
      summary: `更新 ${summaryParts.join("、") || "旅程內容"} · Revision ${nextRevision}`,
      actorUid: user.uid,
      actorName: clean(user.displayName),
      revision: nextRevision,
      changedItems: changes.length,
      changedDays: dayChanges.length,
      changedTrip: domainChanges.tripDetailsChanged,
      changedTeams: domainChanges.teamChangeCount,
      createdItems: changes.filter(change => change.operation === "create").length,
      movedItems: changes.filter(change => change.operation === "move").length,
      deletedItems: changes.filter(change => change.operation === "delete").length,
      changedItemIds: changes.slice(0, 80).map(change => change.itemId),
      createdAt: serverTimestamp()
    });

    return { revision: nextRevision, changedItems: changes.length, changedDays: dayChanges.length, changedTrip: domainChanges.tripDetailsChanged, changedTeams: domainChanges.teamChangeCount, noChange: false };
  });
}
