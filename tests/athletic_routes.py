import sys,time,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
url,width,engine=sys.argv[1:];base=Path(__file__).parent
with sync_playwright() as p:
 b=getattr(p,engine).launch();q=b.new_page(viewport={'width':int(width),'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
 q.set_default_timeout(30000);q.goto(url+'?screen=today',timeout=90000,wait_until='domcontentloaded')
 errs=[];q.on('pageerror',lambda e:errs.append(str(e)));rows=[]
 def tap(k):
  if k.startswith('catalog-quick') and not q.locator('.catalog-filters').evaluate('(e)=>e.open'):q.locator('.catalog-filters summary').click()
  q.locator('[data-a="'+k+'"]').first.click()
 def route(name,keys,check):
  q.locator('nav [data-a="go:today"]').click();expect(q.locator('body')).to_have_attribute('data-screen','today')
  t=time.perf_counter()
  for k in keys:
   if k.startswith('#'):q.locator(k).click()
   else:tap(k)
  expect(q.locator(check).first).to_be_visible(timeout=30000)
  rows.append([name,len(keys),round(time.perf_counter()-t,2)])
 for tab in ['train','store','pulse','arena','food','today']:
  tap('go:'+tab);expect(q.locator('body')).to_have_attribute('data-screen',tab)
  assert q.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),tab
  q.evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))')
  if tab in ['train','store','arena']:q.screenshot(path=str(Path.home()/'AppData/Local/Temp'/('ath-'+width+'-'+tab+'.png')))
 route('DUO 28',['go:store','product:DUO'],'[data-a="book:DUO"]')
 route('Найти занятие',['go:train','work:studio'],'[data-a=timer]')
 route('Авторские программы',['go:train','author-series'],'.ath-food')
 route('Страница специалиста',['go:train','expert:train'],'[data-a="product:TRAIN"]')
 route('Выбрать бесплатный формат',['go:store','catalog-quick:Бесплатные'],'.catalog-item[data-a^="solo:"]')
 route('Цена и состав RESET',['go:store','product:RESET'],'[data-a="book:RESET"]')
 route('Дуэль и приглашение',['go:pulse','go:arena','setup:duel','create-mode'],'body[data-screen="share"]')
 route('Открыть купленную программу', ['go:store','product:RESET','book:RESET','receipt:paid'],'body')
 q.locator('nav [data-a="go:today"]').click();expect(q.locator('[data-a="go:league-support"]').first).to_be_visible();route('Вернуться в сезон',['go:league-support'],'#lc-question')
 q.locator('nav [data-a="go:food"]').click();q.locator('#pref-limit').select_option('Нет исключений');tap('food-save');q.locator('#pref-limit').wait_for(state='hidden')
 ids=q.locator('.club-menu [data-a]').evaluate_all('(xs)=>xs.map(x=>x.dataset.a)');assert ids and len(ids)==len(set(ids))
 meal=ids[0];route('Ужин и список покупок',['go:food',meal,'cartadd:'+meal.split(':')[1]],'body');q.locator('nav [data-a="go:food"]').click();tap('foodview:cart');expect(q.locator('[data-a=cartclear]')).to_be_visible()
 q.reload(wait_until='domcontentloaded');q.locator('nav [data-a="go:today"]').click();expect(q.locator('[data-a="go:league-support"]').first).to_be_visible();assert not errs,errs
 print(width,engine,rows,flush=True)
