"""Home Screen layout in WebKit, standalone emulation in Chromium, account-local progress."""
import argparse
import tempfile
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
from home_review import preview

def run(site):
    with sync_playwright() as pw:
        chrome=Path('C:/Program Files/Google/Chrome/Application/chrome.exe')
        for engine in ('chromium','webkit'):
            profile=tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
            options=dict(locale='ru-RU',viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
            if engine=='chromium':
                ctx=pw.chromium.launch_persistent_context(profile.name,executable_path=str(chrome) if chrome.exists() else None,
                    args=['--app='+site.rstrip('/')+'/?screen=today'])
                p=ctx.pages[0]
            else:
                browser=pw.webkit.launch();ctx=browser.new_context(**options);p=ctx.new_page()
            if engine=='chromium':
                p.add_init_script('''window.heartbeatCalls = [];
                    Object.defineProperty(navigator, 'vibrate', {configurable:true,
                        value:pattern=>{window.heartbeatCalls.push(pattern);return true;}});''')
            p.goto(site.rstrip('/')+'/?screen=today')
            p.locator('.home-week').wait_for(timeout=90000)
            action=lambda k:p.locator('[data-a="'+k+'"]').first
            manifest_url=p.locator('link[rel=manifest]').get_attribute('href')
            manifest=ctx.request.get(urljoin(p.url,manifest_url)).json()
            assert manifest['display']=='standalone' and 'screen=today' in manifest['start_url']
            assert ctx.request.get(urljoin(p.url,manifest['icons'][1]['src'])).ok
            if engine=='chromium':
                dev=ctx.new_cdp_session(p)
                dev.send('Emulation.setSafeAreaInsetsOverride',{'insets':{'top':47,'bottom':34,'left':0,'right':0}})
                assert p.evaluate("matchMedia('(display-mode: standalone)').matches")
                assert p.locator('#nav').evaluate("n=>parseFloat(getComputedStyle(n).paddingBottom)>=34")
            for h in (844,690,790):
                p.set_viewport_size({'width':390,'height':h})
                p.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)')
                assert p.evaluate("document.querySelector('.home-plan-row:last-child').getBoundingClientRect().bottom<=document.querySelector('#nav').getBoundingClientRect().top+.5")
            assert p.locator('.week-values strong').inner_text()=='82%'
            action('quicktime').click();action('time:10').click()
            p.goto(urljoin(p.url,manifest['start_url']));p.locator('.home-week').wait_for(timeout=90000)
            assert '10 мин' in action('quicktime').inner_text()
            nav_pulse=p.locator('#nav .pulse-nav')
            if engine=='chromium':
                assert p.evaluate('heartbeatCalls')==[]
                nav_pulse.click()
                assert p.evaluate('heartbeatCalls')==[[35,85,55]]
                assert nav_pulse.locator('svg').evaluate("n=>getComputedStyle(n).animationName")=='ritm-heartbeat'
                action('go:profile').click();action('go:settings').click()
                p.locator('#pulse-haptics').uncheck()
                p.reload();p.locator('.home-week').wait_for(timeout=90000)
                nav_pulse.click()
                assert p.evaluate('heartbeatCalls')==[]
                action('go:profile').click();action('go:settings').click()
                assert not p.locator('#pulse-haptics').is_checked()
                p.locator('#pulse-haptics').check()
                action('go:today').click()
            else:
                nav_pulse.click()
                assert p.locator('body').get_attribute('data-screen')=='pulse'
            action('respond').click();action('kind:food').click();action('complete').click()
            p.get_by_text('10 из 11 действий',exact=True).wait_for()
            for name in ('today','profile','recap'):
                if name!='today':action('go:'+name).click()
                assert p.locator('.screen').get_by_text('10 из 11 действий',exact=True).is_visible()
            assert p.locator('.big').inner_text()=='91%'
            if engine=='chromium':
                assert p.evaluate('heartbeatCalls')==[[35,85,55]]
                p.emulate_media(reduced_motion='reduce')
                nav_pulse.click()
                assert nav_pulse.locator('svg').evaluate("n=>getComputedStyle(n).animationName")=='none'

            print(engine,'passed standalone launch URL, real 82% to 91%, time persistence, dynamic viewport and navigation')
            ctx.close()
            if engine=='webkit':browser.close()
            profile.cleanup()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--url');args=parser.parse_args()
    with preview(args.url) as site:run(site)
