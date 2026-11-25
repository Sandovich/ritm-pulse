"""Capture the real application through its ordinary UI. All examples are local demo data."""
import argparse
import json
import re
from html import escape
from pathlib import Path
from playwright.sync_api import sync_playwright
from home_review import ROOT, SIZES, preview

GROUPS = ['Первый вход','Сегодня','Питание','Тренировки','PULSE','Арена','Профиль','Эксперты','Сезоны']
def render_gallery(items, dest):
    sections=[]
    for group in GROUPS:
        entries=[]
        for item in items:
            if item['group']!=group:
                continue
            name=escape(item['name']); ref=item['key']
            links=' · '.join(f'<a href="{ref}-{w}.png">{w} px</a>' for w in item['widths'])
            entries.append(f'<article><a class="image" href="{ref}-390.png"><img loading="lazy" src="{ref}-390.png" alt="{name}"></a><h3>{name}</h3><p>{links}</p></article>')
        sections.append(f'<section><h2>{group}</h2><div class="grid">{"".join(entries)}</div></section>')
    html='''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ritm. — Экраны приложения</title><link rel="stylesheet" href="../assets/fonts.css"><style>*{box-sizing:border-box}body{margin:0 auto;background:#0d0e0d;color:#f5f6f2;max-width:1100px;padding:24px 18px 70px;font:500 15px/1.45 "Manrope Variable",sans-serif}header{display:flex;align-items:center;justify-content:space-between}header b{font-size:30px;letter-spacing:-.08em;color:#d5fc53}a{color:#d5fc53;text-underline-offset:.2em}h1{letter-spacing:-.05em;font-size:clamp(31px,6vw,54px);line-height:1.1}h2{border-top:1px solid #353831;padding-top:20px;margin:30px 0 12px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(158px,44%),1fr));gap:15px}.image{display:block;max-width:240px;border-radius:14px;overflow:hidden;border:1px solid #343930}img{display:block;width:100%;height:auto}h3{font-size:15px;margin:8px 0 1px}p{margin:4px 0;color:#b1b6ac;font-size:13px}article>p a{display:inline-block;padding:5px 0}</style><header><b>ritm.</b><a href="../?screen=today">Открыть приложение ↗</a></header><h1>Экраны RITM</h1><p>Снимки работающего демо. Нажми на изображение, чтобы открыть его в полном размере.</p>'''
    (dest/'index.html').write_text(html+''.join(sections)+'</html>','utf8')

def run(site,dest):
    dest.mkdir(parents=True,exist_ok=True)
    entries=[]
    with sync_playwright() as pw:
        chrome=Path('C:/Program Files/Google/Chrome/Application/chrome.exe')
        browser=pw.chromium.launch(executable_path=str(chrome) if chrome.exists() else None)
        opts=dict(viewport={'width':390,'height':844},locale='ru-RU',is_mobile=True,has_touch=True,device_scale_factor=1)
        p=browser.new_context(**opts).new_page()
        p.set_default_timeout(18000)
        errors=[]
        p.on('pageerror',lambda err:errors.append(str(err)))
        def click(action):
            p.locator('[data-a="'+action+'"]').first.click()
        def snap(key,title,group,major=False):
            widths=[]
            for w,h in (SIZES if major else [(390,844)]):
                p.set_viewport_size({'width':w,'height':h})
                p.evaluate("document.fonts.ready")
                p.evaluate("Promise.all([...document.images].map(i=>i.decode()))")
                p.evaluate("window.scrollTo({top:0,behavior:'instant'})")
                p.wait_for_timeout(80)
                assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),key
                p.screenshot(path=str(dest/f'{key}-{w}.png'),animations='disabled',style='#toast{visibility:hidden} #inviteurl{color:transparent}')
                widths.append(w)
            p.set_viewport_size(opts['viewport'])
            entries.append(dict(key=key,name=title,group=group,widths=widths))
        p.goto(site);p.locator('[data-a="demo-start"]').wait_for(timeout=90000)
        snap('welcome','Первое открытие','Первый вход',True)
        click('invitation');snap('invite-code','Вход по приглашению','Первый вход')
        p.goto(site);p.locator('[data-a="start"]').wait_for(timeout=90000)
        click('start');snap('name','Имя профиля','Первый вход')
        p.locator('#startname').fill('Саша');click('named')
        for i in range(13):
            title=p.locator('h1').inner_text()
            snap('dna-'+str(i+1),title,'Первый вход')
            if i==8:click('dnaskip')
            else:p.locator('[data-a^="dnaopt:"]').first.click();click('dnanext')
        snap('dna-map','Карта RITM DNA','Первый вход')
        p.goto(site.rstrip('/')+'/?screen=today');p.locator('.home-week').wait_for(timeout=90000)
        snap('today','В своём ритме','Сегодня',True)
        click('quicktime');snap('time','Доступное время','Сегодня');click('time:20')
        click('homeplan');snap('plan','Мой план','Сегодня');click('go:ai');snap('ai','Подстроить план','Сегодня')
        click('go:today');click('go:notifications');snap('notifications','Уведомления','Сегодня')
        click('go:food');snap('food','Твоё питание','Питание',True)
        click('pantry');snap('pantry','Из того, что дома','Питание');click('pantry')
        click('meal:pasta');snap('recipe','Рецепт и порции','Питание');click('cartadd:pasta')
        click('go:food');click('foodview:week');snap('week','Меню на неделю','Питание')
        click('foodview:cart');snap('cart','Продуктовая корзина','Питание')
        click('go:today');click('go:train');snap('train','Твои тренировки','Тренировки',True)
        click('work:strength');snap('work','Силовой блок','Тренировки')
        click('tech:strength');snap('tech','Техника и варианты','Тренировки')
        click('go:pulse');snap('pulse','Твой круг и лента','PULSE',True)
        click('respond');snap('reply','Ответить своим делом','PULSE')
        click('go:pulse');p.locator('[data-a^="circle:"]').first.click();snap('circle','Управление кругом','PULSE')
        p.locator('[data-a^="leave:"]').first.click();snap('leave','Выход из круга','PULSE');click('back')
        click('go:pulse');click('together');snap('together','Совместное время','PULSE')
        click('go:arena');snap('arena','Арена и счёт','Арена',True)
        p.locator('[data-a^="game:"]').first.click();snap('game','История дуэли','Арена')
        click('go:arena');click('setup:duel');snap('setup','Новая дуэль','Арена');click('create-mode')
        snap('share','Приглашение другу','Арена');click('asguest');p.locator('[data-a="join"]').wait_for(timeout=90000);snap('guest','Гостевой вход','Первый вход')
        p.goto(site.rstrip('/')+'/?screen=today');p.locator('.home-week').wait_for(timeout=90000)
        click('go:profile');snap('profile','Личный профиль','Профиль',True)
        click('go:checkin');snap('checkin','Личные замеры','Профиль');click('go:seasonplan');snap('seasonplan','Настройка сезона','Профиль')
        click('go:profile');click('go:recap');snap('recap','Недельный отчёт','Профиль')
        click('go:profile');click('go:settings');snap('settings','Настройки и доступ','Профиль');click('go:privacy');snap('privacy','Приватность действий','Профиль')
        click('go:profile');click('go:experts');snap('experts','Экспертные направления','Эксперты',True)
        for role in ('food','train'):
            click('expert:'+role);snap('expert-'+role,'Нутрициолог' if role=='food' else 'Тренер','Эксперты')
            click('go:profile');click('go:experts')
        click('go:profile');click('go:store');snap('store','Витрина сезонов','Сезоны',True)
        for sku in ('FOOD','RESET','DUO'):
            click('product:'+sku);snap(sku.lower()+'-28',sku+' 28','Сезоны')
            click('go:profile');click('go:store')
        click('product:RESET');click('book:RESET');p.get_by_text('Твоя заявка',exact=False).wait_for();snap('order','Заявка на сезон','Сезоны')
        assert not errors,errors
        browser.close()
    render_gallery(entries,dest)
    print(f'{len(entries)} экранов и состояний, {sum(len(x["widths"]) for x in entries)} проверенных снимков.')

if __name__=='__main__':
    args=argparse.ArgumentParser()
    args.add_argument('--url');args.add_argument('--screens',type=Path,default=ROOT/'docs/lookbook')
    opt=args.parse_args()
    with preview(opt.url) as site:run(site,opt.screens)

