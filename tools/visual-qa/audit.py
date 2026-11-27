"""Audit synthetic, local RITM fixtures using a fresh browser context on every run."""
import argparse
import json
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

here = Path(__file__).resolve().parent
root = here.parents[1] / "web"

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

@contextmanager
def local_server():
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(root)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join()

def run(page, url, name, output):
    failed = []
    errors = []
    def network(response):
        if response.status >= 400:
            failed.append([response.status, urlsplit(response.url).path])
    def error(exc):
        errors.append(str(exc))
    page.on("response", network)
    page.on("pageerror", error)
    page.goto(url, wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    page.add_script_tag(path=str(here / "node_modules/axe-core/axe.min.js"))
    results = page.evaluate("""async () => {
      const report = await axe.run(document, {runOnly: {type:'tag',
        values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});
      return report.violations.map(r=>({id:r.id, impact:r.impact,
        nodes:r.nodes.map(n=>({target:n.target, summary:n.failureSummary}))}));
    }""")
    undersized = page.locator("button:visible, a[href]:visible").evaluate_all("""els=>els.filter(e=>{
      const r=e.getBoundingClientRect();return r.width<43.9||r.height<43.9;
    }).map(e=>({name:e.getAttribute('aria-label')||e.textContent.trim(),w:e.clientWidth,h:e.clientHeight}))""")
    pictures = page.locator("img").evaluate_all("els=>els.filter(e=>e.complete && !e.naturalWidth).map(e=>e.getAttribute('src'))")
    sizes = {}
    for width in (320, 375, 390, 393, 402, 430):
        page.set_viewport_size({"width":width,"height":844})
        sizes[width] = page.evaluate("document.documentElement.scrollWidth - innerWidth")
    page.set_viewport_size({"width":390,"height":844})
    page.screenshot(path=str(output / (name+".png")), animations="disabled")
    page.evaluate("document.documentElement.style.fontSize='200%'")
    enlarged = page.evaluate("document.documentElement.scrollWidth - innerWidth")
    page.evaluate("document.documentElement.style.removeProperty('font-size')")
    page.keyboard.press("Tab")
    focus = page.evaluate("document.activeElement.tagName")
    page.remove_listener("response", network)
    page.remove_listener("pageerror", error)
    return dict(violations=results, overflow=sizes, keyboard_focus=focus, errors=errors, failed_responses=failed, enlarged_overflow=enlarged, undersized=undersized, broken_images=pictures)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--library-only", action="store_true")
    args=parser.parse_args()
    args.output = args.output.resolve()
    if args.output.is_relative_to(root.resolve()) or args.output.exists():
        parser.error("Use a new output directory outside web/ to preserve reference images")
    args.output.mkdir(parents=True)
    pages={"library":"/assets/refined-ui/library.html"}
    if not args.library_only:
        for screen in ("today","train","programs"):
            for state in ("normal","loading","error","empty"):
                pages[screen+"-"+state]=f"/assets/design-sprint/index.html?screen={screen}&state={state}"
    records={}
    with local_server() as root_url, sync_playwright() as pw:
        for engine in ("chromium","webkit"):
            browser=getattr(pw,engine).launch()
            for name,path in pages.items():
                context=browser.new_context(viewport={"width":390,"height":844},locale="ru-RU",reduced_motion="reduce")
                page=context.new_page()
                records[engine+"-"+name]=run(page,root_url+path,engine+"-"+name,args.output)
                context.close()
            browser.close()
    (args.output/"results.json").write_text(json.dumps(records,indent=2,ensure_ascii=False),encoding="utf8")
    for name,data in records.items():
        print(name, "axe", [r["id"] for r in data["violations"]], "overflow",max(data["overflow"].values()),"errors",len(data["errors"])+len(data["failed_responses"]))
    return int(any(r["violations"] or any(r["overflow"].values()) or r["errors"] or r["failed_responses"] or r["broken_images"] or r["undersized"] or r["enlarged_overflow"] for r in records.values()))

if __name__=="__main__":
    raise SystemExit(main())
