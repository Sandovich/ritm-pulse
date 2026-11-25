"""Exercise the deployed demo or a temporary local server, never real payments."""
import argparse,ast,subprocess,sys,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--url');ap.add_argument('--screens',type=Path,default=root/'screenshots');args=ap.parse_args();args.screens.mkdir(parents=True,exist_ok=True)
def snap(p,name):
    p.evaluate("document.fonts.ready")
    p.evaluate("Promise.all([...document.images].map(im=>im.decode().catch(()=>{})))")
    p.evaluate("window.scrollTo({top:0,behavior:'instant'})")
    p.screenshot(path=str(args.screens/(name+'.png')),animations='disabled',style='#toast{visibility:hidden}')
def click(p,action):p.locator('[data-a="'+action+'"]').first.click(timeout=16000)
with tempfile.TemporaryDirectory() as tmp:
 srv=None
 if not args.url:
    srv=subprocess.Popen([sys.executable,'-u',str(root/'web/server.py'),'--port','0','--db',str(Path(tmp)/'pilot.sqlite')],stdout=subprocess.PIPE,text=True)
    h,port=ast.literal_eval(srv.stdout.readline().split('listening on ')[1]);base=f'http://{h}:{port}';url=base+'/demo/'
 else:url=args.url
 try:
    with sync_playwright() as pw:
        chrome=Path('C:/Program Files/Google/Chrome/Application/chrome.exe')
        browser=pw.chromium.launch(executable_path=str(chrome) if chrome.exists() else None)
        ctx=browser.new_context(viewport={'width':390,'height':844},locale='ru-RU',accept_downloads=True)
        p=ctx.new_page();p.set_default_timeout(14000);issues=[]
        p.on('pageerror',lambda e:issues.append(str(e)));p.on('console',lambda m:print(m.type,m.text[:200]) if m.type=='error' else None)
        p.goto(url);p.locator('[data-a="demo-start"]').wait_for(timeout=70000);snap(p,'01-onboarding')
        click(p,'demo-start');p.locator('[data-a="respond"]').wait_for();snap(p,'02-today')
        assert p.locator('nav button').count()==5
        for width in (375,390,430,1024):
            p.set_viewport_size({'width':width,'height':850})
            assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        p.set_viewport_size({'width':390,'height':844})
        click(p,'go:pulse');snap(p,'03-pulse');click(p,'respond');click(p,'kind:food');click(p,'complete')
        p.get_by_text('Действие сохранено.',exact=True).wait_for();click(p,'go:food');snap(p,'04-food')
        click(p,'meal:pasta');click(p,'fav:pasta');click(p,'portions:1');click(p,'cartadd:pasta');click(p,'go:food');click(p,'foodview:cart');p.get_by_text('150 г',exact=True).wait_for()
        click(p,'go:today');click(p,'go:train');click(p,'work:strength');click(p,'timer');p.wait_for_timeout(1050);click(p,'timer');snap(p,'05-train');click(p,'workdone:strength');click(p,'complete');p.get_by_text('Действие сохранено.',exact=True).wait_for();click(p,'go:train');p.get_by_text('Силовой блок · 20 мин · 1 × 8',exact=True).wait_for()
        click(p,'go:arena');snap(p,'06-arena');click(p,'setup:duel');click(p,'create-mode');p.locator('#inviteurl').wait_for();click(p,'asguest');p.locator('[data-a="join"]').wait_for(timeout=60000);click(p,'join');click(p,'go:pulse');p.get_by_text('Ответ тебе',exact=True).first.wait_for()
        click(p,'go:profile');snap(p,'07-profile');click(p,'go:experts');click(p,'expert:food');click(p,'interest:food:consult')
        click(p,'product:FOOD');click(p,'book:FOOD');p.get_by_text('Твоя заявка',exact=False).wait_for();snap(p,'08-season')
        click(p,'go:profile');click(p,'go:dna-map');click(p,'editdna')
        for i in range(13):
            if i==8:click(p,'dnaskip');continue
            p.locator('[data-a^="dnaopt:"]').first.click();click(p,'dnanext')
        p.get_by_role('heading',name='Твоя карта изменений').wait_for()
        click(p,'go:profile');click(p,'go:recap')
        with p.expect_download() as download:click(p,'download-recap')
        assert download.value.suggested_filename=='RITM-RECAP.png'
        p.reload();p.locator('nav button').first.wait_for(timeout=60000)
        click(p,'demomenu');click(p,'resetask');click(p,'confirmed');p.locator('[data-a="demo-start"]').wait_for(timeout=60000)
        if not args.url:
            live=browser.new_context().new_page();live.goto(base);click(live,'start');live.locator('#startname').fill('QA');click(live,'named');live.get_by_text('Какова твоя цель?').wait_for();assert live.request.get(base+'/api/me').json()['profile']['name']=='QA'
        assert not issues,issues
        print('OK: navigation and widths; Pulse, duel, guest, shopping basket, timer, DNA, consultation, demo booking, recap, persistence and reset')
        browser.close()
 finally:
    if srv:srv.terminate();srv.wait(timeout=10)

