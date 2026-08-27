from pathlib import Path
import re, subprocess, sys, json, hashlib

EXPECTED = {
    'index.html': '4ed7cf86bc7266f1d2c5e77af61c5afd439891b1',
    'assets/js/trip-map-service.js': 'd90ac6c919588acbeec1d975731dbb6c574723f1',
    'manifest.json': 'a487c1107d9f48e2fbbc6f7365ee2d81147f6ad9',
    'sw.js': '9d5e09683e477f2d1e6fa00b64a59d6f2a9fd913',
}
for path, expected in EXPECTED.items():
    got = subprocess.check_output(['git','rev-parse',f'HEAD:{path}'], text=True).strip()
    if got != expected:
        raise SystemExit(f'Baseline guard failed for {path}: {got} != {expected}')

idx=Path('index.html')
s=idx.read_text()
s=s.replace('7.9.10.0','7.9.10.1')
pat=re.compile(r'''function transitGoogleMapsEndpoint\(record=\{\},fallback="地點"\)\{\n  const loc=record\?\.location&&typeof record\.location==="object"\?record\.location:\{\};\n  const lat=Number\(loc\?\.latitude\?\?loc\?\.lat\),lng=Number\(loc\?\.longitude\?\?loc\?\.lng\?\?loc\?\.lon\);\n  const placeId=String\(loc\?\.placeId\|\|record\?\.placeId\|\|""\)\.trim\(\);\n  if\(Number\.isFinite\(lat\)&&Number\.isFinite\(lng\)\)return \{value:`\$\{lat\},\$\{lng\}`,placeId\};\n  const mapsUrl=String\(loc\?\.mapsUrl\|\|record\?\.maps\|\|record\?\.mapsUrl\|\|record\?\.googleMapsUrl\|\|""\)\.trim\(\);\n  if\(mapsUrl\)\{try\{const parsed=new URL\(mapsUrl,location\.href\),query=String\(parsed\.searchParams\.get\("query"\)\|\|parsed\.searchParams\.get\("q"\)\|\|""\)\.trim\(\),queryPlaceId=String\(parsed\.searchParams\.get\("query_place_id"\)\|\|""\)\.trim\(\);if\(query\)return \{value:query,placeId:placeId\|\|queryPlaceId\};\}catch\(_\)\{\}\}\n  const value=String\(loc\?\.address\|\|record\?\.address\|\|loc\?\.name\|\|record\?\.title\|\|record\?\.name\|\|fallback\)\.trim\(\)\|\|fallback;\n  return \{value,placeId\};\n\}''')
new='''function transitGoogleMapsEndpoint(record={},fallback="地點"){
  const loc=record?.location&&typeof record.location==="object"?record.location:{};
  const lat=Number(loc?.latitude??loc?.lat),lng=Number(loc?.longitude??loc?.lng??loc?.lon);
  let placeId=String(loc?.placeId||record?.placeId||"").trim();
  const officialName=String(loc?.name||record?.locationName||record?.title||record?.name||"").trim();
  const address=String(loc?.address||record?.address||"").trim();
  const mapsUrl=String(loc?.mapsUrl||record?.maps||record?.mapsUrl||record?.googleMapsUrl||"").trim();
  let mapsQuery="";
  if(mapsUrl){try{const parsed=new URL(mapsUrl,location.href);mapsQuery=String(parsed.searchParams.get("query")||parsed.searchParams.get("q")||parsed.searchParams.get("destination")||"").trim();placeId=placeId||String(parsed.searchParams.get("query_place_id")||parsed.searchParams.get("destination_place_id")||parsed.searchParams.get("place_id")||"").trim();}catch(_){} }
  if(placeId)return {value:officialName||mapsQuery||address||fallback,placeId};
  if(Number.isFinite(lat)&&Number.isFinite(lng))return {value:`${lat},${lng}`,placeId:""};
  if(mapsQuery)return {value:mapsQuery,placeId:""};
  return {value:address||officialName||fallback,placeId:""};
}'''
s,n=pat.subn(new,s)
if n!=1: raise SystemExit(f'deep link endpoint replacement count {n}')
needle='''        <div class="trip-edit-location-search">
          <input class="trip-edit-input" id="trip-edit-location-query" type="text" autocomplete="off" maxlength="240" placeholder="輸入地點、地址或 Google Maps 連結">
          <button class="trip-edit-location-search-btn" id="trip-edit-location-search-btn" type="button">搜尋</button>
        </div>
        <div class="trip-edit-location-status" id="trip-edit-location-status">可選；未設定定位嘅地點唔會加入 Map route sequence。</div>'''
repl='''        <div class="trip-edit-location-search">
          <input class="trip-edit-input" id="trip-edit-location-query" type="text" autocomplete="off" maxlength="240" placeholder="輸入店舖、景點、車站或地址">
          <button class="trip-edit-location-search-btn" id="trip-edit-location-search-btn" type="button">搜尋</button>
        </div>
        <div class="trip-edit-location-link-separator"><span>或貼上 Google Maps 連結</span></div>
        <div class="trip-edit-location-search trip-edit-location-link-row">
          <input class="trip-edit-input" id="trip-edit-location-link" type="url" inputmode="url" autocomplete="off" maxlength="900" placeholder="https://www.google.com/maps/…">
          <button class="trip-edit-location-search-btn" id="trip-edit-location-link-btn" type="button">匯入</button>
        </div>
        <div class="trip-edit-location-link-note">完整 Google Maps 網址可用正式 Place ID／名稱重新確認；短連結如無法解析會提示改用上面 Places 搜尋。</div>
        <div class="trip-edit-location-status" id="trip-edit-location-status">可選；未設定定位嘅地點唔會加入 Map route sequence。</div>'''
if needle not in s: raise SystemExit('modal search UI needle missing')
s=s.replace(needle,repl,1)
cssneedle='''.trip-edit-location-search-btn:disabled{opacity:.48;}
.trip-edit-location-status{font-size:10.5px;line-height:1.45;color:var(--label-secondary);padding:0 2px;}'''
cssrepl='''.trip-edit-location-search-btn:disabled{opacity:.48;}
.trip-edit-location-link-separator{display:flex;align-items:center;gap:8px;color:var(--label-secondary);font-size:9.5px;line-height:1;padding:1px 2px;}
.trip-edit-location-link-separator::before,.trip-edit-location-link-separator::after{content:"";height:1px;flex:1;background:rgba(118,118,128,.16);transform:scaleY(.5);}
.trip-edit-location-link-row .trip-edit-input{font-size:12px;}
.trip-edit-location-link-note{font-size:9.5px;line-height:1.4;color:var(--label-secondary);padding:0 2px;}
.trip-edit-location-status{font-size:10.5px;line-height:1.45;color:var(--label-secondary);padding:0 2px;}'''
if cssneedle not in s: raise SystemExit('css needle missing')
s=s.replace(cssneedle,cssrepl,1)
old='''  const field=document.getElementById("trip-edit-location-field"),query=document.getElementById("trip-edit-location-query"),button=document.getElementById("trip-edit-location-search-btn");
  const isStop=String(kind||"")!=="transit";if(field)field.hidden=!isStop;if(button){button.disabled=false;button.textContent="搜尋";}
  if(!isStop){tripEditLocationSelection=tripEditBlankLocation();if(query)query.value="";return;}
  const loc=tripEditNormalizeLocation(value);tripEditRenderLocationSelection(loc);
  if(query)query.value=loc.name||loc.address||"";'''
new='''  const field=document.getElementById("trip-edit-location-field"),query=document.getElementById("trip-edit-location-query"),link=document.getElementById("trip-edit-location-link"),button=document.getElementById("trip-edit-location-search-btn"),linkButton=document.getElementById("trip-edit-location-link-btn");
  const isStop=String(kind||"")!=="transit";if(field)field.hidden=!isStop;if(button){button.disabled=false;button.textContent="搜尋";}if(linkButton){linkButton.disabled=false;linkButton.textContent="匯入";}
  if(link)link.value="";
  if(!isStop){tripEditLocationSelection=tripEditBlankLocation();if(query)query.value="";return;}
  const loc=tripEditNormalizeLocation(value);tripEditRenderLocationSelection(loc);
  if(query)query.value=loc.name||loc.address||"";'''
if old not in s: raise SystemExit('configure needle missing')
s=s.replace(old,new,1)
old='''    if(status)status.textContent=error?.code==="maps-not-configured"?"Google Maps 尚未設定，暫時未能搜尋定位。":"Google 地點搜尋暫時未能使用，請稍後再試。";'''
new='''    if(status){
      if(error?.code==="maps-short-link")status.textContent="呢個係 Google Maps 短連結，純 browser 無法可靠展開。請用上面 Places 搜尋店名，或者喺瀏覽器貼完整 google.com/maps 網址。";
      else if(error?.code==="maps-link-unresolved")status.textContent="呢條 Google Maps 連結未能識別正式地點；請改用店名／景點名搜尋，再揀正確結果。";
      else status.textContent=error?.code==="maps-not-configured"?"Google Maps 尚未設定，暫時未能搜尋定位。":"Google 地點搜尋暫時未能使用，請稍後再試。";
    }'''
if old not in s: raise SystemExit('search catch needle missing')
s=s.replace(old,new,1)
needle='''function tripEditApplyDraftPreview(dayId,itemId,draft){'''
helper='''async function tripEditImportMapsLink(){
  if(!tripEditSession||tripEditTargetKind()!=="stop")return;
  const link=document.getElementById("trip-edit-location-link"),query=document.getElementById("trip-edit-location-query"),button=document.getElementById("trip-edit-location-link-btn"),status=document.getElementById("trip-edit-location-status");
  const value=String(link?.value||"").trim();
  if(!value){if(status)status.textContent="請先貼上 Google Maps 連結。";link?.focus();return;}
  let parsed=null;try{parsed=new URL(value);}catch(_){if(status)status.textContent="呢個唔似有效網址，請重新貼上 Google Maps 連結。";link?.focus();return;}
  const host=String(parsed.hostname||"").toLowerCase();
  const isGoogle=host==="maps.app.goo.gl"||host==="goo.gl"||host.endsWith(".google.com")||host==="google.com"||host.endsWith(".google.co.jp")||host==="google.co.jp";
  if(!isGoogle){if(status)status.textContent="暫時只支援 Google Maps 連結。";return;}
  if(query)query.value=value;
  if(button){button.disabled=true;button.textContent="匯入中…";}
  try{await tripEditSearchLocation();}
  finally{if(button){button.disabled=false;button.textContent="匯入";}}
}
function tripEditApplyDraftPreview(dayId,itemId,draft){'''
if needle not in s: raise SystemExit('helper insertion needle missing')
s=s.replace(needle,helper,1)
old='''document.getElementById("trip-edit-location-search-btn")?.addEventListener("click",()=>void tripEditSearchLocation());
document.getElementById("trip-edit-location-query")?.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();void tripEditSearchLocation();}});
document.getElementById("trip-edit-location-clear")?.addEventListener("click",()=>{tripEditRenderLocationSelection(tripEditBlankLocation());tripEditResetLocationResults();const query=document.getElementById("trip-edit-location-query");if(query)query.value="";});'''
new='''document.getElementById("trip-edit-location-search-btn")?.addEventListener("click",()=>void tripEditSearchLocation());
document.getElementById("trip-edit-location-query")?.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();void tripEditSearchLocation();}});
document.getElementById("trip-edit-location-link-btn")?.addEventListener("click",()=>void tripEditImportMapsLink());
document.getElementById("trip-edit-location-link")?.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();void tripEditImportMapsLink();}});
document.getElementById("trip-edit-location-clear")?.addEventListener("click",()=>{tripEditRenderLocationSelection(tripEditBlankLocation());tripEditResetLocationResults();const query=document.getElementById("trip-edit-location-query"),link=document.getElementById("trip-edit-location-link");if(query)query.value="";if(link)link.value="";});'''
if old not in s: raise SystemExit('event wiring needle missing')
s=s.replace(old,new,1)
idx.write_text(s)

mp=Path('assets/js/trip-map-service.js')
m=mp.read_text()
old='''function mapsQueryFromUrl(input) {
  const raw = clean(input);
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.href);
    const query = clean(url.searchParams.get("query") || url.searchParams.get("q"));
    if (query) return query.replace(/\+/g, " ");
    const path = decodeURIComponent(url.pathname || "");
    const placeMatch = path.match(/\/place\/([^/]+)/i);
    if (placeMatch?.[1]) return clean(placeMatch[1].replace(/\+/g, " "));
  } catch (_) {}
  return "";
}
function mapsPlaceIdFromUrl(input) {
  const raw = clean(input);
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.href);
    return clean(url.searchParams.get("query_place_id") || url.searchParams.get("place_id"));
  } catch (_) { return ""; }
}'''
new='''function googleMapsUrlInfo(input) {
  const raw = clean(input);
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    const host = clean(url.hostname).toLowerCase();
    const isShort = host === "maps.app.goo.gl" || host === "goo.gl";
    const isGoogle = isShort || host === "google.com" || host.endsWith(".google.com") || host === "google.co.jp" || host.endsWith(".google.co.jp");
    if (!isGoogle) return null;
    const query = clean(url.searchParams.get("query") || url.searchParams.get("q") || url.searchParams.get("destination"));
    const embeddedPlaceId = clean(raw.match(/!1s(ChI[^!/?&#]+)/)?.[1]);
    const placeId = clean(url.searchParams.get("query_place_id") || url.searchParams.get("destination_place_id") || url.searchParams.get("place_id") || embeddedPlaceId);
    const path = decodeURIComponent(url.pathname || "");
    const placeMatch = path.match(/\/place\/([^/]+)/i);
    const pathName = clean(placeMatch?.[1]?.replace(/\+/g, " "));
    const directCoords = [query, clean(url.searchParams.get("center")), clean(url.searchParams.get("ll"))]
      .map(value => String(value || "").match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/))
      .find(Boolean);
    const dataCoords = raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
    const atCoords = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|\/|$)/);
    const match = dataCoords || directCoords || atCoords;
    const latitude = match ? finiteNumber(match[1]) : null;
    const longitude = match ? finiteNumber(match[2]) : null;
    return {raw,isShort,query:(query && !directCoords ? query.replace(/\+/g, " ") : "") || pathName,placeId,coords:latitude == null || longitude == null ? null : { lat: latitude, lng: longitude }};
  } catch (_) { return null; }
}
function mapsQueryFromUrl(input) { return clean(googleMapsUrlInfo(input)?.query); }
function mapsPlaceIdFromUrl(input) { return clean(googleMapsUrlInfo(input)?.placeId); }'''
if old not in m: raise SystemExit('map URL parser needle missing')
m=m.replace(old,new,1)
old='''export async function searchEditableLocations(input, { limit = 5 } = {}) {
  const raw = clean(input);
  if (!raw) return [];
  const urlPlaceId = mapsPlaceIdFromUrl(raw);
  const query = mapsQueryFromUrl(raw) || raw;
  const max = Math.max(1, Math.min(8, Number(limit) || 5));
  if (urlPlaceId) return geocoderEditableLocations(query, { placeId: urlPlaceId, limit: max });
  try {
    const { AutocompleteSessionToken, AutocompleteSuggestion } = await loadGooglePlacesLibrary();
    const sessionToken = new AutocompleteSessionToken();
    const request = { input: query, sessionToken };
    const language = clean(GOOGLE_MAPS_CONFIG?.language);
    if (language) request.language = language;
    const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);'''
new='''export async function searchEditableLocations(input, { limit = 5 } = {}) {
  const raw = clean(input);
  if (!raw) return [];
  const linkInfo = googleMapsUrlInfo(raw);
  if (linkInfo?.isShort) { const error = new Error("Google Maps short links cannot be safely expanded in browser-only mode"); error.code = "maps-short-link"; throw error; }
  const urlPlaceId = clean(linkInfo?.placeId || mapsPlaceIdFromUrl(raw));
  const query = clean(linkInfo?.query || mapsQueryFromUrl(raw) || (linkInfo ? "" : raw));
  const max = Math.max(1, Math.min(8, Number(limit) || 5));
  if (urlPlaceId) return geocoderEditableLocations(query, { placeId: urlPlaceId, limit: max });
  if (linkInfo && !query && linkInfo.coords) {
    const manual = await reverseGeocodeEditableLocation({ latitude: linkInfo.coords.lat, longitude: linkInfo.coords.lng, name: "Google Maps 定位" });
    return [{ ...manual, source: "google-maps-link", resolved: true, addressHint: manual.address }];
  }
  if (linkInfo && !query) { const error = new Error("Google Maps link does not expose a resolvable place"); error.code = "maps-link-unresolved"; throw error; }
  try {
    const { AutocompleteSessionToken, AutocompleteSuggestion } = await loadGooglePlacesLibrary();
    const sessionToken = new AutocompleteSessionToken();
    const request = { input: query, sessionToken };
    if (linkInfo?.coords) { request.locationBias = { center: linkInfo.coords, radius: 1800 }; request.origin = linkInfo.coords; }
    const language = clean(GOOGLE_MAPS_CONFIG?.language);
    if (language) request.language = language;
    const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);'''
if old not in m: raise SystemExit('searchEditableLocations needle missing')
m=m.replace(old,new,1)
mp.write_text(m)

for rel in ['manifest.json','sw.js']:
    p=Path(rel); p.write_text(p.read_text().replace('7.9.10.0','7.9.10.1'))

ch=Path('CHANGELOG.md')
entry='''# v7.9.10.1 · Phase 3E Place Identity + Google Maps Link Import

* Transit Google Maps Deep Links now preserve a selected Google Places establishment or POI as a named Place ID endpoint. Canonical coordinates remain available for in-app Map and Transit planning, but no longer override official place identity in the consumer Google Maps Directions URL.
* A manual tap on the Location Preview map still intentionally clears Place ID identity and remains a coordinate-based custom pin, keeping official Places selections and user-defined pins semantically distinct.
* Added a second Stop Location Picker input for full Google Maps URLs. Expanded `google.com/maps/...` links can recover Place IDs directly or use the embedded place name plus map coordinates as a Places search bias before the user confirms a candidate.
* Browser-only builds detect `maps.app.goo.gl` / `goo.gl` short links and explain that they cannot be reliably expanded cross-origin; Places search remains the supported fallback without adding a backend redirect resolver.
* Protected Day selector behaviour, Trip Overview Map, Japan ls8h / non-Japan Google Transit providers, Firebase Rules, media and the single Edit Session Save transaction are unchanged.

'''
text=ch.read_text()
if not text.startswith('# v7.9.10.1 ·'):
    ch.write_text(entry+text)

print('v7.9.10.1 patch applied')
