from pathlib import Path
import re,json,shutil,hashlib
root=Path('.')
idx=root/'index.html'
s=idx.read_text(encoding='utf-8')
if '7.9.9.2' not in s or not (root/'assets/shell').exists():
    raise SystemExit('Expected v7.9.9.2 shell baseline')

# Reconstruct exact CSS/runtime before changing any Edit UI.
style=re.search(r'<style[^>]*>(.*?)</style>',s,re.S|re.I)
links=list(re.finditer(r'\s*<link rel="stylesheet" href="assets/shell/(app-shell-\d+\.css)\?build=7\.9\.9\.2">',s))
if not style or not links: raise SystemExit('Shell CSS baseline missing')
full_css=style.group(1)+''.join((root/'assets/shell'/m.group(1)).read_text(encoding='utf-8') for m in links)
s=s[:style.start()]+'<style>'+full_css+'</style>'+s[links[-1].end():]
parts=[]
for p in sorted((root/'assets/shell').glob('app-runtime-part-*.js')):
    m=re.fullmatch(r'window\.__travelRuntimeParts\.push\((.*)\);\n?',p.read_text(encoding='utf-8'),re.S)
    if not m: raise SystemExit(f'Bad runtime carrier {p}')
    parts.append(json.loads(m.group(1)))
runtime=''.join(parts)
rt0=s.find('<script src="assets/shell/app-runtime-init.js?build=7.9.9.2"></script>')
rt1=s.find('<script src="assets/shell/app-runtime-exec.js?build=7.9.9.2"></script>')
if rt0<0 or rt1<0: raise SystemExit('Runtime shell baseline missing')
rt1+=len('<script src="assets/shell/app-runtime-exec.js?build=7.9.9.2"></script>')
s=s[:rt0]+'<script>'+runtime+'</script>'+s[rt1:]

# Snapshot protected Day bar source before Edit-only patches.
def func(text,name):
    st=text.find(f'function {name}('); br=text.find('{',st)
    if st<0 or br<0: raise SystemExit(f'Missing {name}')
    depth=0;quote=None;esc=False
    for i in range(br,len(text)):
        c=text[i]
        if quote:
            if esc:esc=False
            elif c=='\\':esc=True
            elif c==quote:quote=None
        else:
            if c in ('"',"'",'`'):quote=c
            elif c=='{':depth+=1
            elif c=='}':
                depth-=1
                if depth==0:return text[st:i+1]
    raise SystemExit(f'Unterminated {name}')
def rule(text,sel):
    st=text.find(sel); br=text.find('{',st)
    if st<0 or br<0: raise SystemExit(f'Missing {sel}')
    depth=0
    for i in range(br,len(text)):
        if text[i]=='{':depth+=1
        elif text[i]=='}':
            depth-=1
            if depth==0:return text[st:i+1]
protected_funcs={n:func(s,n) for n in ['refreshCollapseMetrics','updateCompactHeader','updateCollapsingChrome','scheduleCollapseUpdate']}
protected_rules={x:rule(s,x) for x in ['.day-tabs::before {','.day-tabs.is-stuck::before {']}

s=s.replace('7.9.9.2','7.9.9.3')
# Keep accepted dock styling but place it above a persistent Bottom Navigation.
old='.trip-edit-session-actions{position:fixed;left:50%;bottom:max(16px,calc(env(safe-area-inset-bottom,0px) + 12px));z-index:2050;width:min(456px,calc(100% - 24px));min-height:62px;box-sizing:border-box;padding:6px;display:grid;grid-template-columns:1fr 1fr;align-items:stretch;gap:6px;transform:translateX(-50%);border:1px solid rgba(255,255,255,.62);border-radius:27px;background:linear-gradient(180deg,rgba(255,255,255,.80),rgba(244,247,249,.64));box-shadow:0 16px 38px rgba(20,39,55,.17),0 3px 10px rgba(20,39,55,.08),inset 0 1px 0 rgba(255,255,255,.95);backdrop-filter:blur(30px) saturate(185%);-webkit-backdrop-filter:blur(30px) saturate(185%);}'
new=old.replace('bottom:max(16px,calc(env(safe-area-inset-bottom,0px) + 12px))','bottom:max(86px,calc(env(safe-area-inset-bottom,0px) + 82px))')
if old not in s: raise SystemExit('Edit dock baseline missing')
s=s.replace(old,new,1)
hide='body.trip-edit-mode .bottom-nav{opacity:0;pointer-events:none;transform:translateY(calc(100% + env(safe-area-inset-bottom,0px) + 24px));}'
if hide not in s: raise SystemExit('Bottom nav hide rule missing')
s=s.replace(hide,'body.trip-edit-mode .container{padding-bottom:calc(var(--tabbar-h) + env(safe-area-inset-bottom,0px) + 132px);}',1)

# Native iOS time picker remains, but becomes an invisible overlay that cannot size the sheet.
old_html='<label class="trip-edit-field"><span>時間</span><input class="trip-edit-input" id="trip-edit-item-time" type="time" step="60"></label>'
new_html='<label class="trip-edit-field"><span>時間</span><span class="trip-edit-time-control"><span class="trip-edit-time-display" id="trip-edit-item-time-display">--:--</span><input id="trip-edit-item-time" type="time" step="60" aria-label="時間"></span></label>'
if old_html not in s: raise SystemExit('Time field baseline missing')
s=s.replace(old_html,new_html,1)
old_time='#trip-edit-item-time{display:block;inline-size:100%;min-inline-size:0;max-inline-size:100%;overflow:hidden;}'
new_time='''.trip-edit-time-control{position:relative;display:block;width:100%;min-width:0;max-width:100%;overflow:hidden;border-radius:14px;}\n.trip-edit-time-display{display:flex;width:100%;min-width:0;min-height:46px;box-sizing:border-box;align-items:center;justify-content:center;border:1px solid rgba(15,23,42,.10);border-radius:14px;background:rgba(245,245,248,.88);color:var(--label-primary);font:inherit;font-size:15px;padding:11px 12px;}\n#trip-edit-item-time{position:absolute;inset:0;width:100%;height:100%;min-width:0;max-width:100%;margin:0;padding:0;border:0;opacity:0;appearance:none;-webkit-appearance:none;cursor:pointer;}\n.trip-edit-time-control:focus-within .trip-edit-time-display{border-color:rgba(10,132,255,.56);box-shadow:0 0 0 3px rgba(10,132,255,.10);}\nhtml.theme-dark .trip-edit-time-display,html:not(.theme-light):not(.theme-dark) .trip-edit-time-display{background:rgba(34,34,42,.88);border-color:rgba(255,255,255,.11);color:#f2f2f7;}'''
if old_time not in s: raise SystemExit('Time CSS baseline missing')
s=s.replace(old_time,new_time,1)
old_open='if(time)time.value=draft.time||"";if(title)title.value=draft.title||"";if(note)note.value=draft.note||"";'
new_open='if(time)time.value=draft.time||"";const timeDisplay=document.getElementById("trip-edit-item-time-display");if(timeDisplay)timeDisplay.textContent=String(draft.time||"").trim()||"--:--";if(title)title.value=draft.title||"";if(note)note.value=draft.note||"";'
if old_open not in s: raise SystemExit('Time assignment baseline missing')
s=s.replace(old_open,new_open,1)
marker='document.getElementById("trip-edit-item-done")?.addEventListener("click",()=>void finishTripEditItemModal());'
add=marker+'\nconst tripEditTimeInput=document.getElementById("trip-edit-item-time");\nconst syncTripEditTimeDisplay=()=>{const display=document.getElementById("trip-edit-item-time-display");if(display)display.textContent=String(tripEditTimeInput?.value||"").trim()||"--:--";};\ntripEditTimeInput?.addEventListener("input",syncTripEditTimeDisplay);\ntripEditTimeInput?.addEventListener("change",syncTripEditTimeDisplay);'
if marker not in s: raise SystemExit('Time listener marker missing')
s=s.replace(marker,add,1)
# Future-proof only the sections explicitly intended for Trip Edit Mode; Expenses/Profile stay protected.
guard='if(tripEditSession&&v!=="itinerary"){window.alert("請先儲存或取消今次行程編輯。");return;}'
new_guard='if(tripEditSession&&!["itinerary","snacks","info"].includes(v)){window.alert("編輯模式期間可切換行程、收藏及資料；支出或我的設定請先儲存或取消今次編輯。");return;}'
if guard not in s: raise SystemExit('View guard baseline missing')
s=s.replace(guard,new_guard,1)

# Protected Day bar must remain byte-identical through the Edit-only patch.
for n,v in protected_funcs.items():
    if func(s,n)!=v: raise SystemExit(f'Protected Day function changed: {n}')
for n,v in protected_rules.items():
    if rule(s,n)!=v: raise SystemExit(f'Protected Day CSS changed: {n}')
idx.write_text(s,encoding='utf-8')

# Supporting files and Service Worker cleanup.
for fn in ['manifest.json','sw.js']:
    p=root/fn;text=p.read_text(encoding='utf-8').replace('7.9.9.2','7.9.9.3')
    if fn=='sw.js': text='\n'.join(line for line in text.splitlines() if '"./assets/shell/' not in line)+'\n'
    p.write_text(text,encoding='utf-8')
shutil.rmtree(root/'assets/shell',ignore_errors=True)

ch=root/'CHANGELOG.md';oldch=ch.read_text(encoding='utf-8')
entry='''# v7.9.9.3 · Regression Recovery + Persistent Edit Navigation\n\nThis release deliberately rolls back the v7.9.9.2 shell extraction. The accepted monolithic CSS and classic runtime execution model are restored before applying only the necessary Edit Mode UI corrections. Transit, Map, the protected Day selector and Firebase data semantics are not redesigned.\n\n## Regression recovery\n\n* Restored document-owned CSS and one classic runtime so existing background asset paths and the accepted Day selector sticky/material timing return to the proven execution model.\n* Removed all `assets/shell/*` runtime dependencies from the Service Worker and release package.\n\n## Edit Mode UI\n\n* The accepted floating `取消` / `儲存` dock now sits above the normal Bottom Navigation instead of replacing it.\n* `行程`, `收藏` and `資料` may be previewed while the local Edit Session remains active; `支出` and `我的` stay protected until cross-section editing is formally implemented.\n* The iPhone native time picker remains the real input, but is now an invisible full-field overlay above an app-owned visible time field, preventing WebKit from sizing the edit sheet wider than the viewport.\n* Chronological draft sorting, Map sequence/Stop numbering and the save-once Firestore transaction are unchanged.\n\n'''
ch.write_text(entry+oldch,encoding='utf-8')

# Structural QA.
final=idx.read_text(encoding='utf-8')
if 'assets/shell/' in final or '7.9.9.2' in final: raise SystemExit('Old shell/version reference remains')
if 'assets/bg/bg_trip_mobile.webp' not in final: raise SystemExit('Background path missing')
if 'trip-edit-time-display' not in final: raise SystemExit('Time proxy missing')
if 'body.trip-edit-mode .bottom-nav{opacity:0' in final: raise SystemExit('Bottom nav still hidden')
for fn in ['manifest.json','sw.js','CHANGELOG.md']:
    if '7.9.9.3' not in (root/fn).read_text(encoding='utf-8'): raise SystemExit(f'Version missing {fn}')
for fn in ['manifest.json','firebase.json','firestore.indexes.json','functions/package.json','trip.json']:
    json.loads((root/fn).read_text(encoding='utf-8'))
print('v7.9.9.3 migration QA PASS')
