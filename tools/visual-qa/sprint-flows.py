"""Exercise the standalone RITM design sprint using synthetic, isolated browser data.

Run with the project's Playwright Python environment:
    python tools/visual-qa/sprint-flows.py
    python tools/visual-qa/sprint-flows.py --output D:/reviews/my-new-run
The output directory must be new. This command never replaces reference PNGs.
"""
import argparse
import tempfile
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright


WEB = Path(__file__).resolve().parents[2] / "web"
SCREENS = ("today", "train", "programs")
WIDTHS = (320, 375, 390, 393, 402, 430)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def verify(page, base, engine, output):
    def visit(screen, state="normal"):
        page.goto(f"{base}?screen={screen}&state={state}")
        page.evaluate("document.fonts.ready")
        page.wait_for_load_state("networkidle")

    def click(action):
        page.locator(f'[data-action="{action}"]').first.click()

    def capture(name):
        if engine == "webkit":
            page.screenshot(path=output / f"{name}.png", animations="disabled")

    def check_bounds():
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), page.url

    for screen in SCREENS:
        visit(screen)
        for width in WIDTHS:
            page.set_viewport_size({"width": width, "height": 844})
            check_bounds()
            assert page.evaluate("Array.from(document.images).every(i => i.complete && i.naturalWidth > 0)")
            assert page.evaluate("document.fonts.check('700 20px Ritm', 'Движение')")
            if width == 390:
                capture(screen)
        page.set_viewport_size({"width": 390, "height": 844})
        for state in ("empty", "loading", "error"):
            visit(screen, state)
            capture(f"{screen}-{state}")
            page.locator("#view button").last.click()
            assert "state=" not in page.url, (state, page.url)

    visit("train")
    page.locator('[data-action="set:new"]').last.click()
    capture("train-sheet")
    page.locator("#kg").fill("14")
    page.locator("#reps").fill("8")
    page.locator("#set-form [type=submit]").click()
    page.reload()
    expect(page.locator(".sets")).to_contain_text("14 кг")
    click("set:1")
    page.locator("#kg").fill("15")
    page.locator("#set-form [type=submit]").click()
    page.reload()
    expect(page.locator(".sets")).to_contain_text("15 кг")
    click("rest")
    expect(page.locator("#rest")).not_to_have_text("01:30")
    click("rest")
    expect(page.locator("[data-action=rest]")).to_contain_text("Старт")
    click("tab:tech")
    expect(page.locator("#view")).to_contain_text("Проверенное видео")

    click("go:programs")
    click("filter:Для двоих")
    expect(page.locator('[data-action="offer:RESET"]')).to_have_count(0)
    capture("programs-duo")
    click("offer:DUO")
    expect(page.locator("#sheet-body")).to_contain_text("5 490 ₽")
    page.keyboard.press("Escape")
    expect(page.locator("dialog[open]")).to_have_count(0)
    click("go:today")
    click("time")
    capture("today-time")
    click("minutes:5")
    expect(page.locator(".dayplan")).to_contain_text("Движение дома")
    for screen in SCREENS:
        visit(screen)
        page.evaluate("document.documentElement.style.fontSize = '200%'")
        check_bounds()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="A new directory for the screenshot run")
    options = parser.parse_args()
    output = options.output.resolve() if options.output else Path(tempfile.mkdtemp(prefix="ritm-sprint-"))
    if options.output:
        if (WEB / "assets/design-sprint").resolve() in [output, *output.parents]:
            parser.error("Choose a directory outside the reference package.")
        output.mkdir(parents=True, exist_ok=False)
    handler = partial(QuietHandler, directory=str(WEB))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_port}/assets/design-sprint/"
        try:
            with sync_playwright() as playwright:
                for engine in ("webkit", "chromium"):
                    browser = getattr(playwright, engine).launch()
                    context = browser.new_context(locale="ru-RU", viewport={"width": 390, "height": 844},
                                                  has_touch=True, is_mobile=True, reduced_motion="reduce")
                    errors = []
                    page = context.new_page()
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.on("response", lambda response: errors.append(response.url) if response.status >= 400 else None)
                    try:
                        verify(page, base, engine, output)
                        assert not errors, errors
                        print(f"PASS {engine}: navigation, states, focus, train, restore, portions of catalog, responsive layout")
                    finally:
                        context.close()
                        browser.close()
        finally:
            server.shutdown()
    print(output)


if __name__ == "__main__":
    main()
