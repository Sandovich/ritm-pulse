from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import sys
root=Path(sys.argv[1]).resolve()
out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 for engine in ('webkit','chromium'):
  b=getattr(p,engine).launch()
  for edition in ('r3','refined'):
   capture = engine=='chromium' and edition=='refined'
   context=b.new_context(record_video_dir=out if capture else None,record_video_size={'width':390,'height':844} if capture else None,viewport={'width':390,'height':844},locale='ru-RU',is_mobile=True,has_touch=True)
   page=context.new_page()
   errors=[]
   page.on('pageerror',lambda error: errors.append(str(error)))
   page.goto(f'http://127.0.0.1:{server.server_port}/athletic/{edition}/?screen=today')
   page.locator('.ref-plan').wait_for(timeout=90000)
   for route in ('today','store','journalTrain'):
    if route!='today':
     if route=='journalTrain':page.locator('#nav [data-a="go:train"]').click()
     page.locator('[data-a="go:'+route+'"]').first.click()
    if route=='journalTrain':
     page.locator('#jr-plan').fill('Жим гантелей');page.locator('[data-a="jr-start"]').click()
     page.locator('#jr-kg').wait_for()
    for width in (320,375,390,393,402,430):
     page.set_viewport_size({'width':width,'height':844});page.evaluate('window.scrollTo(0,0)')
     overflow=page.evaluate('document.documentElement.scrollWidth-innerWidth')
     assert overflow<=0,(engine,edition,route,width,overflow)
     if edition=='refined':
      assert page.locator('#nav button').evaluate_all("buttons=>buttons.every(b=>b.clientWidth>=44&&b.clientHeight>=44)")
      assert page.locator('#nav button').evaluate_all("buttons=>buttons.every(b=>{let i=b.querySelector('svg'),s=b.querySelector('span');return s.getBoundingClientRect().top-i.getBoundingClientRect().bottom>=7.9})")
      assert page.evaluate("document.fonts.check('700 16px RitmManrope','Тренировка')")
     if width==390 and engine=='webkit':
      page.screenshot(path=str(out/(edition+'-'+route+'.png')),animations='disabled')
    if edition=='refined':
     page.set_viewport_size({'width':390,'height':844})
     page.evaluate("document.documentElement.style.fontSize='200%'")
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('large text',route)
     page.evaluate("document.documentElement.style.removeProperty('font-size')")
    print(engine,edition,route,flush=True)
   if edition=='refined':
    page.set_viewport_size({'width':390,'height':844})
    for target in ('jr-tab:tech','jr-tab:history','jr-tab:sets'):
     page.locator('[data-a="'+target+'"]').click()
    for route in ('food','journalFood','pulse','arena','train','store'):
     page.locator('[data-a="go:'+route+'"]').first.click()
     page.evaluate('window.scrollTo(0,0)')
     if engine=='webkit':page.screenshot(path=str(out/('refined-'+route+'.png')))
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),route
    samples=[
     ('reset',['product:RESET']),('food28',['go:store','product:FOOD']),('duo28',['go:store','product:DUO']),
     ('coach',['go:train','expert:train']),('profile',['go:profile']),
     ('stats',['go:journalStats']),('notifications',['go:notifications']),
     ('settings',['go:profile','go:settings']),('recipes',['go:food','foodview:recipes']),
     ('shopping',['foodview:cart']),('compose',['go:pulse','choice-new']),
     ('duel-new',['go:pulse','go:arena','setup:duel']),
     ('relay-new',['go:pulse','go:arena','setup:relay']),
     ('duel-active',['go:pulse','go:arena','game:']),
     ('food-entry',['go:food','go:journalFood','jr-edit:new'])]
    for name,actions in samples:
     for cmd in actions:
      selector='[data-a^="game:"]' if cmd=='game:' else '[data-a="'+cmd+'"]'
      el=page.locator(selector).first
      el.click(timeout=7000)
     page.evaluate('window.scrollTo(0,0)')
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),name
     if engine=='webkit':page.screenshot(path=str(out/('refined-'+name+'.png')))
   assert not errors,errors
   video=page.video
   context.close()
   if capture:video.save_as(out/'walkthrough.webm');video.delete()
  b.close()
server.shutdown()
