"""Build the Refined Athletic demo from the stable Pages runtime and server UI."""
import argparse
import re
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('athletic', type=Path, help='Directory containing the stable r3 and meeting runtime')
args = parser.parse_args()
stable = args.athletic / 'r3'
target = args.athletic / 'refined'
if not (stable / 'worker.js').is_file() or not (args.athletic / 'meeting/runtime/pyodide.js').is_file():
    parser.error('The original Pages runtime is required')
shutil.copytree(stable, target, dirs_exist_ok=True)
web = root / 'web'
shutil.copytree(web / 'assets', target / 'assets', dirs_exist_ok=True)
shutil.copy2(web / 'premium.js', target / 'premium.js')
html = (web / 'mobile.html').read_text(encoding='utf-8')
preview = (stable / 'index.html').read_text(encoding='utf-8')
runtime = re.search(r'<script src="browser\.js[^"]*"></script>', preview)
if not runtime:
    raise ValueError('Missing Pages runtime entry point')
anchor = '<script src="assets/edition/refined.js"></script>'
assert anchor in html
html = html.replace(anchor, runtime.group() + anchor)
html = html.replace('Внутренний стенд · только тестовые данные', 'Интерактивное демо · данные на этом устройстве')
(target / 'index.html').write_text(html, encoding='utf-8')
