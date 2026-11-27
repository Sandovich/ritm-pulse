import sys
from pathlib import Path
from choice_pilot import real
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch()
 real(b,sys.argv[1].rstrip("/")+"/",Path(sys.argv[2]),dict(viewport={"width":390,"height":844},locale="ru-RU",is_mobile=True,has_touch=True))
