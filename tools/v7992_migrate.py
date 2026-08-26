from pathlib import Path
import re, json, hashlib, sys

root=Path('.')
index=root/'index.html'
if not index.exists():
    raise SystemExit('index.html missing')
s=index.read_text(encoding='utf-8')
if 'const APP_VERSION = "7.9.9.1";' not in s:
    raise SystemExit('Expected v7.9.9.1 index baseline')
s=s.replace('7.9.9.1','7.9.9.2')

# Edit UI: remove crowded header actions and move active Edit Session actions
# into the existing bottom-navigation position.
old='''            <div class="trip-edit-session-actions" id="trip-edit-session-actions" hidden>\n              <button class="trip-edit-text-btn" id="trip-edit-cancel-btn" type="button">取消</button>\n              <button class="trip-edit-text-btn is-primary" id="trip-edit-save-btn" type="button">儲存</button>\n            </div>\n'''
if old not in s: raise SystemExit('Edit header action block not found')
s=s.replace(old,'',1)
marker='<nav class="bottom-nav" id="bottom-nav" aria-label="主要導覽">'
action='''<div class="trip-edit-session-actions" id="trip-edit-session-actions" hidden aria-label="編輯模式操作">\n  <button class="trip-edit-text-btn" id="trip-edit-cancel-btn" type="button">取消</button>\n  <button class="trip-edit-text-btn is-primary" id="trip-edit-save-btn" type="button">儲存</button>\n</div>\n\n'''
if marker not in s: raise SystemExit('Bottom nav marker not found')
s=s.replace(marker,action+marker,1)

old_css='''.trip-edit-btn{display:none !important;}.trip-edit-session-actions[hidden]{display:none !important;}\n.trip-edit-session-actions{display:flex;align-items:center;gap:6px;}\n.trip-edit-text-btn{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid rgba(15,23,42,.10);background:rgba(255,255,255,.72);color:#1478d4;font:inherit;font-size:12px;font-weight:760;backdrop-filter:blur(18px) saturate(1.1);-webkit-backdrop-filter:blur(18px) saturate(1.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.72);}\n.trip-edit-text-btn.is-primary{background:#1478d4;color:#fff;border-color:#1478d4;}\n.trip-edit-text-btn:disabled{opacity:.48;}'''
new_css='''.trip-edit-btn{display:none !important;}.trip-edit-session-actions[hidden]{display:none !important;}\n.trip-edit-session-actions{position:fixed;left:50%;bottom:max(16px,calc(env(safe-area-inset-bottom,0px) + 12px));z-index:2050;width:min(456px,calc(100% - 24px));min-height:62px;box-sizing:border-box;padding:6px;display:grid;grid-template-columns:1fr 1fr;align-items:stretch;gap:6px;transform:translateX(-50%);border:1px solid rgba(255,255,255,.62);border-radius:27px;background:linear-gradient(180deg,rgba(255,255,255,.80),rgba(244,247,249,.64));box-shadow:0 16px 38px rgba(20,39,55,.17),0 3px 10px rgba(20,39,55,.08),inset 0 1px 0 rgba(255,255,255,.95);backdrop-filter:blur(30px) saturate(185%);-webkit-backdrop-filter:blur(30px) saturate(185%);}\n.trip-edit-text-btn{min-width:0;min-height:48px;padding:0 14px;border-radius:21px;border:0;background:transparent;color:#1478d4;font:inherit;font-size:14px;line-height:1;font-weight:720;letter-spacing:0;display:flex;align-items:center;justify-content:center;white-space:nowrap;}\n.trip-edit-text-btn.is-primary{background:#1478d4;color:#fff;box-shadow:0 4px 12px rgba(20,120,212,.20),inset 0 1px 0 rgba(255,255,255,.20);}\n.trip-edit-text-btn:disabled{opacity:.48;}'''
if old_css not in s: raise SystemExit('Edit CSS baseline not found')
s=s.replace(old_css,new_css,1)
s=s.replace('.trip-edit-form{display:grid;gap:12px;}','.trip-edit-form{display:grid;gap:12px;min-width:0;}',1)
s=s.replace('.trip-edit-field{display:grid;gap:6px;}','.trip-edit-field{display:grid;gap:6px;min-width:0;}',1)
s=s.replace('.trip-edit-input,.trip-edit-textarea{width:100%;box-sizing:border-box;', '.trip-edit-input,.trip-edit-textarea{width:100%;min-width:0;max-width:100%;box-sizing:border-box;',1)
needle='.trip-edit-textarea{min-height:92px;resize:vertical;line-height:1.45;}'
if needle not in s: raise SystemExit('Textarea CSS marker missing')
s=s.replace(needle,needle+'\n#trip-edit-item-time{display:block;inline-size:100%;min-inline-size:0;max-inline-size:100%;overflow:hidden;}',1)
dark_old='html.theme-dark .trip-edit-text-btn,html:not(.theme-light):not(.theme-dark) .trip-edit-text-btn,html.theme-dark .itinerary-edit-accessory,html:not(.theme-light):not(.theme-dark) .itinerary-edit-accessory{background:rgba(40,40,48,.82);border-color:rgba(255,255,255,.12);color:#69aef5;}'
dark_new='html.theme-dark .trip-edit-session-actions,html:not(.theme-light):not(.theme-dark) .trip-edit-session-actions{background:linear-gradient(180deg,rgba(42,42,48,.88),rgba(28,28,34,.78));border-color:rgba(255,255,255,.14);box-shadow:0 12px 32px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.08);}\nhtml.theme-dark .trip-edit-text-btn,html:not(.theme-light):not(.theme-dark) .trip-edit-text-btn,html.theme-dark .itinerary-edit-accessory,html:not(.theme-light):not(.theme-dark) .itinerary-edit-accessory{background:transparent;border-color:rgba(255,255,255,.12);color:#69aef5;}'
if dark_old not in s: raise SystemExit('Dark edit CSS marker missing')
s=s.replace(dark_old,dark_new,1)
end='html.theme-dark .trip-edit-input,html.theme-dark .trip-edit-textarea,html:not(.theme-light):not(.theme-dark) .trip-edit-input,html:not(.theme-light):not(.theme-dark) .trip-edit-textarea{background:rgba(34,34,42,.88);border-color:rgba(255,255,255,.11);color:#f2f2f7;}'
if end not in s: raise SystemExit('Edit CSS end marker missing')
s=s.replace(end,end+'\nbody.trip-edit-mode .bottom-nav{opacity:0;pointer-events:none;transform:translateY(calc(100% + env(safe-area-inset-bottom,0px) + 24px));}',1)
index.write_text(s,encoding='utf-8')

# Supporting version files.
for fn in ['manifest.json','sw.js']:
    p=root/fn
    p.write_text(p.read_text(encoding='utf-8').replace('7.9.9.1','7.9.9.2'),encoding='utf-8')

# Changelog.
ch=root/'CHANGELOG.md';oldch=ch.read_text(encoding='utf-8')
entry='''# v7.9.9.2 · Low-Risk Shell Extraction + Edit UI Refinement\n\nThis release deliberately avoids feature refactoring. It keeps the accepted v7.9.9.1 Edit Session, Transit, Map and protected Day bar behaviour while shrinking the monolithic `index.html` into connector-friendly shell assets.\n\n## Edit UI\n\n* Edit Session `取消` / `儲存` actions move out of the crowded itinerary header into a dedicated two-button floating action bar in the existing bottom-navigation position. The normal tab bar temporarily yields to the Edit Session actions, keeping both actions on one line and preventing accidental view switching while editing.\n* The native iOS `input type=time` picker remains in use, but the field now has explicit zero minimum width / inline-size containment so WebKit cannot push the control beyond the right edge of the edit sheet.\n* No change to Edit Session data semantics, chronological draft ordering, Firebase save-once transaction, Map draft preview or Stop numbering.\n\n## Low-risk shell extraction\n\n* The original inline CSS remains in exactly the same cascade order: a small first-paint prefix stays inline, while the remaining rules are moved into ordered `assets/shell/app-shell-*.css` files.\n* The early visual/performance boot script stays inline and unchanged so first-paint / warm-resume timing is untouched.\n* The original main runtime source is preserved byte-for-byte and still executes as one classic script. For GitHub transport only, its text is stored in ordered small `assets/shell/app-runtime-part-*.js` carrier files; a tiny executor concatenates the text and injects one classic script at the exact former runtime position. This preserves function hoisting, global lexical scope and document-relative dynamic imports.\n* Runtime carrier scripts are parser-blocking and execute before document parsing completes, so the existing window-load registration timing is preserved.\n* All shell parts are transactional critical Service Worker assets; an incomplete deployment cannot replace the last known-good worker.\n* Protected Day bar CSS and collapsing/sticky logic are exact-match retained from v7.9.9.1.\n\n'''
ch.write_text(entry+oldch,encoding='utf-8')

# Shell extraction helpers.
def css_boundaries(text):
    out=[];depth=0;quote=None;esc=False;comment=False;i=0
    while i<len(text):
        c=text[i];n=text[i+1] if i+1<len(text) else ''
        if comment:
            if c=='*' and n=='/': comment=False;i+=2;continue
            i+=1;continue
        if quote:
            if esc:esc=False
            elif c=='\\':esc=True
            elif c==quote:quote=None
            i+=1;continue
        if c=='/' and n=='*':comment=True;i+=2;continue
        if c in ('"',"'"):quote=c;i+=1;continue
        if c=='{':depth+=1
        elif c=='}':
            depth-=1
            if depth==0:out.append(i+1)
        i+=1
    if depth!=0: raise SystemExit('CSS brace imbalance')
    return out

s=index.read_text(encoding='utf-8')
shell=root/'assets'/'shell';shell.mkdir(parents=True,exist_ok=True)
style=re.search(r'<style[^>]*>(.*?)</style>',s,re.S|re.I)
if not style: raise SystemExit('Inline style missing')
css=style.group(1);b=css_boundaries(css)
cand=[x for x in b if 50000<=x<=70000]
if not cand: raise SystemExit('No CSS prefix split point')
prefix_end=min(cand,key=lambda x:abs(x-60000));prefix=css[:prefix_end];rest=css[prefix_end:];rb=[x-prefix_end for x in b if x>prefix_end]
css_parts=[];start=0
while start<len(rest):
    if len(rest)-start<=60000:endpos=len(rest)
    else:
        choices=[x for x in rb if start+42000<=x<=start+60000]
        if not choices: raise SystemExit('No CSS part boundary')
        endpos=min(choices,key=lambda x:abs(x-(start+52000)))
    css_parts.append(rest[start:endpos]);start=endpos
links=[]
for i,part in enumerate(css_parts,1):
    fn=f'app-shell-{i:02d}.css';(shell/fn).write_text(part,encoding='utf-8');links.append(f'<link rel="stylesheet" href="assets/shell/{fn}?build=7.9.9.2">')
style_replacement='<style>'+prefix+'</style>\n  '+'\n  '.join(links)
s=s[:style.start()]+style_replacement+s[style.end():]

# Main runtime carrier parts. Keep early inline visual boot untouched.
inline=[m for m in re.finditer(r'<script([^>]*)>(.*?)</script>',s,re.S|re.I) if 'src=' not in m.group(1).lower()]
if len(inline)!=2: raise SystemExit(f'Expected 2 inline scripts, got {len(inline)}')
runtime_m=inline[1];runtime=runtime_m.group(2)
raw_size=48000
rparts=[runtime[i:i+raw_size] for i in range(0,len(runtime),raw_size)]
(shell/'app-runtime-init.js').write_text('window.__travelRuntimeParts=[];\n',encoding='utf-8')
tags=['<script src="assets/shell/app-runtime-init.js?build=7.9.9.2"></script>']
for i,part in enumerate(rparts,1):
    fn=f'app-runtime-part-{i:02d}.js'
    carrier='window.__travelRuntimeParts.push('+json.dumps(part,ensure_ascii=False,separators=(',',':'))+');\n'
    (shell/fn).write_text(carrier,encoding='utf-8')
    tags.append(f'<script src="assets/shell/{fn}?build=7.9.9.2"></script>')
exec_js='''(function(){\n  var parts=window.__travelRuntimeParts||[];\n  var source=parts.join("");\n  var node=document.createElement("script");\n  node.text=source+"\\n//# sourceURL=travel-app-runtime.js";\n  document.currentScript.before(node);\n  try{delete window.__travelRuntimeParts;}catch(_){window.__travelRuntimeParts=[];}\n})();\n'''
(shell/'app-runtime-exec.js').write_text(exec_js,encoding='utf-8')
tags.append('<script src="assets/shell/app-runtime-exec.js?build=7.9.9.2"></script>')
s=s[:runtime_m.start()]+'\n'.join(tags)+s[runtime_m.end():]
index.write_text(s,encoding='utf-8')

# Service Worker critical shell list.
critical=[]
for p in sorted(shell.glob('app-shell-*.css')):critical.append('./'+p.as_posix())
critical.append('./assets/shell/app-runtime-init.js')
for p in sorted(shell.glob('app-runtime-part-*.js')):critical.append('./'+p.as_posix())
critical.append('./assets/shell/app-runtime-exec.js')
sw=root/'sw.js';swtext=sw.read_text(encoding='utf-8')
needle='  "./manifest.json",\n  "./trip.json",'
block='  "./manifest.json",\n'+''.join(f'  "{x}",\n' for x in critical)+'  "./trip.json",'
if needle not in swtext: raise SystemExit('SW insertion marker missing')
sw.write_text(swtext.replace(needle,block,1),encoding='utf-8')

# Remove an unused one-off file if it exists from an interrupted earlier attempt.
(root/'app-visual-boot.js').unlink(missing_ok=True)

# QA: reconstruct app runtime exactly, check syntax-adjacent integrity, IDs, JSON,
# versions, shell refs, and ensure every SW local asset exists.
reconstructed=[]
for p in sorted(shell.glob('app-runtime-part-*.js')):
    text=p.read_text(encoding='utf-8')
    mm=re.fullmatch(r'window\.__travelRuntimeParts\.push\((.*)\);\n?',text,re.S)
    if not mm: raise SystemExit(f'Invalid carrier: {p}')
    reconstructed.append(json.loads(mm.group(1)))
if ''.join(reconstructed)!=runtime: raise SystemExit('Runtime reconstruction mismatch')
idx=index.read_text(encoding='utf-8')
ids=re.findall(r'\bid=["\']([^"\']+)["\']',idx)
if len(ids)!=len(set(ids)): raise SystemExit('Duplicate static DOM IDs')
for fn in ['manifest.json','firebase.json','firestore.indexes.json','functions/package.json','trip.json']:
    json.loads((root/fn).read_text(encoding='utf-8'))
for fn in ['index.html','manifest.json','sw.js','CHANGELOG.md']:
    if '7.9.9.2' not in (root/fn).read_text(encoding='utf-8'):raise SystemExit(f'Version mismatch: {fn}')
for q in re.findall(r'"(\./[^"?]+)"',sw.read_text(encoding='utf-8')):
    fp=q[2:]
    if fp and not (root/fp).exists():raise SystemExit(f'Missing SW asset: {fp}')

# Self-clean migration bootstrap; final repository stays clean.
(root/'.github/workflows/v7992-migrate.yml').unlink(missing_ok=True)
(root/'tools/v7992_migrate.py').unlink(missing_ok=True)
print('v7.9.9.2 migration QA PASS')
