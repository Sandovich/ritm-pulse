"""Run against a synthetic pilot DB only. Pass the base URL and screenshot directory."""
import sys
import tempfile
from contextlib import ExitStack
from origin_outage import Origin
from pathlib import Path
from uuid import uuid4
from playwright.sync_api import sync_playwright, expect
from choice_pilot import setup,click,capture,button

base=sys.argv[1].rstrip('/')+'/'
shots=Path(sys.argv[2])
with ExitStack() as resources, sync_playwright() as p:
    outage=Origin(Path(resources.enter_context(tempfile.TemporaryDirectory()))/'journal.sqlite')
    base=outage.start()
    resources.callback(outage.stop)
    browser=getattr(p,sys.argv[3] if len(sys.argv)>3 else 'chromium').launch()
    a=browser.new_context(viewport={'width':390,'height':844},locale='ru-RU',is_mobile=True,has_touch=True)
    page=a.new_page()
    page.on("pageerror",lambda msg:print(msg))
    setup(page,base)
    click(page,'go:train')
    click(page,'go:journalTrain')
    page.locator('#jr-plan').fill('Упражнение из плана А\nУпражнение из плана Б')
    click(page,'jr-start')
    expect(button(page,'jr-set')).to_be_visible()
    expect(page.locator('#jr-name')).to_have_value('Упражнение из плана А')
    page.locator('#jr-kg').fill('12.5')
    page.locator('#jr-reps').fill('7')
    click(page,'jr-adjust:jr-reps:1')
    expect(page.locator('#jr-reps')).to_have_value('8')
    click(page,'jr-set')
    page.wait_for_timeout(300)
    expect(page.locator('.journal-row')).to_have_count(1)
    page.locator('#jr-kg').fill('0')
    click(page,'jr-repeat:1')
    expect(page.locator('#jr-kg')).to_have_value('12.5')
    page.evaluate('navigator.serviceWorker.ready')
    page.wait_for_function('!!navigator.serviceWorker.controller')
    outage.stop()
    click(page,'jr-set')
    expect(button(page,'jr-sync')).to_be_visible()
    page.close()
    page=a.new_page()
    page.goto(base)
    expect(button(page,'jr-sync')).to_be_visible()
    expect(page.locator('#head')).to_contain_text('без сети')
    outage.start()
    page.wait_for_function("!document.querySelector('#head')?.textContent.includes('без сети')")
    page.reload()
    click(page,'go:train')
    click(page,'go:journalTrain')
    expect(page.locator('.journal-row')).to_have_count(2)
    click(page,'jr-next:done')
    expect(page.locator('#jr-name')).to_have_value('Упражнение из плана Б')
    page.evaluate('window.scrollTo(0,0)')
    capture(page,shots,'smart-train')
    click(page,'jr-next:skipped')
    click(page,'jr-finish')
    click(page,'jr-end:partial')
    expect(button(page,'jr-start')).to_be_visible()
    click(page,'go:food')
    click(page,'go:journalFood')
    click(page,'jr-edit:new')
    expect(page.get_by_role('dialog')).to_be_visible()
    for k,v in dict(name='Продукт с тестовой этикетки',grams='150',kcal='90',protein='4',fat='2',carbs='14').items():
        page.locator('#jr-'+k).fill(v)
    click(page,'jr-food-save')
    expect(page.locator('.journal-count strong')).to_have_text('135')
    food=a.request.get(base+'api/me').json()['food_log'][0]
    click(page,'jr-edit:'+food['id'])
    page.locator('#jr-grams').fill('200')
    click(page,'jr-food-save')
    expect(page.locator('.journal-count strong')).to_have_text('180')
    page.evaluate('window.scrollTo(0,0)')
    capture(page,shots,'smart-food')
    click(page,'go:today')
    click(page,'go:journalStats')
    expect(page.locator('.journal-count strong')).to_have_text('2')
    click(page,'jr-period:30')
    click(page,'jr-metric:volume')
    expect(page.locator('.journal-panel')).to_contain_text('Объём 200 кг')
    click(page,'jr-metric:weight')
    expect(page.locator('.journal-panel')).to_contain_text('12,5 кг')
    page.evaluate('window.scrollTo(0,0)')
    capture(page,shots,'analytics')
    click(page,'go:store')
    expect(page.locator('#content')).to_contain_text('DUO 28')
    b=browser.new_context()
    original=a.request.get(base+'api/me').json()['profile']['id']
    other=b.request.get(base+'api/me').json()
    assert other['profile']['id']!=original and not other['food_log'] and not other['workouts']
    def post(ctx,path,**fields):
        return ctx.request.post(base+path,data={'nonce':uuid4().hex,**fields})
    assert not post(b,'api/action',verb='journal_delete',id=food['id']).ok
    code=post(a,'api/recovery/create').json()['code']
    assert post(b,'api/recovery/restore',code=code).ok
    restored=b.request.get(base+'api/me').json()
    assert restored['profile']['id']==original and restored['food_log'][0]['grams']==200
    assert len(restored['workouts'][0]['sets'])==2
    assert not post(a,'api/recovery/restore',code=code).ok
    assert a.request.get(base+'api/me').json()['profile']['id']!=original
    assert post(b,'api/action',verb='journal_delete',id=food['id']).ok
    print('PASS training resume + pending offline set, partial finish, editable nutrition, period statistics, account isolation, single-use recovery and revocation.')
