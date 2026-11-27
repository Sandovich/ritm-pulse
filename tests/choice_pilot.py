"""Drive a real CHOICE exchange from two independent sessions and check the public sandbox."""
import argparse
from pathlib import Path
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright
from home_review import ROOT, SIZES, preview


def button(page, action):
    return page.locator(f'[data-a="{action}"]').first


def click(page, action):
    button(page, action).click()


def compose(page, first, second):
    expect(button(page, 'choice-create')).to_be_disabled()
    click(page, 'choice-option:' + first)
    expect(button(page, 'choice-create')).to_be_disabled()
    click(page, 'choice-option:' + second)
    click(page, 'choice-create')


def setup(page, base):
    page.request.get(base + 'api/me')
    reply = page.request.post(base + 'api/action', data=dict(
        nonce=uuid4().hex, verb='profile', name='Лена', goal='Регулярное движение',
        program='Своя программа', barrier='Мало времени'))
    assert reply.ok, reply.text()
    page.goto(base)
    click(page, 'go:pulse')


def capture(page, shots, key):
    for w, h in SIZES:
        page.set_viewport_size({'width': w, 'height': h})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), key
        if w == 390:
            page.evaluate('document.fonts.ready')
            page.screenshot(path=str(shots / f'{key}.png'), animations='disabled', style='#toast{visibility:hidden}')
    page.set_viewport_size({'width':390,'height':844})


def real(browser, base, shots, opts):
    owner = browser.new_context(**opts)
    guest = browser.new_context(**opts)
    a, b = owner.new_page(), guest.new_page()
    setup(a, base)
    click(a, 'choice-new')
    compose(a, 'walk', 'move')
    link = a.locator('#choice-url').input_value()
    assert link.startswith(base) and 'choice=' in link
    owner.grant_permissions(['clipboard-read','clipboard-write'], origin=base.rstrip('/'))
    click(a, 'choice-copy')
    b.goto(link)
    expect(button(b, 'choice-vote')).to_be_disabled()
    click(b, 'choice-pick:walk')
    capture(b, shots, 'choice-guest')
    click(b, 'choice-vote')
    expect(button(a, 'choice-complete')).to_be_visible(timeout=18000)
    click(a, 'choice-complete')
    expect(button(b, 'choice-swap')).to_be_visible(timeout=18000)
    capture(b, shots, 'choice-result')
    click(b, 'choice-swap')
    compose(b, 'food', 'walk')
    returned = b.locator('#choice-url').input_value()
    a.goto(returned)
    click(a, 'choice-pick:food')
    click(a, 'choice-vote')
    expect(button(b, 'choice-complete')).to_be_visible(timeout=18000)
    click(b, 'choice-complete')
    expect(button(a, 'choice-swap')).to_be_visible(timeout=18000)
    snapshot = owner.request.get(base+'api/me').json()
    assert len(snapshot['choices']) == 2 and all(c['completed'] for c in snapshot['choices'])
    a.goto(base)
    click(a,'go:pulse')
    click(a,'go:arena')
    click(a,'setup:duel')
    reward='Победитель выбирает фильм'
    a.locator('#duel-reward').fill(reward)
    click(a,'create-mode')
    duel = next(g for g in owner.request.get(base+'api/me').json()['games'] if g['mode']=='duel')
    assert duel['reward']==reward
    invited = guest.request.get(base+'api/invite',params={'token':duel['token']}).json()
    assert invited['reward']==reward
    print('PASS two independent browsers, anonymous ballot, completion notice, reverse ballot, personal duel reward')
    owner.close()
    guest.close()


def sandbox(browser, site, shots, opts):
    page=browser.new_context(**opts).new_page()
    page.goto(site.rstrip('/')+'/?screen=today&feature=choice',wait_until='domcontentloaded',timeout=120000)
    button(page,'choice-option:walk').wait_for(timeout=110000)
    compose(page,'walk','move')
    click(page,'choice-demo')
    button(page,'choice-pick:move').wait_for(timeout=100000)
    click(page,'choice-pick:move')
    click(page,'choice-vote')
    click(page,'choice-demo')
    button(page,'choice-complete').wait_for(timeout=100000)
    click(page,'choice-complete')
    click(page,'choice-demo')
    expect(button(page,'choice-swap')).to_be_visible(timeout=100000)
    print('PASS device-local demo exchange at',site)
    page.context.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--demo-url')
    parser.add_argument('--screens',type=Path,default=ROOT/'docs/review')
    opts=parser.parse_args()
    opts.screens.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as pw:
        chrome=Path('C:/Program Files/Google/Chrome/Application/chrome.exe')
        browser=pw.chromium.launch(executable_path=str(chrome) if chrome.exists() else None)
        settings=dict(viewport={'width':390,'height':844},locale='ru-RU',is_mobile=True,has_touch=True)
        if opts.demo_url:
            sandbox(browser,opts.demo_url,opts.screens,settings)
        else:
            with preview(None) as url:
                real(browser,url.removesuffix('demo/'),opts.screens,settings)
                sandbox(browser,url,opts.screens,settings)
        browser.close()
