"""Run against a synthetic pilot DB only. Pass the base URL and screenshot directory."""
import sys
from pathlib import Path
from uuid import uuid4
from playwright.sync_api import sync_playwright, expect
from choice_pilot import setup,click,capture,button

base=sys.argv[1].rstrip('/')+'/'
shots=Path(sys.argv[2])
with sync_playwright() as p:
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
    page.locator('#jr-reps').fill('8')
    click(page,'jr-set')
    page.wait_for_timeout(300)
    expect(page.locator('.journal-row')).to_have_count(1)
    page.evaluate('navigator.serviceWorker.ready')
    page.wait_for_function('!!navigator.serviceWorker.controller')
    a.set_offline(True)
    click(page,'jr-set')
    expect(button(page,'jr-sync')).to_be_visible()
    if '--connected-reopen' not in sys.argv:
        page.reload()
        expect(button(page,'jr-sync')).to_be_visible()
    a.set_offline(False)
    if "--connected-reopen" in sys.argv:
        expect(page.locator(".journal-row")).to_have_count(2)
    else:
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
    for k,v in dict(name='Продукт с тестовой этикетки',grams='150',kcal='90',protein='4',fat='2',carbs='14').items():
        page.locator('#jr-'+k).fill(v)
    click(page,'jr-food-save')
    expect(page.locator('.journal-count strong')).to_have_text('135')
    food=a.request.get(base+'api/me').json()['food_log'][0]
    click(page,'jr-edit:'+food['id'])
    page.locator('#jr-grams').fill('200')
    click(page,'jr-food-save')
    expect(page.locator('.journal-count strong')).to_have_text('180')
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
