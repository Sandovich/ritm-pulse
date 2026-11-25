"""Exercise the first-stage Today screen and capture all three requested CSS viewports."""
import argparse
import ast
from contextlib import contextmanager
from pathlib import Path
import subprocess
import sys
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SIZES = ((375, 812), (390, 844), (430, 932))


@contextmanager
def preview(url):
    if url:
        yield url
        return
    with tempfile.TemporaryDirectory() as temp:
        proc = subprocess.Popen(
            [sys.executable, '-u', str(ROOT / 'web/server.py'), '--port', '0',
             '--db', str(Path(temp) / 'pilot.sqlite')],
            stdout=subprocess.PIPE, text=True,
        )
        try:
            host, port = ast.literal_eval(proc.stdout.readline().split('listening on ')[1])
            yield f'http://{host}:{port}/demo/'
        finally:
            proc.terminate()
            proc.wait(timeout=8)


def run(url, shots):
    shots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        chrome = Path('C:/Program Files/Google/Chrome/Application/chrome.exe')
        browser = pw.chromium.launch(executable_path=str(chrome) if chrome.exists() else None)
        ctx = browser.new_context(locale='ru-RU', device_scale_factor=1, is_mobile=True, has_touch=True)
        p = ctx.new_page()
        errors = []
        p.on('pageerror', lambda error: errors.append(str(error)))
        p.goto(url.rstrip('/') + '/?screen=today')
        p.get_by_role('heading', name='В своём ритме.').wait_for(timeout=90000)
        button = lambda name: p.locator('[data-a="'+name+'"]').first
        p.get_by_text('9 из 11 действий', exact=True).wait_for()
        assert p.locator('.home-pulse h2').inner_text()=='Лена закончила тренировку.'
        assert p.locator('.week-values strong').inner_text()=='82%'
        for w,h in SIZES:
            p.set_viewport_size({'width':w,'height':h})
            p.evaluate("document.fonts.ready")
            p.evaluate("Promise.all([...document.images].map(i=>i.decode()))")
            p.wait_for_timeout(250)
            geometry = p.evaluate('''() => {
              const box=s=>document.querySelector(s).getBoundingClientRect();
              return {width:document.documentElement.scrollWidth, bottom:box('.home-plan-row:last-child').bottom,
                nav:box('#nav').top, pulse:box('.home-pulse').height, image:box('.row-photo').width,
                ring:box('.face-ring').width, small:[...document.querySelectorAll('button')].filter(b=>{
                 const r=b.getBoundingClientRect();return r.width>0 && (r.width<43.9||r.height<43.9);
                }).map(b=>b.dataset.a)};
            }''')
            assert geometry['width']==w and 115<=geometry['pulse']<=135, geometry
            assert geometry['bottom']<=geometry['nav'] and not geometry['small'], geometry
            assert 72<=geometry['image']<=76 and 48<=geometry['ring']<=52
            p.screenshot(path=str(shots / f'today-{w}x{h}.png'),animations='disabled')
            print(w,h,geometry)
        for action,title in [('go:food','Твоё питание'),('go:train','Твои тренировки'),('go:pulse','PULSE'),('go:arena','Арена'),('go:profile','Саша')]:
            button(action).click()
            p.get_by_role('heading',name=title,exact=True).first.wait_for()
            assert not p.locator('body').evaluate('el=>el.classList.contains("home-active")')
            button('go:today').click()
        button('homeplan').click()
        button('time:10').click()
        p.get_by_role('dialog').get_by_role('button',name='10 мин').wait_for()
        p.keyboard.press('Escape')
        assert '10 мин' in button('go:train').inner_text()
        button('homeperson:demo-friend').click()
        p.get_by_role('dialog').get_by_text('Последнее дело',exact=False).wait_for()
        button('memberreply:demo-friend').click()
        button('kind:food').click()
        button('complete').click()
        p.get_by_text('10 из 11 действий',exact=True).wait_for()
        assert p.locator('.week-values strong').inner_text()=='91%'
        p.reload()
        p.get_by_text('10 из 11 действий',exact=True).wait_for(timeout=90000)
        button('homeinvite').click()
        p.locator('#inviteurl').wait_for()
        assert 'invite=' in p.locator('#inviteurl').input_value()
        p.emulate_media(reduced_motion='reduce')
        button('go:today').click()
        assert p.locator('.screen').evaluate("el=>getComputedStyle(el).animationName")=='none'
        assert not errors, errors
        print('PASS navigation, home sheet, privacy-backed PULSE, real progress, persistence, invitation, reduced motion')
        browser.close()


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--url')
    parser.add_argument('--screens',type=Path,default=ROOT/'docs/review')
    opts=parser.parse_args()
    with preview(opts.url) as site:
        run(site,opts.screens)
