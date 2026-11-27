(()=>{'use strict';
const $=s=>document.querySelector(s),e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const I=(n,size=22)=>'<svg class="i" style="width:'+size+'px;height:'+size+'px" aria-hidden="true" viewBox="0 0 24 24">'+(iconShapes[n]||iconShapes.activity)+'</svg>';
const b=(txt,id,cls='btn',ic='')=>'<button type="button" class="'+cls+'" data-a="'+e(id)+'">'+(ic?I(ic,18):'')+e(txt)+'</button>';
const ib=(ic,id,l)=>'<button type="button" class="iconbtn" data-a="'+e(id)+'" aria-label="'+e(l)+'">'+I(ic)+'</button>';
const photo=(key,alt='',cls='')=>'<img class="'+cls+'" src="assets/'+key+'.webp" alt="'+e(alt)+'" decoding="async">';
const pic=(key,cap,title,meta,id,mono=false)=>'<button class="picture '+(mono?'mono':'')+'" data-a="'+e(id)+'">'+photo(key)+'<span class="copy"><small class="cap">'+e(cap)+'</small><b>'+e(title)+'</b><small>'+e(meta)+'</small></span></button>';
const label=x=>'<span class="cap">'+e(x)+'</span>',muted=x=>'<p class="muted">'+e(x)+'</p>',num=n=>new Intl.NumberFormat('ru-RU').format(n),pct=(a,b)=>Math.min(100,Math.round(100*a/Math.max(1,b)));
const field=(id,title,v='',type='text',more='')=>'<label>'+e(title)+'<input id="'+id+'" type="'+type+'" value="'+e(v)+'" '+more+'></label>';
const wave='<svg class="wave" viewBox="0 0 140 100" aria-hidden="true">'+Array.from({length:7},(_,i)=>'<path d="M-10 '+(40+i*2)+' Q20 48 34 45 T52 38L63 '+(9+i*2)+'L78 '+(83-i*3)+'L93 '+(34+i)+'Q105 46 140 40"/>').join('')+'</svg>';
const ring=n=>'<svg class="ring" viewBox="0 0 80 80" role="img" aria-label="Выполнено '+n+' процентов плана"><circle cx="40" cy="40" r="33" stroke="#31362e"/><circle class="bar" cx="40" cy="40" r="33" stroke="#d5fc53" pathLength="100" stroke-dasharray="'+n+' 100" transform="rotate(-90 40 40)"/><path d="M19 42h12l6-12 8 23 6-13h11" fill="none" stroke="#d5fc53" stroke-width="2.5" stroke-linejoin="round"/></svg>';
let trainingPlace='Для тебя';
let formMode='quick';
const quickQuestions=[DnaSteps[0],DnaSteps.find(q=>q[0]==='minutes'),DnaSteps.find(q=>q[0]==='place')];
const questions=()=>formMode==='full'?DnaSteps:quickQuestions;
const goalLabels={'Регулярность тренировок':'Заниматься дома','Стать сильнее':'Вернуться к силовым','Питание в будни':'Готовить для себя','Больше движения':'Чаще гулять'};
const labels={move:'Тренировка',food:'Питание',walk:'Прогулка'},navs=[['today','Сегодня','house'],['train','Тренировки','dumbbell'],['pulse','PULSE','zap'],['food','Питание','utensils'],['store','Программы','book-open']];
const demo=!!window.ritmDemo;
let duelReward = '';
let S,view='intro',detail='',stack=[],busy=false,ready=false,draft={},step=0,time=15,mt='Ужин',pantry='',qPantry=false,onlyFav=false,portions=1,foodView='week',arenaMode='duel',gameKind='move',activeGame='',reply=null,taskKind='move',privateAction=true,confirm='',code='',statusText='',clock=null,sTimer=null,left=600,sets=1,reps=8,trainingKey='',timerBudget=0,pendingWorkout=null,activeSet=false,activeClock=null,calendarSlot='',toastTimer=null,recipeChoice='salad',pendingGuest=new URLSearchParams(location.search).get('invite'),guestInfo=null,lastFocus=null;
const read=k=>{try{return JSON.parse(localStorage.getItem(key(k))||'null')}catch{return null}}, save=(k,v)=>localStorage.setItem(key(k),JSON.stringify(v)),key=k=>(demo?window.ritmDemo.storagePrefix:'ritm-ui-live-')+(S?.profile.id||'init')+'-'+k;
const notice=msg=>{statusText=msg;$('#toast').textContent=msg;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').textContent='';},3500);};
const route=(name,arg='',push=true)=>{if(push)stack.push([view,detail]);view=name;detail=arg;draw();window.scrollTo({top:0,behavior:'instant'});$('#content').focus({preventScroll:true});};
const back=()=>{const old=stack.pop()||['today',''];route(...old,false);};
const opt=(name,val)=>e(name)+'="'+e(val)+'"';
async function api(path,body){
 if(demo)return window.ritmDemo.api(path,body);
 let response;
 try{response=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});}
 catch{const err=Error('Нет связи с RITM. Проверь подключение и попробуй ещё раз.');err.networkDown=true;throw err;}
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result)throw Error(result?.error||'Сервис временно недоступен. Попробуй ещё раз.');
 return result;
}
const nonce=()=>Array.from(crypto.getRandomValues(new Uint32Array(3))).join('-');
let offlineJournal=false;
function rememberWorkout(){
 const workout=S.workouts?.find(w=>w.status==='active');
 if(workout)localStorage.setItem('ritm-pilot-active',JSON.stringify({profile:{id:S.profile.id},workouts:[workout]}));
 else localStorage.removeItem('ritm-pilot-active');
}
async function write(verb,fields={}){S=await api('/api/action',{verb,nonce:nonce(),...fields});rememberWorkout();return S.result||{};}
const shown=new Map();
function expose(k){
 if(!shown.has(k)){
   const recording=api('/api/action',{verb:'exposure',nonce:nonce(),step:k,channel:new URLSearchParams(location.search).get('channel')||'direct'})
     .then(()=>true,()=>{shown.delete(k);return false;});
   shown.set(k,recording);
 }
 return shown.get(k);
}
function weekly(){const today=Date.parse(S.day+'T00:00:00Z'),offset=(new Date(today).getUTCDay()+6)%7;const days=Array.from({length:7},(_,i)=>new Date(today+(i-offset)*86400000).toISOString().slice(0,10));const counts=days.map(d=>(S.history||[]).filter(a=>a.day===d).length);const target=S.season?.plan.days||Number(read('days'))||5;return {days,counts,target,total:counts.filter(Boolean).length,percent:pct(counts.filter(Boolean).length,target)};}
const incoming=()=>S.pulse.filter(x=>x.person!==S.profile.id&&x.source&&!x.answered).sort((a,b)=>b.at-a.at)[0];
const allows=m=>{const p=S.dna||{},limit=p.limit||'';if(limit==='Указать свои'||limit.startsWith('Свои:'))return false;if(p.food==='Растительную'&&!m.plant||p.food==='Без мяса'&&!m.veg)return false;return !m.all.includes(limit)};
const dishes=()=>Meals.filter(allows),recipe=id=>Meals.find(m=>m.id===id),work=id=>Workouts.find(x=>x.id===id)||Workouts[0];
const logo='<span class="wordmark">ritm.</span>';
function activeTab(){
 if(['store','plus','product','solo','league-support','next-season'].includes(view))return 'store';
 if(['meal','food','journalFood'].includes(view))return 'food';
 if(['work','tech','train','journalTrain'].includes(view))return 'train';
 if(['pulse','arena','game','setup','share','invite','choice','choice-compose'].includes(view)||view==='action'&&reply)return 'pulse';
 return ['today','journalStats'].includes(view)?'today':'';
}
function head(title,cap=''){return (cap?label(cap):'')+'<h1>'+e(title)+'</h1>';}
const row = options => RitmVisual.photoRow(photo,I,e,options);
const hero = options => RitmVisual.hero(photo,I,e,options);
const face = member => RitmVisual.figure(member,demo,e);
const programs = createProgramViews({state:()=>S, photo,I,b,e,label,head,num});
const choice = window.RitmChoice({state:()=>S, write, route, draw, notice, e, b, I, face, label, demo, heartbeat});
const rewardLine = reward => reward ? '<span class="duel-reward">'+I('hand-heart',19)+'<span><small>Ваша награда</small><b>'+e(reward)+'</b></span></span>' : '';
const eventTime = stamp => S.server_time-stamp<86400?RitmHome.relative(stamp,S.server_time):new Date(stamp*1000).toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
function homeHelpers() {
  return {I,e,demo,weekly,incoming,time,personal:programs.active(),dinner:(read('food-reviewed')||S.dna?.limit)&&currentDinner()};
}
const heartbeatPattern = [35, 85, 55];
let nextHeartbeat = 0;
function hapticsEnabled() {
  return read('pulseHaptics') ?? !matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function heartbeat() {
  const now = performance.now();
  if (document.hidden || now < nextHeartbeat) return;
  nextHeartbeat = now + 240;
  document.querySelector('#nav .pulse-nav')?.classList.add('heartbeat');
  if (hapticsEnabled() && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(heartbeatPattern); } catch { /* Some hosts block device vibration. */ }
  }
}
function hapticSetting() {
  if (typeof navigator.vibrate !== 'function') return '';
  return '<h2>Отклик</h2><label class="checks"><input id="pulse-haptics" type="checkbox" '+(hapticsEnabled()?'checked':'')+'>Вибрация кнопки PULSE</label>';
}
function spotlight(art,kicker,title,note,action,cta){
 return '<button class="club-cover" data-a="'+e(action)+'">'+photo(art,'')+'<span class="club-legend"><small>'+e(kicker)+'</small><strong>'+e(title)+'</strong><span>'+e(note)+'</span><em>'+e(cta)+' '+I('arrow-up-right',16)+'</em></span></button>';
}
function tile(art,title,note,action){
 return '<button class="club-tile" data-a="'+e(action)+'">'+photo(art,'')+'<span><strong>'+e(title)+'</strong><small>'+e(note)+'</small></span></button>';
}
function expertRow(id){
 const x=Experts[id];return row({art:x.photo,kicker:'Персональное сопровождение',title:Catalog[x.product].title,note:num(Catalog[x.product].price)+' ₽ · 28 дней',action:'expert:'+id});
}
function today(){
 const helpers=homeHelpers(),plan=programs.current()||programs.recommended(),food=plan==='kitchen',w=work(plan),week=weekly();
 const next=food?helpers.dinner:w;
 const selected=next && (!food||next.mins<=time);
 const date=new Date(S.day+'T12:00:00Z').toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});
 const main=selected?spotlight(next.pic,food?'Ужин на сегодня':'Тренировка на сегодня',food?next.name:next.title,(food?next.mins:Math.min(time,next.mins))+' мин',food?'meal:'+next.id:'work:'+next.id,food?'Открыть рецепт':'Открыть занятие'):b('Выбрать блюдо под свой день','go:food','btn full');
 return head('Твой день. Твой ритм.',date)+helpers.personal+b('Мой прогресс','go:journalStats','textbtn')+
 '<button class="club-week home-week" data-a="homeplan"><span><strong>'+ (week.total?'Твоя неделя':'Начни с одного дела')+'</strong><small>'+ (week.total?week.total+' из '+week.target+' дней':'Первая отметка появится после занятия или ужина')+'</small></span><span class="club-days">'+week.counts.map((x,i)=>'<i class="'+(x?'done':'')+'">'+['Пн','Вт','Ср','Чт','Пт','Сб','Вс'][i]+'</i>').join('')+'</span></button>'+
 '<div class="between"><h2>Следующий шаг</h2>'+b(time+' мин','quicktime','chip','clock')+'</div>'+main+b(food?'Вместо ужина — выбрать тренировку':'Вместо тренировки — выбрать ужин',food?'go:train':'go:food','textbtn full')+
 (incoming()?RitmHome.pulse(S,helpers):b('Бросить другу вызов на неделю','setup:duel','club-social full','swords'))+
 (S.booking?.paid_kopeks>S.booking?.refunded_kopeks?'':expertRow(food?'food':'train'));
}
function homeSheet(title,body) {
  document.getElementById('home-sheet')?.remove();
  const dialog=document.createElement('dialog');
  dialog.id='home-sheet';dialog.className='home-sheet';dialog.setAttribute('aria-labelledby','sheet-title');
  dialog.innerHTML='<div class="sheet-top"><h2 id="sheet-title">'+e(title)+'</h2>'+ib('x','sheetclose','Закрыть')+'</div>'+body;
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.addEventListener('click',ev=>{if(ev.target===dialog){const r=dialog.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)dialog.close();}});
  document.body.append(dialog);dialog.showModal();
}
function showHomeTime() {
  homeSheet('Сколько есть времени?',times());
  document.getElementById('home-sheet').dataset.picker='quick';
}
function showHomePlan() {
  const w=RitmHome.week(S,weekly);
  const duel=S.games.find(g=>g.mode==='duel'&&g.active);
  const links=[['Записать действие','action:move'],['Подстроить план','go:ai'],['Тренировки','go:train'],['Экспертные разборы','go:experts'],['Программы и сезоны','go:store']];
  if(duel)links.push(['Моя дуэль','game:'+duel.id]);
  homeSheet('Мой план',muted(w.caption+'. Выбери, сколько времени есть сегодня.')+times()+'<div class="sheet-links">'+links.map(([t,id])=>b(t,id,'','arrow-right')).join('')+'</div>');
}
const times=()=>'<div class="chips">'+[5,10,20,30,60].map(v=>b(v+' мин','time:'+v,'chip '+(v===time?'on':''))).join('')+'</div>';
const goalCards={
 'Регулярность тренировок':['Вернуться в форму','Постепенный старт','activity'],
 'Стать сильнее':['Стать сильнее','Силовые занятия','dumbbell'],
 'Питание в будни':['Наладить питание','Еда на каждый день','utensils'],
 'Больше движения':['Больше двигаться','Прогулки в своём темпе','footprints']
};
function intro(){
 const d=view==='dna'?draft:{}, kitchen=d.goal==='Питание в будни';
 const options=(key,values)=>values.map(v=>'<button type="button" data-a="quick-'+key+':'+e(v)+'" aria-pressed="'+(d[key]===v)+'">'+e(v)+'</button>').join('');
 return '<section class="compact-start"><h1>Начнём с тебя.</h1><p>Подберём первый шаг под твой день.</p><h2>Твоя цель</h2><div class="goal-grid">'+
 Object.entries(goalCards).map(([id,[name,note,icon]])=>'<button aria-pressed="'+(id===d.goal)+'" data-a="start-goal:'+e(id)+'">'+I(icon,22)+'<strong>'+e(name)+'</strong></button>').join('')+
 '</div><h2>'+(kitchen?'Сколько времени на готовку?':'Сколько времени есть?')+'</h2><div class="quick-choices" aria-label="Минуты">'+options('minutes',quickQuestions[1][2])+'</div>'+
 (!kitchen&&d.goal?'<h2>Где удобнее заниматься?</h2><div class="quick-choices">'+options('place',quickQuestions[2][2])+'</div>':'')+
 '<button class="btn full" data-a="quick-plan" '+(d.goal&&d.minutes&&(kitchen||d.place)?'':'disabled')+'>Подобрать мой первый шаг</button>'+
 '<div class="entry-links">'+(d.goal?b('Продолжить позже','dna-later','textbtn'):'')+b('Все программы','go:store','textbtn')+b('Есть приглашение','invitation','textbtn')+b('Посмотреть демо',demo?'demo-start':'open-demo','textbtn')+(!demo?b('Восстановить профиль','go:recover','textbtn'):'')+'</div></section>';
}
function dna(){
  if(formMode==='quick')return intro();
  const steps=questions(), [k,storedTitle,opts,optional]=steps[step];
  const title=formMode==='quick'?(k==='goal'?'С чего хочешь начать?':k==='minutes'?'Сколько минут у тебя есть?':'Где удобнее заниматься?'):storedTitle;
  const choices=opts.map(o=>{
    const txt=k==='goal'?(goalLabels[o]||o):k==='minutes'?o+' минут':o;
    const checked=draft[k]===o;
    return '<button type="button" class="answer-option" aria-pressed="'+checked+'" data-a="dnaopt:'+e(o)+'"><span>'+e(txt)+'</span><i aria-hidden="true">'+(checked?I('check',15):'')+'</i></button>';
  }).join('');
  const custom=k==='limit'&&draft[k]==='Указать свои';
  const next=step<steps.length-1?'Дальше':formMode==='quick'?'Посмотреть программу':'Сохранить ответы';
  return '<div class="onboarding-screen">'+label((formMode==='quick'?'Подбор программы':'Мои предпочтения')+' · '+(step+1)+' из '+steps.length)+
    '<div class="meter"><i style="width:'+pct(step+1,steps.length)+'%"></i></div><h1>'+e(title)+'</h1>'+
    (formMode==='quick'&&step===1?muted((goalLabels[draft.goal]||draft.goal)+' · выбери удобную длительность.'):'')+
    (optional?muted('Учитываем ответ при подборе блюд. Этот вопрос можно пропустить.'):'')+
    '<div class="answer-list">'+choices+'</div>'+(custom?field('customLimit','Какие продукты исключить?',draft.custom||'','text','maxlength="120"'):'')+
    '<button class="btn full" data-a="dnanext" '+(!draft[k]?'disabled':'')+'>'+next+I('arrow-right',18)+'</button>'+
    '<div class="onboard-links">'+(step?b('Назад','dnaback','textbtn'):'')+(optional?b('Пропустить вопрос','dnaskip','textbtn'):'')+
    b('Продолжить позже','dna-later','textbtn')+'</div></div>';
}
async function finishPersonalPlan(){await write('dna',{data:draft});await write('profile',{name:S.profile.name||'Участник',goal:({'Стать сильнее':'Физическая форма','Больше движения':'Прогулки','Питание в будни':'Питание'})[draft.goal]||'Регулярное движение',barrier:draft.barrier||'Мало времени',program:S.profile.program||'Своя программа'});save('entered',true);time=Number(draft.minutes)||20;save('available',{day:S.day,minutes:time});sessionStorage.removeItem(key('onboarding'));if(formMode==='quick'){stack=[['today','']];route('solo',programs.recommended(),false);}else route('dna-map');}
function dnaMap(){const d=S.dna||{};return head('Твои предпочтения','Личный профиль')+'<div class="card">'+label('Личная цель')+'<h2>'+e(d.goal||S.profile.goal||'Выбери первую цель')+'</h2>'+muted(d.shape||'Карта строится из твоих ответов.')+'</div>'+[['Препятствие',d.barrier],['Режим',d.minutes?d.minutes+' минут · '+d.place:'Выбери доступное время'],['Поддержка',d.motivation||'Личный план'],['Первый шаг',d.goal==='Питание в будни'?'Выбери одно блюдо из доступных продуктов.':'Выбери короткий знакомый блок или прогулку.']].map(x=>'<div class="item"><span>'+e(x[0])+'</span><b>'+e(x[1]||'Можно уточнить')+'</b></div>').join('')+b('К моему дню','go:today','btn full')+b('Настроить предпочтения','editdna','textbtn');}
function duelcard(g) {
  const me=g.participants.find(p=>p.id===S.profile.id),other=g.participants.find(p=>p.id!==S.profile.id);
  const start=g.starts?new Date((g.starts+3*3600)*1000).toISOString().slice(0,10):null;
  const dayNumber=start?Math.min(7,1+Math.floor((Date.parse(S.day)-Date.parse(start))/86400000)):0;
  const status=!start?'Ожидает друга':g.active?'День '+dayNumber+' из 7':'Завершена';
  function side(p,title) {
    const dates=new Set(p?.days||[]);
    const slots=Array.from({length:7},(_,i)=>start&&dates.has(new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10)));
    return '<div class="rival">'+(p?face(p):I('user',30))+'<strong>'+dates.size+'</strong><b>'+e(title)+'</b><span class="seven">'+slots.map(on=>'<i class="'+(on?'lit':'')+'"></i>').join('')+'</span></div>';
  }
  return '<button class="scoreboard" data-a="game:'+e(g.id)+'"><span class="between"><span class="cap">Дуэль недели</span><small>'+status+'</small></span><span class="rivals">'+
    side(me,'Ты')+'<span class="vs">:</span>'+side(other,other?.name||'Друг')+'</span>'+rewardLine(g.reward)+(start?'<span class="ath-calendar">'+Array.from({length:7},(_,i)=>'<span class="'+(g.active&&i+1===dayNumber?'current':'')+'">'+new Date(Date.parse(start)+i*86400000).toLocaleDateString('ru-RU',{weekday:'short',timeZone:'UTC'})+'</span>').join('')+'</span>':'')+'<span class="score-link">История дуэли '+I('arrow-up-right',15)+'</span></button>';
}
function pulse() {
  const circles=S.games.filter(g=>g.mode==='circle');
  const groups=circles.map(g=>'<section class="social-group"><div class="between"><h2>Твой круг</h2>'+
    ib('settings','circle:'+g.id,'Управление кругом')+'</div><div class="circle-faces">'+g.participants.map(p=>{
      const mark=S.pulse.find(x=>x.game===g.id&&x.person===p.id);
      return '<button data-a="circle:'+e(g.id)+'">'+face(p)+'<b>'+e(p.id===S.profile.id?'Ты':p.name||'Друг')+'</b><small>'+(mark?.count||0)+' '+(['дел','дело','дела','дела'][mark?.count||0]||'дел')+'</small></button>';
    }).join('')+'</div>'+(g.token&&g.invite_open?b('Пригласить в круг','share:'+g.id,'textbtn','link'):'')+'</section>').join('');
  const entries=(S.feed||[]).slice(0,16).map(x=>'<div class="social-event">'+face({id:x.person,name:x.name})+'<div>'+label(x.to_me?'Ответ тебе':labels[x.kind])+
    '<b>'+e(x.person===S.profile.id?'Ты':x.name||'Друг')+'</b><small>'+e(eventTime(x.at))+'</small></div>'+
    (x.person===S.profile.id?'<small>'+x.cheers+' реакций</small>':b(String(x.cheers),'cheer:'+x.circle+':'+x.action,'chip '+(x.cheered?'on':''),'heart'))+'</div>').join('');
  const event=incoming();
  const inviteTools='<div class="pulse-tools">'+b('Устроить дуэль','setup:duel','linebtn','swords')+
    b('Совместное время','together','linebtn','clock')+'</div>';
  return head('Твой круг','PULSE')+(event?RitmHome.pulse(S,homeHelpers()):'')+choice.modeMenu()+spotlight('track','Арена · 7 дней','Выйдем на старт вместе?','Выберите каждый своё действие и сравните регулярность.','go:arena','Открыть Арену')+inviteTools+b('Настроить поддержку','context:social','textbtn')+
    (groups||'<h2>Твой круг</h2>')+b(circles.length?'Создать ещё один круг':'Создать круг друзей','create:circle','textbtn','users')+
    (entries||circles.length?'<h2>Лента круга</h2>'+(entries||muted('Когда участник поделится делом, оно появится здесь.')):'')+
    '<div class="pulse-tools">'+b('Записать своё дело','action:move','linebtn','plus')+b('Приватность','go:privacy','linebtn','lock')+'</div>';

}
function actionScreen(){let m=recipe(recipeChoice);return head(reply?'Ответить своим делом':'Моё действие',reply?'PULSE':'План на сегодня')+'<div class="chips">'+Object.entries(labels).map(([k,v])=>b(v,'kind:'+k,'chip '+(k===taskKind?'on':''))).join('')+'</div><h2>Доступное время</h2>'+times()+'<div class="card">'+(taskKind==='food'?label('FOOD')+'<h3>'+e(m?.name||'Выбери блюдо')+'</h3>'+b('Выбрать другое блюдо','go:food','textbtn'):label('Твой план')+'<h3>'+e(pendingWorkout?work(pendingWorkout.workout).title:taskKind==='walk'?'Прогулка в своём темпе':'Знакомый блок программы')+'</h3>'+muted('Выбери движение из своего согласованного плана.'))+'</div>'+(reply||S.games.some(g=>g.mode==='circle')?'<label class="checks"><input type="checkbox" id="visible" '+(!privateAction||reply?'checked':'')+(reply?' disabled':'')+'>Поделиться видом действия с кругом</label>':'')+b(reply?'Ответить импульсом':'Отметить выполнение','complete','btn full','check')+b('Сегодня сложно · короткая версия','short','textbtn');}

function arena() {
  const games=S.games,featured=games.find(g=>g.mode==='duel'&&g.active&&g.starts);
  const modes=[['Дуэль 1 на 1','Семь дней регулярности','duel','swords'],['Эстафета','Передать ход другу','relay','repeat-2'],
    ['Командная цель','Общий результат круга','team','users'],['Недельный челлендж','Одна отметка в день','week','calendar-days'],['RESET LEAGUE','28 дней с тренером и нутрициологом','store','trophy']];
  return head('Арена.')+(featured?'<section class="ath-duel"><h2>Твоя дуэль</h2>'+duelcard(featured)+(featured.participants.find(p=>p.id===S.profile.id)?.days.includes(S.day)?muted('Твой ход сегодня уже засчитан.'):b('Выполнить свой ход','play:'+featured.id,'btn full'))+'</section>':'')+spotlight('athlete','Новый вызов','7 дней в паре.','Выберите каждый своё действие. Считаются дни, когда каждый сделал свой ход.','setup:duel','Вызвать друга')+'<details><summary>Входящие приглашения</summary>'+choice.noticeRows().map(([t,m,k])=>b(t+' · '+m,k,'linebtn full')).join('')+muted('Если друг отправил приглашение, открой его ссылку или вставь код.')+b('Открыть приглашение','invitation','linebtn full','link')+'</details>'+
    '<h2>Выбери формат</h2><div class="mode-list">'+modes.map(([t,n,k,i])=>'<button data-a="'+(k==='store'?'product:RESET':'setup:'+k)+'">'+I(i,19)+'<span><b>'+t+'</b><small>'+n+'</small></span>'+I('chevron-right',15)+'</button>').join('')+'</div>'+
    '<details><summary>Награды за регулярность</summary><p>Для дуэли можно выбрать совместный фильм или прогулку. Выдача сертификатов REWARDS пока планируется.</p></details>'+(games.some(g=>g!==featured)?'<h2>Другие игры</h2>'+games.filter(g=>g!==featured).map(g=>g.mode==='duel'?duelcard(g):row({kicker:(g.mode==='circle'?'Команда':'Эстафета'),title:(g.mode==='circle'?'Цель команды':'Передача хода'),note:g.active?'Идёт':'Завершена',action:'game:'+g.id})).join(''):'');
}
function setup(){const texts={duel:['Дуэль 1 на 1','У каждого своё дело. Счёт растёт за регулярность.'],relay:['Передать ход','Сначала выполни своё дело. После передачи у друга есть 24 часа на ответ.'],team:['Командная цель','Соберите круг до четырёх человек. Цель — чтобы каждый участник отметил хотя бы одно дело за неделю.'],week:['Недельный челлендж','Семь дней и одно очко за день. Используются правила дуэли.'],together:['Вместе по времени','Предложи время встречи. Каждый выполнит своё действие.']},x=texts[arenaMode];return head(x[0],'Арена')+muted(x[1])+'<div class="card">'+label('Моя часть')+'<div class="chips">'+Object.entries(labels).map(([k,v])=>b(v,'gamekind:'+k,'chip '+(gameKind===k?'on':''))).join('')+'</div>'+(arenaMode==='duel'?field('duel-reward','Символическая награда, по желанию',duelReward,'text','maxlength="80" placeholder="Победитель выбирает фильм"')+'<small>Фильм, маршрут прогулки или совместное событие. Без денег и ставок.</small>':'')+(arenaMode==='together'?field('slot','Когда удобно вместе',calendarSlot,'datetime-local'):'')+'</div>'+(arenaMode==='duel'?'<section class="club-invite">'+label('Так увидит друг')+'<h2>Давай неделю держать ритм?</h2><p>Мой выбор — '+e(labels[gameKind])+'. Ты выбираешь своё действие. За день засчитывается одна отметка.</p><small id="reward-preview">'+e(duelReward)+'</small></section>':'')+b('Создать приглашение','create-mode','btn full','link');}
function game(){const g=S.games.find(x=>x.id===detail);if(!g)return head('Игра завершена')+b('В Арену','go:arena');const my=g.participants.find(x=>x.id===S.profile.id),m=g.mode;let title=m==='circle'?'Команда':m==='duel'?'Дуэль недели':'Эстафета';const teamCount=g.participants.filter(p=>S.feed.some(x=>x.circle===g.id&&x.person===p.id&&x.at>=S.server_time-7*86400)).length;
return head(title,m==='duel'?'7 дней · регулярность':'PULSE')+rewardLine(g.reward)+(m==='duel'?muted('Максимум одно очко за день.'): '')+(m==='circle'?'<div class="card"><h3>Цель команды за 7 дней</h3><p class="num">'+teamCount+' / '+g.participants.length+'</p><small>Участники, поделившиеся хотя бы одним действием.</small></div>':'')+g.participants.map(p=>'<div class="card"><div class="between"><div class="person">'+face(p)+'<div><h3>'+e(p.id===S.profile.id?'Ты':p.name||'Друг')+'</h3><small>'+labels[p.kind]+'</small></div></div><b>'+p.days.length+(m==='duel'?' / 7':'')+'</b></div>'+(m==='duel'?'<div class="meter"><i style="width:'+pct(p.days.length,7)+'%"></i></div>':'')+muted(p.days.length?'Отметки · '+p.days.join(' · '):'Пока нет отметок.')+'</div>').join('')+(g.proposed?muted('Предложенное время · '+new Date(g.proposed*1000).toLocaleString('ru-RU')):'')+
(g.token&&g.invite_open?b('Пригласить друга','share:'+g.id,'btn full','link'):'')+(m==='duel'&&g.active&&!my.days.includes(S.day)||m==='relay'&&g.active&&g.host!==S.profile.id&&!my.days.length?b('Выполнить свой ход','play:'+g.id,'btn full','check'):'')+(m==='duel'&&!g.active&&g.starts?b('Предложить реванш','setup:duel','linebtn full','repeat-2'):'')+(m==='circle'?b('Покинуть круг','leave:'+g.id,'linebtn','user'):'');}
function mealsFiltered(){let list=dishes();if(onlyFav){let fav=read('favs')||[];list=list.filter(m=>fav.includes(m.id));}if(qPantry){const terms=pantry.toLowerCase().split(/[,\s]+/).filter(Boolean);if(terms.length)return list.map(m=>[m,terms.filter(t=>m.ing.some(([n])=>n.toLowerCase().includes(t))).length]).filter(x=>x[1]>0).sort((x,y)=>y[1]-x[1]).map(x=>x[0]);}return list.filter(m=>m.type===mt);}
function weekMenu(){
 const cap=S.dna?.goal==='Питание в будни'?Number(S.dna.minutes):parseInt(S.season?.plan?.cooking);
 return dishes().filter(m=>m.type!=='Завтрак'&&(!cap||m.mins<=cap)).sort((a,b)=>S.dna?.budget==='Важна доступная цена'?a.rub-b.rub:S.dna?.budget==='Важнее сэкономить время'?a.mins-b.mins:Number(b.type==='Ужин')-Number(a.type==='Ужин'));
}
function currentDinner(menu=weekMenu()){
 const index=(new Date(S.day+'T12:00:00Z').getUTCDay()+6)%7;
 return menu.find(m=>m.id===read('dinner-id'))||menu[index%menu.length];
}
function food() {
  const list=mealsFiltered(),feature=list[0];
  const tabs='<div class="segmented">'+[['week','Мой рацион'],['recipes','Рецепты'],['cart','Покупки']].map(([k,n])=>b(n,'foodview:'+k,'chip '+(foodView===k?'on':''))).join('')+'</div>';
  const filters='<div class="chips meal-filters">'+['Завтрак','Обед','Ужин'].map(n=>b(n,'mealtype:'+n,'chip '+(mt===n?'on':''))).join('')+'</div>';
  const describe=m=>({art:m.pic,kicker:m.type,title:m.name,note:m.mins+' мин · 1 порция',action:'meal:'+m.id});
  let content;
  if(foodView==='cart') content=basket();
  else if(foodView==='week'){
    if(!read('food-reviewed')&&!S.dna?.limit)content='<h2>Есть продукты, которые ты исключаешь?</h2>'+foodPreferences();
    else{
      const menu=weekMenu(), dinner=currentDinner(menu);
      content=(dinner?hero({...describe(dinner),kicker:'Ужин на сегодня',note:dinner.mins+' мин · '+portions+' порц.'}):muted('Подходящего ужина в каталоге пока нет.'))+
        '<div class="meal-actions">'+b('Изменить блюдо','foodview:recipes','linebtn','repeat-2')+b('Что есть дома?','homefood','linebtn','search')+
        (dinner?b('Готовим вдвоём','pair-meal:'+dinner.id,'linebtn','users'):'')+
        '</div><h2>Меню на неделю</h2>'+muted('Под твои условия подходит блюд: '+menu.length+' из 7. Остальные дни оставлены для своего выбора.')+'<div class="club-menu">'+menu.map((m,i)=>tile(m.pic,m.name,'Ужин '+(i+1)+' · '+m.mins+' мин','meal:'+m.id)).join('')+
        '</div>'+(menu.length?b('Собрать покупки из меню','weekcart','linebtn full','shopping-basket'):'');
    }
  }
  else content=filters+'<div class="food-tools">'+b('По продуктам дома','pantry','textbtn','search')+b(onlyFav?'Все блюда':'Избранное','favfilter','textbtn','bookmark')+'</div>'+
    (qPantry?'<div class="card">'+field('ingredients','Какие продукты есть дома?',pantry,'search','placeholder="Нут, рис, томат"')+b('Найти блюда','match','btn')+'</div>':'')+
    (feature?hero(describe(feature))+list.slice(1).map(m=>row(describe(m))).join(''):muted('Подходящих рецептов пока нет. Можно изменить продукты поиска или собрать меню со специалистом.'));
  return head('Твоё питание','RITM FOOD')+b('Дневник питания','go:journalFood','linebtn full','book-open')+tabs+content+((foodView==='week'&&!read('food-reviewed')&&!S.dna?.limit)?'':b('Предпочтения питания','food-settings','textbtn full'))+(foodView==='week'?spotlight(Catalog.FOOD.pic,'Авторская программа · 28 дней','FOOD 28','Меню, замены и групповой разбор · '+num(Catalog.FOOD.price)+' ₽','product:FOOD','Условия программы')+expertRow('food'):'')+b('Все программы питания','food-offers','linebtn full','book-open')+
    '<p class="safe">Демонстрационные рецепты. Проверь состав и замены с учётом своих ограничений.</p>';
}
function foodPreferences(){
 const p=S.dna||{};
 const select=(key,title,options)=>'<label>'+title+'<select id="pref-'+key+'">'+options.map(x=>'<option'+(p[key]===x?' selected':'')+'>'+e(x)+'</option>').join('')+'</select></label>';
 return select('food','Обычный рацион',['Разнообразную','Без мяса','Растительную'])+
 select('budget','Приоритет',['Важна доступная цена','Важнее сэкономить время'])+
 select('limit','Исключения',['Выбери вариант','Нет исключений','Яйца','Молочные продукты','Пшеница','Орехи',...(p.limit?.startsWith('Свои:')?[p.limit]:[]),'Другие или несколько'])+
 b('Применить к рациону','food-save','btn full');
}
// USDA SR Legacy: FDC ID, edible grams per unit, food description, kcal/protein/fat/carbs per 100 g.
const nutrientFoods={
 "овсяные хлопья": [
  "173904",
  1,
  "сухие хлопья",
  379.0,
  13.15,
  6.52,
  67.7
 ],
 "яблоко": [
  "171688",
  182,
  "яблоко с кожурой",
  52.0,
  0.26,
  0.17,
  13.81
 ],
 "рис готовый": [
  "168878",
  1,
  "готовый белый рис",
  130.0,
  2.69,
  0.28,
  28.17
 ],
 "томат": [
  "170457",
  120,
  "свежий томат",
  18.0,
  0.88,
  0.2,
  3.89
 ],
 "зелень": [
  "170416",
  1,
  "петрушка",
  36.0,
  2.97,
  0.79,
  6.33
 ],
 "огурец": [
  "168409",
  100,
  "огурец с кожурой",
  15.0,
  0.65,
  0.11,
  3.63
 ],
 "нут готовый": [
  "173757",
  1,
  "отварной нут",
  164.0,
  8.86,
  2.59,
  27.42
 ],
 "хлеб": [
  "172688",
  30,
  "цельнозерновой хлеб",
  252.0,
  12.45,
  3.5,
  42.71
 ],
 "яйцо": [
  "171287",
  50,
  "яйцо без скорлупы",
  143.0,
  12.56,
  9.51,
  0.72
 ],
 "авокадо": [
  "171705",
  150,
  "мякоть авокадо",
  160.0,
  2.0,
  14.66,
  8.53
 ],
 "фасоль готовая": [
  "175203",
  1,
  "отварная белая фасоль",
  139.0,
  9.73,
  0.35,
  25.09
 ],
 "паста без яиц": [
  "168927",
  1,
  "сухая пшеничная паста",
  371.0,
  13.04,
  1.51,
  74.67
 ]
};
function nutrition(m){
 const total=[0,0,0,0],sources=[];
 for(const [name,amount,unit] of m.ing){
  if(name==='вода')continue;
  const food=nutrientFoods[name];if(!food)return '';
  const [id,grams,label,...values]=food, weight=amount*(unit==='г'?1:grams)*portions;
  values.forEach((v,i)=>total[i]+=v*weight/100);
  sources.push('<a href="https://fdc.nal.usda.gov/food-details/'+id+'/nutrients" target="_blank" rel="noopener">'+e(label)+'</a> · '+num(weight)+' г');
 }
 const display=i=>num(Math.round(total[i]*10)/10);
 return '<details><summary>Пищевая ценность · около '+Math.round(total[0])+' ккал</summary><p>На выбранные порции · белки '+display(1)+' г, жиры '+display(2)+' г, углеводы '+display(3)+' г.</p><small>Расчёт по USDA SR Legacy для базового рецепта. Съедобная масса ингредиентов в расчёте: '+sources.join(', ')+'. При замене продуктов значения меняются.</small></details>';
}
function portion(){return '<div class="between"><b>Порций</b><div class="amount">'+ib('minus','portions:-1','Уменьшить порции')+'<b>'+portions+'</b>'+ib('plus','portions:1','Увеличить порции')+'</div></div>';}
function meal(){const m=recipe(detail);if(!m||!allows(m))return head('Рецепт недоступен')+muted('Ограничения в DNA исключили это блюдо.');let fav=read('favs')||[];return '<section class="workhero">'+photo(m.pic,m.name)+'<div class="copy">'+label(m.type+' · '+m.mins+' минут')+'<h1>'+e(m.name)+'</h1><div class="row">'+b(fav.includes(m.id)?'В избранном':'В избранное','fav:'+m.id,'linebtn','bookmark')+b('В корзину','cartadd:'+m.id,'linebtn','shopping-basket')+'</div></div></section>'+portion()+nutrition(m)+(m.type!=='Завтрак'?b('Выбрать ужином на сегодня','dinner:'+m.id,'linebtn full'):'')+'<h2>Ингредиенты</h2>'+m.ing.map(([i,q,u])=>'<div class="item"><span>'+e(i)+'</span><b>'+num(q*portions)+' '+e(u)+'</b></div>').join('')+muted('Расчётный бюджет · около '+num(m.rub*portions)+' ₽. Цена зависит от магазина.')+'<h2>Как приготовить</h2><ol class="steps">'+m.steps.map(x=>'<li>'+e(x)+'</li>').join('')+'</ol><div class="card">'+label('Замена продукта')+'<p>'+e(m.swap)+'</p></div>'+b('Отметить приготовление','mealaction:'+m.id,'btn full','check');}
function basket(){let cart=read('cart')||{},items={},rub=0;for(const [id,n] of Object.entries(cart)){const m=recipe(id);if(!m||!allows(m))continue;rub+=m.rub*n;for(const [k,q,u] of m.ing){const k2=k+'|'+u;items[k2]=(items[k2]||0)+q*n;}}return '<h2>Продуктовая корзина</h2>'+(Object.keys(items).length?Object.entries(items).map(([k,n])=>'<div class="item"><span>'+e(k.split('|')[0])+'</span><b>'+num(n)+' '+e(k.split('|')[1])+'</b></div>').join('')+'<div class="card">Ориентир по бюджету <b>'+num(rub)+' ₽</b></div>'+b('Очистить корзину','cartclear','linebtn'):muted('Список пока пуст. Выбери блюдо, и его продукты появятся здесь.')+b('Выбрать рецепт','foodview:recipes','btn full','book-open')+(read('food-reviewed')||S.dna?.limit?weekMenu().length?b('Собрать список из меню','weekcart','linebtn full','shopping-basket'):'':b('Настроить моё меню','foodview:week','linebtn full')));}
function train() {
  const equip=read('equip')||(['Без оборудования','Есть инвентарь'].includes(S.dna?.gear)?S.dna.gear:'Все'), list=Workouts.filter(w=>equip==='Все'||w.gear===equip);
  const places={'Для тебя':null,'Дома':['studio','strength'],'В зале':['strength','studio'],'На улице':['walk']};
  const place=trainingPlace, tracks=list.filter(w=>!places[place]||places[place].includes(w.id));
  const next=tracks.find(w=>w.id==='studio')||tracks[0];
  return head('Тренировки.')+b(S.workouts?.some(w=>w.status==='active')?'Продолжить тренировку':'Дневник тренировок','go:journalTrain','linebtn full','activity')+programs.active()+'<div class="ath-tabs">'+Object.keys(places).map(k=>b(k,'train-place:'+k,'chip '+(place===k?'on':''))).join('')+'</div>'+
    (next?row({art:next.pic,kicker:'Твоё занятие',title:next.title,note:Math.min(next.mins,time)+' мин · '+next.gear,action:'work:'+next.id}):muted('Под это сочетание места и инвентаря занятий пока нет. Измени фильтр ниже.'))+
    '<div class="ath-series"><h2 id="club-series">Авторские программы</h2>'+b('Смотреть все','author-series','textbtn')+'</div>'+programs.resetCover()+
    '<h2 id="club-tracks">Выбери направление</h2><div class="ath-tracks">'+tracks.map(w=>tile(w.id==='walk'?'runner':w.pic,w.theme,'','work:'+w.id)).join('')+'</div>'+
    row({art:Catalog.TRAIN.pic,kicker:'Личное сопровождение',title:'Твой личный тренер',note:'Индивидуальный план и 4 разбора · '+num(Catalog.TRAIN.price)+' ₽ / 28 дней',action:'expert:train'})+
    '<details><summary>Время и оборудование</summary>'+times()+'<div class="rail">'+['Все','Без оборудования','Есть инвентарь'].map(v=>b(v,'gear:'+v,'chip '+(equip===v?'on':''))).join('')+'</div></details>'+
    '<div class="item"><div>'+label('После паузы')+'<h3>Вернуться к плану</h3></div>'+b('5 минут','comeback','linebtn','repeat-2')+'</div>'+
    b('Настроить занятия','context:training','textbtn')+'<h2>История</h2>'+((S.history||[]).filter(a=>a.kind!=='food').slice(0,5).map(a=>'<div class="item"><small>'+e(a.day)+'</small><b>'+
    (a.workout?e(work(a.workout).title):labels[a.kind])+' · '+a.minutes+' мин'+(a.workout&&a.workout!=='walk'?' · '+a.sets+' × '+a.reps:'')+'</b></div>').join('')||muted('Здесь появятся записанные занятия.'));
}
function workout(){const w=work(detail);return '<section class="workhero mono">'+photo(w.pic,w.title)+'<div class="copy">'+label(w.theme+' · '+w.gear)+'<h1>'+e(w.title)+'</h1>'+muted(w.cue)+'</div></section><h2>План занятия</h2><ol class="steps">'+w.steps.map(x=>'<li>'+e(x)+'</li>').join('')+'</ol><div class="card">'+label('Таймер · выбранный отрезок')+'<div id="timer" class="timer">'+timeText()+'</div><div class="row">'+b(activeSet?'Пауза':'Старт','timer','btn',activeSet?'pause':'play')+b('Сбросить','timerreset','linebtn')+'</div></div>'+(w.id==='walk'?'':'<div class="grid">'+field('sets','Подходов',sets,'number','min="1" max="50"')+field('reps','Повторений',reps,'number','min="1" max="300"')+'</div>')+b('Открыть дневник подходов','go:journalTrain','btn full','activity')+b('Записать занятие','workdone:'+w.id,'btn full','check')+b('Техника и варианты','tech:'+w.id,'linebtn full','circle-play')+muted('Демонстрационный блок. Интенсивность и технику сверяй со своим тренером.');}
const timeText=()=>String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
function experts() {
  return head('Твои эксперты','RITM EXPERT')+'<div class="author-list">'+Object.entries(Experts).map(([key,x])=>
    '<button class="author" data-a="expert:'+key+'">'+photo(x.photo,'Иллюстративный портрет')+'<span>'+label('Направление')+'<strong>'+x.label+'</strong><small>'+x.area+'</small></span>'+I('arrow-up-right',17)+'</button>').join('')+'</div>'+
    muted('Портреты иллюстративные. Специалисты подтвердят участие и условия консультаций перед запуском.')+(demo?b('Рабочий кабинет · демо','go:league-desk','linebtn full','users'):'');
}
function expert(){const x=Experts[detail]||Experts.train;return '<section class="workhero">'+photo(x.photo,'Иллюстративный портрет')+'<div class="copy">'+label('Экспертное направление')+'<h1>'+x.label+'</h1><p>'+x.desc+'</p></div></section>'+muted('Имя, квалификация, опыт, дата консультации и стоимость будут опубликованы после подтверждения специалистом.')+'<h2>Как проходит ведение</h2><ul>'+Catalog[x.product].content.map(t=>'<li>'+e(t)+'</li>').join('')+'</ul><h2>Попробовать бесплатно</h2>'+b(detail==='food'?'Открыть рецепты':'Открыть домашнее занятие',detail==='food'?'expert-recipes':'work:studio','linebtn full')+'<h2>Программы специалиста</h2>'+b(detail==='food'?'FOOD 28':'RESET LEAGUE',detail==='food'?'product:FOOD':'product:RESET','linebtn full')+b(Catalog[x.product].title+' · '+num(Catalog[x.product].price)+' ₽ за 28 дней','product:'+x.product,'btn full','book-open')+b(S.interest.includes(detail+':consult')?'Интерес сохранён':'Оставить интерес к консультации','interest:'+detail+':consult','linebtn full');}
const personalOffer = sku => sku === 'TRAIN' || sku === 'NUTRI';
const seatActive=()=>S.booking?.sku==='RESET'&&S.booking.paid_kopeks>S.booking.refunded_kopeks;
function bookingView(k) {
  const order=S.booking;
  if(!order){
    const title=demo?(personalOffer(k)?'Оформить в демо':'Выбрать в демо'):'Оставить заявку';
    return b(title,'book:'+k,'btn full','arrow-right');
  }
  if(order.sku!==k)return muted('У тебя уже есть заявка на «'+(Catalog[order.sku]?.title||order.sku)+'».')+b('Посмотреть свою заявку','product:'+order.sku,'linebtn full');
  const {paid_kopeks:paid,refunded_kopeks:refunded}=order;
  const status=refunded?(refunded===paid?'Возвращена вся сумма':'Частичный возврат'):paid?'Оплата подтверждена':'Ожидает оплаты';
  const receipt='<section class="order-state" tabindex="-1" aria-live="polite">'+label('Твоя заявка · '+order.ref)+'<h2>'+status+'</h2>'+
    (paid?'<p>Оплачено '+num(paid/100)+' ₽'+(refunded?' · возвращено '+num(refunded/100)+' ₽':'')+'</p>':'')+'</section>';
  if(!demo)return receipt+(order.checkout&&!paid?'<a class="btn full" href="'+e(order.checkout)+'" rel="noreferrer" target="_blank">Перейти к оплате у организатора</a>':'');
  if(k!=='RESET'&&!personalOffer(k))return receipt;
  if(!paid)return receipt+b('Подтвердить учебную оплату','receipt:paid','btn full','check');
  if(paid<=refunded)return receipt;
  const next=personalOffer(k)
    ? (k==='NUTRI' ? b('Открыть моё питание','go:food','btn full','utensils') : b('Открыть дневник тренировок','go:train','btn full','dumbbell'))
    : b('Открыть мой сезон','go:league-support','btn full','arrow-right');
  return receipt+next+b('Оформить учебный возврат','refund-review','textbtn full');
}
function product(){
  const k=Object.hasOwn(Catalog,detail)?detail:'RESET',x=Catalog[k],league=k==='RESET';
  const amount=S.booking?.sku===k?S.booking.price:x.price;
  if(personalOffer(k)){
    return head(x.title,'Индивидуальное сопровождение')+
      '<div class="offer-price"><strong>'+num(amount)+' ₽</strong><small>За 28 дней · один человек · разовая оплата</small></div>'+
      '<p class="program-note">'+(k==='NUTRI'?'Работа один на один. Твой дневник разбирает нутрициолог.':'Тренер ведёт тебя лично.')+' Можно начать без подписки PLUS.</p>'+
      '<h2>Как вы работаете</h2><dl class="offer-includes">'+['Знакомство','Программа','Обратная связь'].map((title,i)=>
        '<div><dt>'+e(title)+'</dt><dd>'+e(x.content[i])+'</dd></div>').join('')+'</dl>'+
      muted('Тестовая цена. Условия и дату старта предстоит согласовать со специалистом.'+(demo?' В демо деньги не списываются.':''))+bookingView(k);
  }
  const heroCopy=league?'Питание и тренировки с двумя специалистами':x.title;
  const art='<section class="workhero offer-hero">'+photo(x.pic,'')+'<div class="copy">'+label(league?'Season 01 · до 10 участников':'Авторский сезон')+'<h1>'+(league?'RESET LEAGUE':k+' 28')+'</h1><p>'+e(heroCopy)+'</p></div></section>';
  const service=[
    ['Твой план на старте','Тренер и нутрициолог учитывают твою цель, расписание, оборудование и время на готовку.'],
    ['Питание и тренировки','Меню, рецепты и замены продуктов. План занятий с пояснениями по технике.'],
    ['Раз в неделю','Разбор того, что получилось. Если неделя изменилась, попроси специалиста заменить ужин или занятие.'],
    ['Команда и итог','Поддержка группы и совместные задания по желанию. На финише — личный отчёт и выбор следующей цели.']
  ];
  return art+'<div class="offer-price"><strong>'+num(amount)+' ₽</strong><small>28 дней · '+(k==='DUO'?'за двоих':'за человека')+' · разовая оплата</small></div>'+
    (demo?muted('Демо на этом устройстве. Деньги не списываются.'):'')+bookingView(k)+
    (league?'<h2>С чем помогут</h2><dl class="offer-includes">'+service.map(([t,s])=>'<div><dt>'+t+'</dt><dd>'+s+'</dd></div>').join('')+'</dl>':x.content.map(v=>'<div class="item">'+I('check')+'<b>'+e(v)+'</b></div>').join(''))+
    (league?muted('Предлагаемый состав сезона. Дату, специалистов, объём обратной связи и условия возврата организатор подтвердит до продажи.'):'');
}

function profile() {
  const hist=S.history||[];
  const links=[['journalStats','Мой прогресс','activity'],['journalTrain','Дневник тренировок','book-open'],['journalFood','Дневник питания','book-open'],['dna-map','Мои предпочтения','target'],['checkin','Личные замеры и сверка','chart-no-axes-column'],['recap','Отчёт RITM RECAP','share-2'],
    ['seasonplan','Персональный план','list-checks'],['experts','Мои специалисты','users'],['store','Сезоны и программы','book-open'],['settings','Настройки и доступ','settings']];
  if(demo)links.unshift(['season-story','Твоя история сезонов','trophy']);
  if(demo&&seatActive())links.unshift(['league-support','Мой RESET LEAGUE','users']);
  return head(S.profile.name||'Мой профиль','RITM PROFILE')+'<div class="profile-plan">'+RitmHome.summary(S,homeHelpers())+'</div>'+
    '<div class="stat-pair">'+[['Тренировки',hist.filter(x=>x.kind==='move').length],['Дни питания',new Set(hist.filter(x=>x.kind==='food').map(x=>x.day)).size]].map(([k,n])=>'<div>'+label(k)+'<strong>'+n+'</strong><small>За последние 8 недель</small></div>').join('')+'</div>'+
    (personalOffer(S.booking?.sku)?b('Моя заявка · '+Catalog[S.booking.sku].title.toLowerCase(),'product:'+S.booking.sku,'linebtn full',S.booking.sku==='TRAIN'?'dumbbell':'utensils'):'')+
    (S.season?muted('Твой сезон · день '+S.season.day+' из 28'):'')+'<div class="profile-links">'+links.map(([k,t,i])=>'<button class="choice" data-a="go:'+k+'"><span class="person">'+I(i,19)+t+'</span>'+I('chevron-right',16)+'</button>').join('')+'</div>';
}
function recap() {
  const w=RitmHome.week(S,weekly), contacts=new Set((S.feed||[]).filter(a=>a.person!==S.profile.id&&a.to_me&&a.at>=S.server_time-604800).map(x=>x.person)).size;
  return head('Неделя в движении','RITM RECAP')+'<div class="recap-art"><span class="wordmark">ritm.</span><div class="metric"><div class="big">'+w.percent+'<em>%</em></div>'+RitmHome.ring(w.percent)+'</div><p>'+e(w.caption)+'</p></div>'+
    muted('Ответы от друзей за 7 дней · '+contacts+'. В общей карточке виден только итог твоего плана.')+
    b('Поделиться карточкой','share-recap','btn full','share-2')+b('Скачать PNG','download-recap','textbtn full');
}
function settingsView(){const n=read('notifs')||{};return head('Настройки')+field('nickname','Имя в круге',S.profile.name,'text','maxlength="30"')+b('Сохранить имя','rename','linebtn')+'<h2>Уведомления</h2>'+[['pulse','Новый импульс и ответ'],['duel','Дуэли'],['season','Экспертный сезон'],['report','Отчёт недели']].map(([k,v])=>'<label class="checks"><input type="checkbox" data-pref="'+k+'" '+(n[k]!==false?'checked':'')+'>'+v+'</label>').join('')+'<p class="hint">Настройки ленты на этом устройстве. Системные push для PULSE требуют отдельного согласия.</p>'+(demo?muted('На GitHub Pages работает демо на этом устройстве. Серверные уведомления и восстановление доступны в полной версии.'):'<div class="row">'+b('Включить push','pushon','linebtn')+b('Отключить push','pushoff','linebtn')+'</div><h2>Доступ к профилю</h2>'+b('Получить одноразовый код','getcode','linebtn')+(code?'<p class="safe">'+e(code)+'</p>':'')+field('recovery','Код восстановления','','password','autocomplete="off"')+b('Восстановить','restore','linebtn'))+hapticSetting()+b('Приватность действий','go:privacy','choice')+(demo?b('Сбросить демонстрацию','resetask','choice','rotate-ccw'):'');}
function notificationsView(){const pref=read('notifs')||{},notes=pref.pulse!==false?choice.noticeRows():[];if(pref.pulse!==false)(S.feed||[]).filter(x=>x.person!==S.profile.id).slice(0,4).forEach(x=>notes.push([x.to_me?'Друг ответил своим делом':'Друг уже в движении',(x.name||'Друг')+' · '+labels[x.kind],'pulse']));if(pref.duel!==false&&S.games.some(g=>g.mode==='duel'&&g.active))notes.push(['Дуэль началась','Открой счёт и историю своих дней.','arena']);if(pref.report!==false&&weekly().total)notes.push(['Доступен RITM RECAP','Посмотри, какие дела вошли в неделю.','recap']);if(pref.season!==false&&demo)notes.push(['Сезоны открыты для просмотра','Демонстрационная витрина FOOD, RESET и DUO.','store']);return head('Уведомления')+(notes.length?notes.map(([t,m,k])=>'<button class="choice" data-a="'+e(k.startsWith('choice-open:')?k:'go:'+k)+'"><span>'+e(t)+'<br><small>'+e(m)+'</small></span>'+I('chevron-right')+'</button>').join(''):muted('Пока новых событий нет.'))+b('Настроить','go:settings','linebtn');}
function renderMisc(){switch(view){
 case 'recover':return head('Восстановить профиль')+muted('Введи одноразовый код, сохранённый в настройках профиля.')+field('recovery','Код восстановления','','password','autocomplete="off"')+b('Восстановить','restore','btn full')+b('Назад','back','textbtn full');
 case 'settings':return settingsView();case 'notifications':return notificationsView();
 case 'checkin':if(!S.season)return head('Личные измерения')+muted('Сначала выбери цель сезона. Измерения добровольные и видны только тебе.')+b('Настроить сезон','go:seasonplan');else{const z=S.season,w=Math.min(4,Math.floor((z.elapsed+1)/7));return head('Личная сверка','Твой прогресс')+muted(z.metric)+'<div class="card"><p>В начале · '+e(z.baseline??'Пропущено')+'</p><p>Цель · '+e(z.target??'Не задана')+'</p></div>'+z.checkins.map(x=>'<p>Неделя '+x.week+' · '+e(x.actual??'Без замера')+' · удобство '+x.ease+'/5</p>').join('')+(w?field('value','Результат, по желанию','','number','min="0" max="'+z.max+'"')+field('ease','Удобство плана, от 1 до 5',3,'number','min="1" max="5"')+b('Сохранить неделю '+w,'check:'+w):muted('Первая сверка откроется на седьмой день.'));}
 case 'seasonplan':{const d=S.dna||{};return head('Персональный план')+muted(S.season?'День '+S.season.day+' из 28. Цель и исходная точка закреплены за сезоном.':d.goal||'Выбери условия личного сезона.')+field('days','Дней плана в неделю',S.season?.plan.days||5,'number','min="2" max="7"')+(S.season?'':field('base','Исходный показатель, добровольно','','number','min="0"')+field('comp','Для силы — упражнение и нагрузка','','text','maxlength="100"'))+field('target','Целевой показатель, добровольно',S.season?.target??'','number','min="0"')+'<p class="hint">'+e(S.season?.metric||((d.goal==='Стать сильнее')?'Повторения одного упражнения при одинаковой нагрузке':(d.goal==='Питание в будни'?'Будни с запланированной едой из пяти':'Активные дни из семи')))+'</p>'+b('Сохранить план','startseason','btn full')+b('Тренировки моего плана','go:train','linebtn');}
 case 'privacy':return head('Приватность')+muted('Цели, ограничения и замеры личные. Вид действия открывается кругу при твоём согласии. Скрыть опубликованное дело можно и позже.')+(S.history||S.actions).filter(x=>x.shared).map(x=>'<div class="item">'+e(labels[x.kind])+' · '+new Date(x.at*1000).toLocaleDateString('ru-RU')+b('Скрыть','hide:'+x.id,'linebtn','eye-off')+'</div>').join('')+b('Управление кругом','go:pulse','linebtn');
 case 'share':{const g=S.games.find(x=>x.id===detail);if(!g?.token)return head('Приглашение закрыто');let url=demo?window.ritmDemo.openFriend(g.token):new URL('?invite='+encodeURIComponent(g.token),location.href).href;return head('Приглашение другу','PULSE')+rewardLine(g.reward)+muted(demo?'В этой демоверсии открой приглашение за второго участника на том же устройстве.':'Ссылка действует сутки и открывает гостевой вход.')+field('inviteurl','Ссылка',url,'text','readonly')+(demo?b('Открыть за друга','asguest','btn full','users'):b('Поделиться приглашением','sharelink','btn full','send'));}
 case 'invite':return head('Тебе передали приглашение','Гостевой вход')+(guestInfo?.open?muted((guestInfo.name||'Друг')+' приглашает в игру. Выбери своё дело.')+rewardLine(guestInfo.reward)+'<div class="chips">'+Object.entries(labels).map(([k,v])=>b(v,'gamekind:'+k,'chip '+(gameKind===k?'on':''))).join('')+'</div>'+b('Принять и войти','join','btn full')+b('Пропустить','decline','linebtn'):muted(guestInfo?.member?'Ты уже участвуешь.':'Ссылка закрыта или места заняты.')+b('Открыть мой день','finishinvite','btn'));
 case 'invitation':return head('Вход по приглашению')+field('invtext','Ссылка или код приглашения','','text','placeholder="Вставь ссылку друга"')+b('Открыть','readinvite')+b('Назад','back','textbtn');
 case 'tech':return head('Техника и варианты','RITM TRAIN')+photo(work(detail).pic,'Иллюстрация тренировочной среды','tech-art')+'<div class="card"><h3>'+e(work(detail).title)+'</h3><p>'+e(work(detail).cue)+'</p></div>'+muted('Учебное видео и индивидуальную адаптацию добавит тренер после проверки. Пока используй свою знакомую программу.')+b('Другой блок','go:train','linebtn')+b('Направление тренера','expert:train','linebtn');
 case 'ai':return head('Подстроить план','RITM AI · деморежим')+muted('Подбор по правилам из демонстрационного каталога. Объяснение появится при выборе.')+[['10 минут','timehelp'],['Сегодня не могу тренироваться','rest'],['Что есть дома?','homefood'],['Вернуться после паузы','comeback'],['Заменить упражнение','alttrain']].map(([t,k])=>b(t,k,'choice','sparkles')).join('')+b('Интерес к премиальному AI','interest:ai:plus','linebtn');
 case 'confirm':return head(confirm==='reset'?'Сбросить демо?':'Выйти из круга?')+muted(confirm==='reset'?'Удалятся демонстрационные отметки и заявки на этом устройстве.':'Друзья перестанут видеть твои действия в этом круге.')+b('Подтвердить','confirmed','btn')+b('Отмена','back','linebtn');
 case 'name':return head('Как тебя называть?','Профиль')+field('startname','Твоё имя',S.profile.name,'text','maxlength="30" autocomplete="given-name"')+b('Продолжить','named','btn full')+b('Назад','back','textbtn full');
 default:return head('Твой день')+b('На главную','go:today');
 }}
const journals=createJournal({state:()=>S,write,route,draw,e,b,field,head,muted,read,save,nonce,notice});
const screens={journalTrain:journals.train,journalFood:journals.food,journalStats:journals.stats,choice:()=>choice.detail(detail),'choice-compose':choice.composer,today,food,pulse,arena,profile,intro,dna,'dna-map':dnaMap,action:actionScreen,setup,game,meal,train,work:workout,experts,expert,store:programs.list,plus:programs.plus,solo:()=>programs.detail(detail),product,recap};
const lifecycle=demo?createRitmLifecycle({read,save,route,draw,b,e,I,label,muted,head,num,price:Catalog.RESET.price,participantName:()=>S.profile.name||'Участник',hasSeat:seatActive,renewal:()=>S.demo_renewal}):null;
if(lifecycle)Object.assign(screens,{'season-story':lifecycle.journey,'next-season':lifecycle.offer,'league-desk':lifecycle.desk,'league-review':()=>lifecycle.review(detail),'league-support':lifecycle.support});
let lastPulseSource='',offerObserver;
function draw(){if(!S)return;
 if(offlineJournal){document.body.dataset.screen='journalTrain';$('#head').textContent='ritm. · Дневник без сети';$('#nav').innerHTML='';$('#content').innerHTML=journals.train();return;}const root=['today','train','pulse','food','store'],ballot=view==='choice'&&choice.isBallot(detail)&&stack.length===0,first=ballot||['intro','name','dna','invite','invitation','recover'].includes(view);
 document.body.classList.toggle('home-active',view==='today');
 document.body.dataset.screen=view;
 document.body.classList.toggle('choice-ballot',ballot);
 $('#head').innerHTML=first?'<div class="home-brand"><span class="home-wordmark">ritm.</span>'+(demo?'<span class="home-demo">Premium Athletic</span>':'')+'</div>'+(ballot?label('PULSE / CHOICE'):''):RitmHome.header(S,homeHelpers());
 $('#content').innerHTML='<div class="screen">'+(!root.includes(view)&&!first?b('Назад','back','back','arrow-left'):'')+(screens[view]?screens[view]():renderMisc())+'</div>';
 $('#nav').innerHTML=first?'':navs.map(([id,n,icon])=>'<button data-a="go:'+id+'" class="'+(activeTab()===id?'active ':'')+(id==='pulse'?'pulse-nav':'')+'" '+(activeTab()===id?'aria-current="page"':'')+'>'+I(icon)+'<span>'+n+'</span></button>').join('');
 if(view==='store'&&'IntersectionObserver' in window){
   const firstOffer=document.querySelector('.catalog-item[data-a^="product:"]');
   if(firstOffer){offerObserver?.disconnect();offerObserver=new IntersectionObserver(([entry])=>{
     if(entry.isIntersecting){expose('offers');offerObserver.disconnect();}
   });offerObserver.observe(firstOffer);}
 }else offerObserver?.disconnect();
 if(view==='today'||view==='pulse'){const id=incoming()?.source;if(id&&id!==lastPulseSource)document.querySelector('.home-pulse')?.classList.add('pulse-arrived');lastPulseSource=id||'';}
 document.title='ritm. · '+(navs.find(x=>x[0]===view)?.[1]||'Твой ритм');
}
function readQuestionnaire(){
 try{
   const value=JSON.parse(sessionStorage.getItem(key('onboarding')));
   return Number.isInteger(value?.step)&&(value.mode==='quick'?quickQuestions:DnaSteps)[value.step]&&value.draft?value:null;
 }catch{return null;}
}
function finishOnboarding(){save('entered',true);stack=[];route('today','',false);}
function clearInvite(){pendingGuest=null;guestInfo=null;const u=new URL(location.href);u.searchParams.delete('invite');history.replaceState(null,'',u);}
async function seasonSave(){const existing=S.season,d=S.dna||{},plan=existing?{...existing.plan}:{focus:d.goal||'Регулярность тренировок',duration:Number(d.minutes)||20,place:d.place||'Дома',equipment:d.gear||'Без оборудования',adaptation:'Подойдёт привычная нагрузка',food_for:'Для себя',cooking:'15 минут',budget:d.budget||'Важна доступная цена'};plan.days=Number($('#days').value);let v=id=>$(id)?.value?Number($(id).value):null;
await write('season',{plan,comparison:existing?existing.comparison:($('#comp')?.value||''),baseline:existing?existing.baseline:v('#base'),target:v('#target')});save('days',plan.days);notice('Условия сезона сохранены.');route('profile');}
async function handle(id){const [cmd,...args]=id.split(':'),v=args.join(':');if(cmd!=='time')document.getElementById('home-sheet')?.close();if(!['complete','time','short','kind','workdone'].includes(cmd))pendingWorkout=null;if(cmd.startsWith('jr-'))return journals.act(cmd,v);if(cmd.startsWith('choice-'))return choice.handle(cmd,v,detail);if(lifecycle&&cmd.startsWith('life-'))return lifecycle.handle(cmd,v);switch(cmd){
 case 'go':if(v==='store'&&view!=='store')programs.filter('reset');if(view==='choice'||view==='choice-compose')choice.clearAddress();if(v==='today'&&view==='intro')save('entered',true);route(v);if(v==='pulse')heartbeat();break;
 case 'sheetclose':document.getElementById('home-sheet')?.close();break;
 case 'quicktime':showHomeTime();break;
 case 'homeplan':showHomePlan();break;
 case 'homeinvite':{
   const available=S.games.find(g=>g.mode==='circle'&&g.token&&g.invite_open);
   const id=available?.id||(await write('create',{mode:'circle',kind:'move'})).game;
   route('share',id);break;
 }
 case 'homeperson':{
   const member=RitmHome.people(S).find(p=>p.person===v);
   if(!member){notice('Участник вышел из круга.');break;}
   const action=member.source?'Последнее дело · '+labels[member.kind]+' · '+RitmHome.relative(member.at,S.server_time):'Пока нет новых дел, открытых кругу.';
   homeSheet(member.name||'Участник',muted(action)+'<div class="sheet-links">'+(member.source&&!member.answered?b('Ответить своим делом','memberreply:'+member.person,'','zap'):'')+b('Открыть круг','game:'+member.game,'','users')+'</div>');break;
 }
 case 'quick-minutes':case 'quick-place':{
   const k=cmd==='quick-minutes'?'minutes':'place';
   if(!quickQuestions.find(q=>q[0]===k)[2].includes(v))break;
   if(view!=='dna'){draft={...S.dna};formMode='quick';step=0;}
   draft[k]=v;if(view==='dna')draw();else route('dna');break;}
 case 'quick-plan':
   if(!draft.goal||!draft.minutes||(draft.goal!=='Питание в будни'&&!draft.place))break;
   step=quickQuestions.length-1;await finishPersonalPlan();break;
 case 'start-goal':
   if(!quickQuestions[0][2].includes(v))break;
   expose('start');draft={...(view==='dna'?draft:S.dna),goal:v};formMode='quick';step=0;if(view==='dna')draw();else route('dna');break;
 case 'back':back();break;case 'start':expose('start');draft={...S.dna};formMode='quick';step=0;route('dna');break;
 case 'named':{const name=$('#startname').value.trim();if(!name)throw Error('Введи имя для друзей.');await write('profile',{name,goal:S.profile.goal||'Регулярное движение',barrier:S.profile.barrier||'Мало времени',program:S.profile.program||'Своя программа'});draft={...S.dna};formMode='quick';step=0;route('dna');break;}
 case 'editdna':{
   const saved=readQuestionnaire();
   formMode=saved?(saved.mode||'full'):'full';step=saved?.step||0;draft={...(saved?.draft||S.dna)};
   if(draft.limit?.startsWith('Свои: ')){draft.custom=draft.limit.slice(6);draft.limit='Указать свои';}
   route('dna');break;
 }
 case 'dna-later':sessionStorage.setItem(key('onboarding'),JSON.stringify({step,mode:formMode,draft,paused:true}));save('entered',true);route('today');notice('К анкете можно вернуться из профиля.');break;case 'dnaopt':draft[questions()[step][0]]=v;draw();break;case 'dnaback':step=Math.max(0,step-1);draw();break;
 case 'dnaskip':delete draft[questions()[step][0]];delete draft.custom;step++;draw();break;
 case 'dnanext':{let k=questions()[step][0];if(!draft[k]&&!questions()[step][3])throw Error('Выбери подходящий ответ.');if(k==='limit'&&draft[k]==='Указать свои'){let cust=$('#customLimit')?.value.trim();if(!cust)throw Error('Введи продукты или пропусти вопрос.');draft.limit='Свои: '+cust.slice(0,110);}
 if(step<questions().length-1){step++;draw();}else{await finishPersonalPlan();}break;}
 case 'demo-start':if(demo){await seed();finishOnboarding();}break;case 'open-demo':location.assign('https://sandovich.github.io/ritm-pulse/athletic/meeting/');break;
 case 'demomenu':if(!demo)break;document.body.classList.remove('home-active');document.body.dataset.screen='demo';$('#content').innerHTML=head('Демонстрационный режим')+muted('Два тестовых профиля хранятся в этом браузере. Заполненный пример показывает учебную неделю. Данные независимы от серверного пилота.')+b('Подготовить пример и открыть Сегодня','demo-start','choice','play')+b('Переключить участника','switchdemo','choice','users')+b('Пройти подбор заново','go:intro','choice')+b('Сбросить демонстрацию','resetask','choice','rotate-ccw')+b('Назад','redraw','linebtn');break;
 case 'redraw':draw();break;case 'switchdemo':location.assign(window.ritmDemo.openFriend());break;
 case 'time':time=Number(v);save('available',{day:S.day,minutes:time});draw();const sheet=document.getElementById('home-sheet');if(sheet?.open){if(sheet.dataset.picker==='quick'){sheet.close();document.querySelector('[data-a=quicktime]')?.focus();}else showHomePlan();}break;case 'timehelp':time=10;taskKind='move';route('action');notice('Выбран короткий блок на 10 минут.');break;
 case 'rest':taskKind='food';privateAction=true;route('food');notice('Сегодня можно выбрать дело по питанию.');break;
 case 'context':{
  const keys=v==='training'?['place','gear','level']:['team','motivation'];
  const fields=DnaSteps.filter(([k])=>keys.includes(k)).map(([k,title,opts])=>'<label>'+e(title)+'<select data-preference="'+k+'"><option value="">Выбери вариант</option>'+opts.map(x=>'<option '+(S.dna?.[k]===x?'selected':'')+'>'+e(x)+'</option>').join('')+'</select></label>').join('');
  homeSheet(v==='training'?'Условия занятий':'Поддержка друзей',fields+b('Сохранить','context-save','btn full'));break;}
 case 'context-save':{
  const fields=document.querySelectorAll('dialog[open] [data-preference]'),data={...S.dna};
  for(const field of fields)if(field.value)data[field.dataset.preference]=field.value;
  await write('dna',{data});if([...fields].some(f=>f.dataset.preference==='gear'&&f.value))save('equip',['Без оборудования','Есть инвентарь'].includes(data.gear)?data.gear:'Все');
  document.querySelector('dialog[open]')?.close();draw();break;}
 case 'train-place':trainingPlace=v;draw();break;
 case 'author-series':programs.filter('reset');programs.filter('format','Авторские программы');route('store');break;
 case 'catalog-quick':programs.filter('reset');if(v==='Бесплатные')programs.filter('price','Бесплатно');else if(v!=='Все')programs.filter('format',v);draw();break;
 case 'food-offers':programs.filter('reset');programs.filter('goal','Питание');route('store');break;
 case 'food-settings':homeSheet('Предпочтения питания',foodPreferences());break;
 case 'food-save':{
  const host=document.querySelector('dialog[open]')||document, limit=host.querySelector('#pref-limit').value;
  if(limit==='Выбери вариант')throw Error('Выбери вариант в поле исключений.');
  const data={...S.dna,food:host.querySelector('#pref-food').value,budget:host.querySelector('#pref-budget').value};
  if(limit==='Нет исключений')delete data.limit;else data.limit=limit==='Другие или несколько'?'Свои: требуется согласование':limit;
  await write('dna',{data});save('food-reviewed',true);document.querySelector('#home-sheet')?.close();draw();break;}
 case 'pair-meal':portions=2;route('meal',v);break;
 case 'dinner':save('dinner-id',v);foodView='week';route('food');break;
 case 'homefood':qPantry=true;foodView='recipes';route('food');break;case 'alttrain':route('train');notice('Выбери знакомый вариант под своё оборудование.');break;
 case 'comeback':time=5;taskKind='walk';activeGame='';reply=null;route('action');notice('Начни с доступного действия на пять минут.');break;
 case 'action':activeGame='';reply=null;taskKind=v||'move';privateAction=true;route('action');break;
 case 'pulse-reply':if(incoming())return handle('respond');homeSheet('Ответы друзей',muted('Когда кто-то из твоего круга поделится делом, здесь можно будет ответить своим.')+b('Пригласить друга в круг','homeinvite','linebtn full','users'));break;
 case 'memberreply':case 'respond':{const i=cmd==='memberreply'?RitmHome.people(S).find(p=>p.person===v&&p.source&&!p.answered):incoming();if(!i)throw Error('Открытых импульсов пока нет.');reply={source:i.source,game:i.game};activeGame='';privateAction=false;taskKind=(S.dna?.goal==='Питание в будни')?'food':'move';route('action');break;}
 case 'kind':if(taskKind!==v)pendingWorkout=null;taskKind=v;draw();break;case 'short':time=5;draw();notice('Выбрана короткая версия.');break;
 case 'complete':{const isAnswer=Boolean(reply);if(!S.profile.goal&&!S.games.length&&!programs.current()&&!personalOffer(S.booking?.sku)){route('name');notice('Сначала сохрани профиль или прими приглашение.');break;}
 if(taskKind==='food'&&!allows(recipe(recipeChoice)))throw Error('Выбери блюдо с подходящим составом.');
 const visibility=($('#visible')?.checked||reply)?'circle':'private';const out=await write('done',{kind:taskKind,minutes:time,task:taskKind==='food'?recipe(recipeChoice).name:taskKind,visibility,...(pendingWorkout?{training:pendingWorkout}:{}),variant:time<=5?'alternative':'original',...(reply||{}),...(activeGame?{game:activeGame}:{})});
 pendingWorkout=null;reply=null;activeGame='';privateAction=true;save('entered',true);route('today');if(isAnswer){document.querySelector('.home-pulse')?.classList.add('pulse-sent');heartbeat();}notice('Действие сохранено.');break;}
 case 'setup':arenaMode=v;route('setup');break;case 'together':arenaMode='together';route('setup');break;case 'gamekind':gameKind=v;draw();break;
 case 'create-mode':{let mode={team:'circle',week:'duel',together:'circle'}[arenaMode]||arenaMode;let slot=$('#slot')?.value;const res=await write('create',{mode,kind:gameKind,proposed:slot?Math.floor(new Date(slot).getTime()/1000):null,...(arenaMode==='duel'&&duelReward.trim()?{reward:duelReward.trim()}:{})});if(arenaMode==='duel')duelReward='';route('share',res.game);break;}
 case 'create':{const r=await write('create',{mode:v,kind:'move'});route('share',r.game);break;}
 case 'game':case 'circle':route('game',v);break;case 'play':{const g=S.games.find(x=>x.id===v);taskKind=g.participants.find(x=>x.id===S.profile.id).kind;reply=null;activeGame=v;privateAction=true;route('action');break;}
 case 'share':route('share',v);break;case 'asguest':location.assign($('#inviteurl').value);break;
 case 'sharelink':await shareText('RITM · приглашение',$('#inviteurl').value);break;case 'invitation':route('invitation');break;
 case 'readinvite':{let t=$('#invtext').value.trim();if(t.includes('://')){const query=new URL(t).searchParams;if(query.has('choice')){await choice.initialize(query);break;}t=query.get('invite');}if(!t)throw Error('Нужен код приглашения.');pendingGuest=t;guestInfo=await api('/api/invite?token='+encodeURIComponent(t));route('invite');break;}
 case 'join':await write('join',{token:pendingGuest,kind:gameKind});clearInvite();finishOnboarding();route('arena');notice('Ты в игре.');break;
 case 'decline':await write('decline',{token:pendingGuest});clearInvite();finishOnboarding();break;case 'finishinvite':clearInvite();finishOnboarding();break;
 case 'cheer':{const x=S.feed.find(y=>y.circle===args[0]&&y.action===args[1]);await write('cheer',{circle:x.circle,action:x.action,on:!x.cheered});draw();break;}
 case 'leave':confirm=v;route('confirm');break;case 'resetask':confirm='reset';route('confirm');break;
 case 'confirmed':if(confirm==='reset'){await window.ritmDemo.reset();return;}await write('leave',{game:confirm});route('pulse');break;
 case 'mealtype':mt=v;foodView='recipes';draw();break;case 'foodview':foodView=v;draw();break;case 'pantry':qPantry=!qPantry;draw();break;
 case 'match':pantry=$('#ingredients').value.trim();draw();break;case 'favfilter':onlyFav=!onlyFav;draw();break;
 case 'meal':route('meal',v);break;case 'portions':portions=Math.min(8,Math.max(1,portions+Number(v)));draw();break;
 case 'fav':{let f=read('favs')||[];save('favs',f.includes(v)?f.filter(x=>x!==v):[...f,v]);draw();break;}
 case 'cartadd':{let cart=read('cart')||{};cart[v]=(cart[v]||0)+portions;save('cart',cart);notice('Ингредиенты добавлены в корзину.');break;}
 case 'weekcart':{let cart=read('cart')||{};for(const m of weekMenu())cart[m.id]=(cart[m.id]||0)+portions;save('cart',cart);foodView='cart';draw();break;}case 'cartclear':homeSheet('Очистить список покупок?',b('Очистить список','cart-empty','btn full')+b('Оставить продукты','sheetclose','textbtn full'));break;case 'cart-empty':save('cart',{});document.querySelector('#home-sheet')?.close();draw();break;
 case 'mealaction':reply=null;privateAction=true;recipeChoice=v;taskKind='food';activeGame='';route('action');break;
 case 'gear':save('equip',v);draw();break;case 'work':if(trainingKey!==v||(!activeSet&&timerBudget!==Math.min(time,work(v).mins))){stopTimer();left=Math.min(time,work(v).mins)*60;trainingKey=v;timerBudget=Math.min(time,work(v).mins);}route('work',v);break;
 case 'timer':if(activeSet)stopTimer();else{activeSet=true;const end=Date.now()+left*1000;activeClock=setInterval(()=>{left=Math.max(0,Math.ceil((end-Date.now())/1000));if($('#timer'))$('#timer').textContent=timeText();if(!left){stopTimer();if(view==='work')draw();notice('Отрезок завершён.');}},250);}draw();break;
 case 'timerreset':stopTimer();left=Math.min(time,work(detail).mins)*60;draw();break;case 'tech':route('tech',v);break;
 case 'workdone':{sets=v==='walk'?1:Number($('#sets').value);reps=v==='walk'?1:Number($('#reps').value);if(!Number.isInteger(sets)||sets<1||sets>50||!Number.isInteger(reps)||reps<1||reps>300)throw Error('Проверь число подходов и повторений.');stopTimer();pendingWorkout={workout:v,sets,reps};reply=null;privateAction=true;taskKind=v==='walk'?'walk':'move';time=Math.min(time,work(v).mins);activeGame='';route('action');break;}
 case 'solo':if(Object.hasOwn(SoloPlans,v))route('solo',v);break;
 case 'solo-start':if(!Object.hasOwn(SoloPlans,v))break;
   await write('solo-select',{plan:v});save('entered',true);stack=[['today','']];return handle('solo-next:'+v);
 case 'solo-next':if(!Object.hasOwn(SoloPlans,v))break;
   if(v==='kitchen'){mt='Ужин';foodView=read('food-reviewed')||S.dna?.limit?'recipes':'week';onlyFav=false;qPantry=false;portions=1;route('food');}
   else return handle('work:'+v);
   break;
 case 'expert-recipes':foodView='recipes';route('food');break;case 'expert':route('expert',v);break;case 'product':route('product',v);expose('offers');break;
 case 'book':if(!await expose('offers'))throw Error('Не удалось открыть предложение. Проверь связь и повтори.');await write('book',{sku:v});draw();notice(demo?'Демозаявка сохранена.':'Заявка сохранена.');break;
 case 'refund-review':if(demo&&S.booking?.sku===detail&&(detail==='RESET'||personalOffer(detail))&&S.booking.paid_kopeks>S.booking.refunded_kopeks)homeSheet('Вернуть оплату за сезон?',muted('Будет оформлен учебный возврат по этой заявке.')+b('Вернуть '+num((S.booking.paid_kopeks-S.booking.refunded_kopeks)/100)+' ₽ в демо','receipt:refund','btn full')+b('Оставить сезон','sheetclose','textbtn full'));break;
 case 'receipt':if(demo){S=await api('/demo/receipt',{kind:v});notice('');draw();document.querySelector('.order-state')?.focus({preventScroll:true});}break;
 case 'renewal-review':if(demo&&S.demo_renewal&&!S.demo_renewal.refunded_at)homeSheet('Вернуть оплату второго сезона?',muted('Заказ первого сезона сохранится.')+b('Подтвердить учебный возврат','renewal:refund','btn full')+b('Оставить сезон','sheetclose','textbtn full'));break;
 case 'renewal':if(demo){S=await api('/demo/renewal',{kind:v});draw();notice(v==='paid'?'Учебная покупка второго сезона подтверждена.':'Учебный возврат второго сезона подтверждён.');}break;
 case 'interest':await write('interest',{role:args[0],kind:args[1]});draw();notice('Интерес к предложению сохранён.');break;
 case 'download-recap':await recapShare(true);break;case 'share-recap':await recapShare();break;case 'hide':await write('hide',{action:v});draw();break;case 'startseason':await seasonSave();break;
 case 'check':await write('checkin',{week:Number(v),ease:Number($('#ease').value),actual:$('#value').value===''?null:Number($('#value').value)});draw();notice('Личная сверка записана.');break;
 case 'rename':await write('profile',{name:$('#nickname').value,goal:S.profile.goal||'Регулярное движение',barrier:S.profile.barrier||'Мало времени',program:S.profile.program||'Своя программа'});draw();notice('Имя сохранено.');break;
 case 'getcode':code=(await api('/api/recovery/create',{nonce:nonce()})).code;draw();break;case 'restore':await api('/api/recovery/restore',{nonce:nonce(),code:$('#recovery').value});location.reload();break;
 case 'pushon':case 'pushoff':if(!('serviceWorker'in navigator)||!('PushManager'in window)||!isSecureContext)throw Error('Web Push требует HTTPS и поддерживаемый браузер.');if(cmd==='pushon'&&!S.push_key)throw Error('Доставка Web Push ещё не настроена организатором.');
 {const granted=cmd==='pushon'?await Notification.requestPermission():null;await navigator.serviceWorker.register('/sw.js');const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(cmd==='pushon'){if(granted!=='granted')throw Error('Разрешение не предоставлено.');if(!sub)sub=await reg.pushManager.subscribe({applicationServerKey:Uint8Array.from(atob(S.push_key.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0)),userVisibleOnly:true});await write('subscribe',{subscription:sub.toJSON()});}else if(sub){await write('unsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe();}if(cmd==='pushon'){choice.pushEnabled();if(view==='choice')draw();}notice('Настройки уведомлений сохранены.');}break;
 }}
function stopTimer(){clearInterval(activeClock);activeSet=false;activeClock=null;}
async function shareText(t,text){if(navigator.share){await navigator.share({title:t,text});return;}try{await navigator.clipboard.writeText(text);notice('Скопировано.');}catch{notice('Можно скопировать текст вручную.');}}
async function recapShare(downloadOnly=false){const w=RitmHome.week(S,weekly),canvas=document.createElement('canvas');canvas.width=800;canvas.height=530;const ctx=canvas.getContext('2d');ctx.fillStyle='#101110';ctx.fillRect(0,0,800,530);ctx.fillStyle='#d5fc53';ctx.font='bold 70px Arial';ctx.fillText('ritm.',50,100);ctx.fillStyle='#f5f6f2';ctx.font='bold 46px Arial';ctx.fillText('Моя неделя',50,220);ctx.font='bold 76px Arial';ctx.fillText(w.percent+'%',50,337);ctx.font='27px Arial';ctx.fillText(w.caption,50,405);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const file=new File([blob],'RITM-RECAP.png',{type:'image/png'});if(!downloadOnly&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'RITM RECAP'});}else{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);notice('Карточка подготовлена.');}}
async function seed(){if(demo){const seeded=await api('/demo/seed',{});S=seeded.profile?seeded:await api('/api/me');}}
document.addEventListener('click',async ev=>{
 const el=ev.target.closest('[data-a]');if(!el||busy)return;
 busy=true;
 const indicator=setTimeout(()=>{el.setAttribute('aria-busy','true');if(el.isConnected)el.disabled=true;},180);
 try{
   if(!ready){notice('Открываем приложение…');await startup;if(!ready)return;}
   if(el.dataset.a!=='redraw')notice('');
   await handle(el.dataset.a);
   if(view==='dna')sessionStorage.setItem(key('onboarding'),JSON.stringify({step,mode:formMode,draft}));

 }catch(err){if(err.name!=='AbortError')notice(err.message||'Попробуй ещё раз.');}
 finally{clearTimeout(indicator);if(el.hasAttribute('aria-busy')){el.removeAttribute('aria-busy');el.disabled=false;}busy=false;}
});
document.addEventListener('input',ev=>{if(ev.target.id==='duel-reward'){duelReward=ev.target.value;const preview=$('#reward-preview');if(preview)preview.textContent=duelReward;}
 if(view==='dna'&&ev.target.id==='customLimit'){draft.custom=ev.target.value;sessionStorage.setItem(key('onboarding'),JSON.stringify({step,mode:formMode,draft}));}});
document.addEventListener('input',ev=>{if(lifecycle&&view==='league-review'&&ev.target.id==='lc-editor')lifecycle.edit(detail,ev.target.value);});
document.addEventListener('change',ev=>{const el=ev.target;if(el.dataset.catalog){programs.filter(el.dataset.catalog,el.value);draw();document.querySelector('[data-catalog="'+el.dataset.catalog+'"]')?.focus();return;}if(el.id==='pulse-haptics')save('pulseHaptics',el.checked);if(el.id==='visible')privateAction=!el.checked;if(el.dataset.pref){let o=read('notifs')||{};o[el.dataset.pref]=el.checked;save('notifs',o);}});
async function init(){
 try{S=await api('/api/me');}
 catch(err){
   const saved=readOfflineWorkout();
   if(!saved||!err.networkDown)throw err;
   S=saved;offlineJournal=true;view='journalTrain';ready=true;draw();
   const reconnect=setInterval(async()=>{try{await api('/api/me');clearInterval(reconnect);location.reload();}catch{}},2500);
   return;
 }
 rememberWorkout();
 if(navigator.serviceWorker&&window.isSecureContext)navigator.serviceWorker.register('/sw.js').catch(()=>{});
 if(read('pending-sets')?.length)await journals.sync();
 if(!S.allocation)await write('allocate',{channel:pendingGuest||new URLSearchParams(location.search).has('choice')?'friend':new URLSearchParams(location.search).get('channel')||'direct'});const saved=read('available');time=(saved?.day===S.day?saved.minutes:null)||S.season?.plan.duration||Number(S.dna?.minutes)||20;
 const query=new URLSearchParams(location.search);
 if(await choice.initialize(query)){/* The invitation supplies the first screen for guests. */}
 else if(pendingGuest){try{guestInfo=await api('/api/invite?token='+encodeURIComponent(pendingGuest));view='invite';}catch(err){clearInvite();notice(err.message);}}
 else if(demo&&['season-story','league-desk'].includes(query.get('screen'))){await seed();save('entered',true);view=query.get('screen');stack=[['profile','']];}
 else if(['coach','nutritionist'].includes(query.get('screen'))){
   view='product';detail=query.get('screen')==='coach'?'TRAIN':'NUTRI';stack=[[read('entered')||S.profile.goal?'today':'intro',''],['store','']];expose('offers');
 }
 else if(['programs','plus'].includes(query.get('screen'))){
   view=query.get('screen')==='plus'?'plus':'store';
   stack=[[read('entered')||S.profile.goal?'today':'intro','']];
   if(view==='plus')stack.push(['store','']);
 }
 else if(demo&&query.get('screen')==='reset-league'){await seed();save('entered',true);view='product';detail='RESET';stack=[['today',''],['arena','']];}
 else if(demo&&new URLSearchParams(location.search).get('screen')==='today'){await seed();save('entered',true);view='today';if(query.get('feature')==='choice')choice.start();}
 else if(readQuestionnaire()&&!readQuestionnaire().paused){
   const saved=readQuestionnaire();formMode=saved.mode||'full';step=saved.step;draft=saved.draft;view='dna';
 }
 else if(read('entered')||S.profile.goal||programs.current()||personalOffer(S.booking?.sku)){view='today';}
 ready=true;draw();if(view==='intro')expose('intro');
 setInterval(async()=>{if(busy||document.hidden||!['today','pulse','arena','game','notifications','choice'].includes(view)||document.activeElement?.matches('input,select,textarea'))return;try{const before=S,next=await api('/api/me');if(busy||S!==before)return;const sig=s=>JSON.stringify([s.day,s.feed,s.actions,s.games,s.pulse,s.choices,s.solo]);if(sig(S)!==sig(next)||(view==='today'&&Math.floor(S.server_time/60)!==Math.floor(next.server_time/60)&&!document.querySelector('dialog[open]'))){const previousSource=incoming()?.source;
 const updates=(next.choices||[]).filter(item=>{const old=(before.choices||[]).find(c=>c.id===item.id);return item.completed&&!old?.completed&&item.role==='voter'||item.selected&&!old?.selected&&item.role==='owner'||item.target&&!old&&item.role==='guest';});
 S=next;draw();if(updates.length&&(read('notifs')||{}).pulse!==false){const item=updates[0];notice(item.completed?'Друг выполнил выбранный ход.':item.selected?'Друг выбрал твой ход.':'Друг просит выбрать ответный ход.');}if(incoming()?.source&&incoming().source!==previousSource)document.querySelector('.home-pulse')?.classList.add('pulse-arrived');}}catch{}},5500);
}
function readOfflineWorkout(){
 try{return JSON.parse(localStorage.getItem('ritm-pilot-active'));}catch{return null;}
}
const startup=init().catch(err=>{$('#content').innerHTML=head('Не удалось открыть RITM')+muted(err.message)+'<button class="btn" id="retry">Попробовать ещё раз</button>';$('#retry').onclick=()=>location.reload();});
})();
