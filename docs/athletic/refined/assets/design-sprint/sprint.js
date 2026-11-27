'use strict';
/* Study-only fixtures are isolated from both server accounts and the production diary. */
const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => ritmIcon(name);
const photo = (path,alt='') => '<img src="../'+path+'.webp" alt="'+esc(alt)+'">';
const small = text => '<small>'+text+'</small>';
const copy = (title,sub,kicker='') => '<span class="copy">'+(kicker?'<span class="eyebrow">'+kicker+'</span>':'')+'<b>'+title+'</b>'+small(sub)+'</span>';
const btn = (title,action,cls='secondary',glyph='') => '<button type="button" class="'+cls+'" data-action="'+action+'">'+(glyph?icon(glyph):'')+title+'</button>';
const num = value => new Intl.NumberFormat('ru-RU').format(value);
const screens = {today:'Сегодня',train:'Тренировки',programs:'Программы'};
const modes = {normal:'Заполненные данные',empty:'Пустые данные',loading:'Загрузка',error:'Ошибка связи'};
const exercises = ['Тяга гантели','Жим гантелей','Ягодичный мост'];
const key = 'ritm:design-sprint:v1';
const seed = () => ({index:1, sets:[[ {kg:12,reps:10} ],[ {kg:12,reps:10} ],[]], rest:null,available:30,choice:null});
const restore = () => {
  try {const x=JSON.parse(localStorage.getItem(key));if(x&&Number.isInteger(x.index)&&x.index>=0&&x.index<exercises.length&&Array.isArray(x.sets)&&x.sets.length===exercises.length&&x.sets.every(s=>Array.isArray(s)&&s.every(r=>Number.isFinite(r.kg)&&Number.isInteger(r.reps))))return x;} catch {}
  return seed();
};
let session=restore(),screen,mode,tab='sets',filter='Все',toastTimer,returnFocus;
function persist(){try{localStorage.setItem(key,JSON.stringify(session));return true;}catch{notify('Хранилище недоступно. Запись останется в этой вкладке.');return false;}}
function notify(text){$('notice').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('notice').textContent='',2800);}
function loadAddress(){const q=new URLSearchParams(location.search);screen=Object.hasOwn(screens,q.get('screen'))?q.get('screen'):'today';mode=Object.hasOwn(modes,q.get('state'))?q.get('state'):'normal';}
function address(push=false){const u=new URL(location.href);u.searchParams.set('screen',screen);if(mode==='normal')u.searchParams.delete('state');else u.searchParams.set('state',mode);history[push?'pushState':'replaceState'](null,'',u);}
const heading=(title,caption)=>'<div class="titlebar">'+small(caption)+'<h1>'+title+'</h1></div>';
const listLine=(title,action,tail)=>'<button class="statepick" data-action="'+action+'"><span>'+title+'</span>'+tail+'</button>';
function showSheet(title,body){
  const d=$('sheet');if(!d.open)returnFocus=document.activeElement;
  $('sheet-title').textContent=title;$('sheet-body').innerHTML='<div class="sheetbody">'+body+'</div>';
  if(!d.open)d.showModal();
  d.querySelector('[data-action=close]').focus();
}
function closeSheet(){if($('sheet').open)$('sheet').close();}
function route(next){
  if(!Object.hasOwn(screens,next))return;
  closeSheet();screen=next;tab='sets';mode='normal';address(true);draw();window.scrollTo(0,0);$('view').focus({preventScroll:true});
}
function mountShell(){
  $('mast').innerHTML=btn('ritm.','go:today','logo')+'<div class="tool">'+btn('Учебные данные','states','demo','sliders-horizontal')+'<button type="button" class="icon" data-action="profile" aria-label="Учебный профиль">'+photo('home/sasha-small')+'</button></div>';
  $('sheet').querySelector('[data-action=close]').innerHTML=icon('x');
  $('nav').innerHTML=[['today','Сегодня','house'],['train','Тренировки','dumbbell'],['pulse','PULSE','zap'],['food','Питание','utensils'],['programs','Программы','book-open']].map(([s,label,glyph])=>'<button class="navitem" data-action="'+(s==='food'||s==='pulse'?s:'go:'+s)+'" '+(s===screen?'aria-current="page"':'')+'>'+icon(glyph)+'<span>'+label+'</span></button>').join('');
}
function today(){
  const food=Meals.find(m=>m.id==='green'),minutes=session.available;
  return heading('В своём ритме.','Пятница, 27 ноября')+
  '<div class="metrics"><button class="metric" data-action="activity"><span class="row">'+icon('activity')+'Активность</span><span class="num">4<span class="unit"> / 5 дней</span></span><small>План недели</small><span class="bar"><i style="width:80%"></i></span></button>'+
  '<button class="metric" data-action="food"><span class="row">'+icon('utensils')+'Питание</span><span class="num">1 248</span><small>ккал сегодня</small><span class="macros"><i style="width:27%"></i><i style="width:32%"></i><i style="width:41%"></i></span></button></div>'+
  '<section class="section"><div class="line"><h2>Твой план</h2>'+btn(minutes+' мин','time','chip','clock')+'</div><div class="dayplan">'+
  (minutes>=15?'<button class="training-row" data-action="go:train">'+photo('home/training-small')+copy('Силовая тренировка','15 мин · гантели','Тренировка')+icon('circle-play')+'</button>':'')+
  (minutes>=15?'<button class="food-row" data-action="meal">'+photo(food.pic)+copy('Боул с авокадо',food.mins+' мин · 1 порция',minutes<30?'Вместо тренировки':'Ужин')+icon('chevron-right')+'</button>':'<button class="training-row" data-action="short">'+photo('edition/mobility')+copy('Движение дома','5 мин · без инвентаря','Тренировка')+icon('circle-play')+'</button>')+'</div></section>'+
  '<button class="pulse" data-action="pulse">'+photo('home/lena-small')+copy(session.choice?'Твой выбор принят':'Лена просит выбрать',session.choice?'Открыть ответ':'Её следующее действие','PULSE · CHOICE')+icon('arrow-up-right')+'</button>'+
  '<section class="section"><h2>С поддержкой</h2><button class="offer-row" data-action="offer:RESET">'+photo('edition/start')+copy('RESET LEAGUE','28 дней · '+num(Catalog.RESET.price)+' ₽','Авторский сезон')+icon('arrow-up-right')+'</button></section>';
}
const setTabNames={sets:'Подходы',history:'История',tech:'Техника'};
function train(){
  const n=session.index,rows=session.sets[n];
  const history=panel('Прошлое занятие',n===1?'24 ноября · 12 кг × 10 повторов. Учебная запись.':'Для этого упражнения в примере нет прошлых записей.');
  const detail=tab==='tech'?panel('Техника упражнения','Проверенное видео и анатомическая схема для этого упражнения пока не добавлены. Фотография иллюстрирует занятие.'):tab==='history'?history:
  '<section class="section"><div class="line"><h2>Рабочие подходы</h2>'+small('Гантель · кг')+'</div><div class="sets"><div class="sethead"><span>№</span><span>Вес</span><span>Повторы</span><span></span></div>'+
  rows.map((r,i)=>'<button class="setbutton" data-action="set:'+i+'" aria-description="Изменить записанный подход"><span>'+String(i+1).padStart(2,'0')+'</span><b>'+num(r.kg)+' кг</b><span>'+r.reps+'</span>'+icon('circle-check')+'</button>').join('')+
  '<button class="setbutton chosen" data-action="set:new" aria-description="Записать следующий подход"><span>'+String(rows.length+1).padStart(2,'0')+'</span><span>Вес</span><span>Повторы</span>'+icon('plus')+'</button></div>'+
  btn('Записать подход','set:new','primary','plus')+'</section>'+
  '<div class="rest">'+icon('timer')+'<span class="copy"><small>Отдых</small><strong id="rest" class="time">'+clockText()+'</strong></span>'+btn(session.rest?.end?'Пауза':'Старт','rest','secondary',session.rest?.end?'pause':'play')+'</div>';
  return '<div class="titlebar">'+small('Дневник тренировки')+'<h1>Силовая тренировка</h1></div><section class="exercise">'+photo('studio','Зал, иллюстрация занятия')+'<span class="eyebrow">Упражнение '+(n+1)+' из '+exercises.length+'</span><h2>'+exercises[n]+'</h2><div class="stages" aria-hidden="true">'+exercises.map((_,i)=>'<i class="'+(i<=n?'on':'')+'"></i>').join('')+'</div></section>'+
  '<div class="seg" aria-label="Раздел упражнения">'+Object.entries(setTabNames).map(([id,n])=>'<button data-action="tab:'+id+'" aria-pressed="'+(tab===id)+'">'+n+'</button>').join('')+'</div>'+detail+
  btn(n<exercises.length-1?'Следующее упражнение':'Итог занятия','next','textact','arrow-right');
}
function remaining(){if(!session.rest)return 90;return session.rest.end?Math.max(0,Math.ceil((session.rest.end-Date.now())/1000)):session.rest.left;}
function clockText(){const left=remaining();return String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');}
const panel=(title,text)=>'<section class="pane"><h2>'+title+'</h2><p>'+text+'</p></section>';
const offers=[
 {id:'RESET',name:'RESET LEAGUE',type:'В группе',term:'28 дней · до 10 мест',benefit:'Общий план тренировок и питания',pic:'edition/start'},
 {id:'FOOD',name:'FOOD 28',type:'В группе',term:'28 дней',benefit:'Меню и замены продуктов',pic:'edition/green'},
 {id:'DUO',name:'DUO 28',type:'Для двоих',term:'28 дней · за двоих',benefit:'Две цели и общие задания',pic:'edition/pair'},
 {id:'FREE',name:'Движение дома',type:'Самостоятельно',term:'3 дня с отметкой',benefit:'Разминка без оборудования',pic:'edition/mobility'},
 {id:'PLUS',name:'RITM PLUS',type:'Самостоятельно',term:'В месяц · проверка интереса',benefit:'Самостоятельные программы и рецепты',pic:'home/training'},
 {id:'TRAIN',name:'Личный тренер',type:'С экспертом',term:'28 дней',benefit:'Личный план и четыре разбора',pic:'edition/coach'},
 {id:'NUTRI',name:'Личный нутрициолог',type:'С экспертом',term:'28 дней',benefit:'Дневник питания и четыре разбора',pic:'edition/nutrition'}];
const price=p=>p.id==='FREE'?'Бесплатно':num(p.id==='PLUS'?990:Catalog[p.id].price)+' ₽';
const product=p=>'<button class="product" data-action="offer:'+p.id+'">'+photo(p.pic)+'<span class="copy"><small>'+p.type+'</small><strong>'+p.name+'</strong><span class="meta">'+p.benefit+'</span><span class="price">'+price(p)+'</span><small>'+p.term+'</small></span></button>';
const categories=['Все','В группе','Для двоих','С экспертом','Самостоятельно','Бесплатно'];
function programs(){
  const selected=offers.filter(p=>filter==='Все'||p.type===filter||(filter==='Бесплатно'&&p.id==='FREE')),reset=selected.some(p=>p.id==='RESET');
  const groups=filter==='Все'?[['Программы на 28 дней',['FOOD','DUO']],['Самостоятельно',['FREE','PLUS']],['Личное сопровождение',['TRAIN','NUTRI']]]:[['Предложения',selected.filter(p=>p.id!=='RESET').map(p=>p.id)]];
  return heading('Программы','Тренировки и сопровождение')+
   '<div class="strip" aria-label="Формат программы">'+['Все','В группе','Для двоих'].map(c=>'<button data-action="filter:'+c+'" aria-pressed="'+(filter===c)+'">'+c+'</button>').join('')+'<button class="allfilters" data-action="allfilters" aria-label="Все фильтры" aria-pressed="'+(!['Все','В группе','Для двоих'].includes(filter))+'">'+icon('sliders-horizontal')+'</button></div>'+(!['Все','В группе','Для двоих'].includes(filter)?small('Формат · '+filter):'')+
   (reset?'<button class="season" data-action="offer:RESET">'+photo('edition/start')+'<span class="season-copy"><span class="eyebrow">Авторский сезон · в группе</span><h2>RESET LEAGUE</h2><span>Тренировки и питание с тренером и нутрициологом</span><span class="line priceband"><span class="meta">28 дней · до 10 мест</span><b>'+num(Catalog.RESET.price)+' ₽</b></span></span></button>':'')+
   groups.filter(g=>g[1].length).map(([n,ids])=>'<section class="section"><h2>'+n+'</h2><div class="split-offers">'+ids.map(id=>product(offers.find(p=>p.id===id))).join('')+'</div></section>').join('');
}
function draw(){
  mountShell();document.title='RITM · '+screens[screen];
  const label=screen==='train'?'Тренировка':screens[screen];
  if(mode==='loading')$('view').innerHTML=heading(label,'Учебное состояние')+'<div class="skeletal" role="status" aria-busy="true" aria-label="Загрузка"><i></i><i></i></div>'+btn('Показать данные','normal','secondary');
  else if(mode==='error')$('view').innerHTML=heading(label,'Учебное состояние')+panel('Нет связи','Не удалось обновить этот экран. Сохранённые на устройстве подходы доступны после повторного открытия.')+btn('Повторить','normal','primary','rotate-ccw');
  else if(mode==='empty')$('view').innerHTML=heading(label,'Учебное состояние')+panel({today:'Пока нет записей',train:'Пока нет подходов',programs:'По этому запросу ничего нет'}[screen],{today:'Начни с первой записи в дневнике.',train:'Открой упражнение и запиши вес и повторы.',programs:'Вернись ко всем форматам программы.'}[screen])+btn(screen==='programs'?'Все программы':'Открыть упражнение',screen==='programs'?'normal':'go:train','primary','arrow-right');
  else $('view').innerHTML=({today,train,programs})[screen]();
}
function editSet(index){
  const rows=session.sets[session.index],previous=rows[index]||rows.at(-1)||{kg:12,reps:10};
  const field=(id,name,val,step,min,max)=>'<label for="'+id+'">'+name+'</label><div class="stepper">'+btn('−','adjust:'+id+':-'+step,'icon')+'<input id="'+id+'" type="number" inputmode="decimal" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'" required>'+btn('+','adjust:'+id+':'+step,'icon')+'</div>';
  showSheet(index==='new'?'Новый подход':'Подход '+(Number(index)+1),'<form class="sheetbody" id="set-form" data-index="'+index+'">'+field('kg','Рабочий вес, кг',previous.kg,.5,0,1500)+field('reps','Повторы',previous.reps,1,1,10000)+'<button class="primary full" type="submit">'+icon('check')+'Сохранить подход</button></form>');
  $('set-form').querySelectorAll('[data-action^="adjust"]').forEach(b=>{const [,id,v]=b.dataset.action.split(':');b.setAttribute('aria-label',(Number(v)>0?'Увеличить':'Уменьшить')+(id==='kg'?' вес':' повторы'));});
}
function dispatch(cmd){
  const [a,v,t]=cmd.split(':');
  if(a==='go'){route(v);return;}
  if(a==='close'){closeSheet();return;}
  if(a==='states'){showSheet('Проверка экрана',Object.entries(modes).map(([id,n])=>'<button class="statepick" data-action="state:'+id+'" aria-pressed="'+(id===mode)+'">'+n+icon(id===mode?'check':'chevron-right')+'</button>').join(''));return;}
  if(a==='state'||a==='normal'){closeSheet();mode=v||'normal';address();draw();return;}
  if(a==='profile'){showSheet('Учебный профиль',panel('Саша','Данные на этих трёх экранах учебные. Записи подходов сохраняются только в этом прототипе.')+btn('Открыть дневник','go:train','primary'));return;}
  if(a==='activity'){showSheet('Активность недели',panel('4 дня из 5','План недели выполнен на 80%. В учебном примере отмечены четыре разных дня активности.')+btn('Открыть тренировку','go:train','primary'));return;}
  if(a==='food'){showSheet('Питание сегодня',panel('1 248 ккал','Учебная запись. Доли энергии за день: белки 27%, жиры 32%, углеводы 41%.')+btn('Открыть блюдо','meal','primary'));return;}
  if(a==='meal'){const p=Meals.find(m=>m.id==='green');showSheet(p.name,photo(p.pic)+'<p>'+p.mins+' минут · 1 порция</p><p>'+esc(p.steps.join(' '))+'</p>');return;}
  if(a==='time'){showSheet('Время на сегодня',[5,15,30].map(n=>listLine(n+' минут','minutes:'+n,icon(n===session.available?'check':'chevron-right'))).join(''));return;}
  if(a==='minutes'){session.available=Number(v);persist();closeSheet();draw();return;}
  if(a==='short'){showSheet('Движение дома',panel('5 минут','Короткое самостоятельное занятие без инвентаря.')+btn('Открыть дневник','go:train','primary'));return;}
  if(a==='pulse'){showSheet('Выбери ход Лены',photo('home/lena-small')+'<p>В учебном CHOICE ты выбираешь, какое действие выполнит Лена.</p>'+['Прогулка','Разминка дома'].map(n=>listLine(n,'vote:'+n,icon(n===session.choice?'check':'chevron-right'))).join(''));return;}
  if(a==='vote'){session.choice=v;persist();closeSheet();draw();notify('Твой выбор · '+v);return;}
  if(a==='tab'){tab=v;draw();document.querySelector('[data-action="tab:'+v+'"]').focus({preventScroll:true});return;}
  if(a==='set'){editSet(v);return;}
  if(a==='adjust'){const input=$(v);if(Number(t)>0)input.stepUp();else input.stepDown();return;}
  if(a==='rest'){const left=remaining();session.rest=session.rest?.end?{left}:{end:Date.now()+(left||90)*1000};persist();draw();return;}
  if(a==='next'){if(session.index<exercises.length-1){session.index++;session.rest=null;tab='sets';persist();draw();window.scrollTo(0,0);}else{showSheet('Итог занятия',panel('Записано подходов: '+session.sets.flat().length,'Учебная история сохранена в этом браузере.')+btn('Вернуться на главную','go:today','primary'));}return;}
  if(a==='allfilters'){showSheet('Формат программы',categories.map(c=>listLine(c,'filter:'+c,icon(filter===c?'check':'chevron-right'))).join(''));return;}
  if(a==='filter'){closeSheet();filter=v;draw();const el=Array.from(document.querySelectorAll('[data-action^="filter:"]')).find(b=>b.dataset.action===cmd);el?.focus({preventScroll:true});el?.scrollIntoView({block:'nearest',inline:'nearest'});return;}
  if(a==='offer'){const p=offers.find(x=>x.id===v);const product=Catalog[v];
    const content=product?product.content.map(x=>'<li>'+esc(x)+'</li>').join(''):'<li>'+p.benefit+'</li>';
    showSheet(p.name,photo(p.pic)+'<div class="line"><b>'+price(p)+'</b>'+small(p.term)+'</div><p>'+p.type+(product?' · '+esc(product.who):'')+'</p><ul>'+content+'</ul><small>'+(v==='PLUS'?'Проверка интереса к подписке.':'Учебный просмотр условий. Оплата здесь не производится.')+'</small>');return;}
}
document.addEventListener('click',ev=>{const b=ev.target.closest('button[data-action]');if(b)dispatch(b.dataset.action);});
document.addEventListener('submit',ev=>{if(ev.target.id!=='set-form')return;ev.preventDefault();const kg=$('kg').valueAsNumber,reps=$('reps').valueAsNumber;if(!ev.target.reportValidity()||!Number.isFinite(kg)||!Number.isInteger(reps))return;const i=ev.target.dataset.index,rows=session.sets[session.index];if(i==='new')rows.push({kg,reps});else rows[Number(i)]={kg,reps};const saved=persist();closeSheet();draw();notify(saved?'Подход сохранён':'Подход записан в этой вкладке');});
$('sheet').addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
window.addEventListener('popstate',()=>{closeSheet();loadAddress();draw();});
setInterval(()=>{const el=$('rest');if(!el)return;el.textContent=clockText();if(session.rest?.end&&remaining()===0){session.rest={left:0};persist();draw();}},350);
loadAddress();draw();
if('ResizeObserver' in window)new ResizeObserver(()=>{document.documentElement.style.setProperty('--measured-nav',$('nav').getBoundingClientRect().height+'px');}).observe($('nav'));
