"""Download the version-pinned Pyodide distribution for GitHub Pages."""
import hashlib
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
BASE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/'
OUT = Path(__file__).resolve().parents[1] / 'docs/runtime'
OUT.mkdir(exist_ok=True,parents=True)
def download(name):
    data=urllib.request.urlopen(BASE+name,timeout=90).read()
    (OUT/name).write_bytes(data)
    return name,len(data)
download('pyodide-lock.json')
lock=json.loads((OUT/'pyodide-lock.json').read_bytes())
wheel=lock['packages']['sqlite3']
with ThreadPoolExecutor(max_workers=5) as pool:
    print(list(pool.map(download,['pyodide.js','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip',wheel['file_name']])))
assert hashlib.sha256((OUT/wheel['file_name']).read_bytes()).hexdigest()==wheel['sha256']
license_url='https://raw.githubusercontent.com/pyodide/pyodide/0.27.7/LICENSE'
(OUT/'LICENSE-Pyodide.txt').write_bytes(urllib.request.urlopen(license_url,timeout=30).read())

