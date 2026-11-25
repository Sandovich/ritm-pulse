"""Generate the GitHub Pages entry from the same mobile UI and domain rules."""
from pathlib import Path
import shutil,ast,json
root=Path(__file__).resolve().parents[1];web=root/'web';out=root/'docs'
files=['premium.css','premium.js','content.js','season.js','app.js','season.py','journey.py','notifications.py','icon.png','icon512.png']
for name in files:shutil.copyfile(web/name,out/name)
shutil.copytree(web/'assets',out/'assets',dirs_exist_ok=True,ignore=shutil.ignore_patterns('oats.webp'))
src=(web/'server.py').read_text('utf8')
tree=ast.parse(src)
nodes=[]
for node in tree.body:
    if isinstance(node,ast.ClassDef) and node.name=='RateLimit':break
    if isinstance(node,ast.ImportFrom) and (node.module.startswith('http') or node.module=='threading'):continue
    nodes.append(node)
(out/'core.py').write_text(ast.unparse(ast.Module(body=nodes,type_ignores=[]))+'\n','utf8')
html=(web/'mobile.html').read_text('utf8').replace('<!-- preview-runtime -->','<script src="browser.js"></script>')
(out/'index.html').write_text(html,'utf8')
manifest=json.loads((web/'manifest.webmanifest').read_text('utf-8-sig'))
manifest.update(start_url='./',scope='./',background_color='#101110',theme_color='#101110')
for icon in manifest['icons']:icon['src']=icon['src'].lstrip('/')
(out/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False),'utf8')
(out/'.nojekyll').touch()

