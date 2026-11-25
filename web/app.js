'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={move:'Движение',food:'Питание',walk:'Прогулка'}, modes={relay:'Эстафета',duel:'Дуэль',circle:'Круг друзей'};
const goals=['Физическая форма','Регулярное движение','Питание','Прогулки'], barriers=['Мало времени','Меняется график','Сложно начать одному','Трудно решить, что приготовить'], programs=['Своя программа','Движение с тренером','Питание с нутрициологом'];
const food=[
 ['Кускус с нутом и огурцом','кускус, готовый нут, огурец','Заварите кускус по инструкции, слейте нут, нарежьте огурец и смешайте.','Нут можно заменить готовой фасолью.'],
 ['Паста с томатами и фасолью','паста, томаты, готовая фасоль','Сварите пасту. Прогрейте нарезанные томаты с фасолью и добавьте к пасте.','Вместо свежих томатов подойдут консервированные.'],
 ['Лаваш с хумусом и овощами','лаваш, хумус, морковь, огурец','Нарежьте овощи тонко, смажьте лаваш хумусом и сверните.','Вместо лаваша подойдёт тост.'],
 ['Гречка с грибами','гречка, шампиньоны, лук','Сварите гречку. Обжарьте мелко нарезанные грибы и лук до готовности, смешайте.','Свежие шампиньоны можно заменить замороженными.'],
 ['Рис с горошком','рис, замороженный горошек, зелень','Сварите рис, приготовьте горошек по инструкции и смешайте с зеленью.','Замените зелень любимой приправой.'],
 ['Картофель с фасолью','картофель, готовая фасоль, зелень','Отварите нарезанный картофель. Прогрейте фасоль и подайте вместе с зеленью.','Фасоль можно заменить готовым нутом.'],
 ['Омлет с помидором','яйца, помидор, масло','Нарежьте и прогрейте помидор, добавьте взбитые яйца и готовьте до полной готовности.','Вместо помидора подойдёт сладкий перец.']
];
let state,tab='Сегодня', invite=new URLSearchParams(location.search).get('invite'),preview,shared='',busy=false;
let replyTo=null;
let minutes=15,kind='move',dish=0,variant='original';
const tabs=['Сегодня','Питание','Арена','Прогресс','Сезоны','Профиль'];
const btn=(text,act,cls='')=>'<button type="button" class="'+cls+'" data-act="'+esc(act)+'">'+esc(text)+'</button>';
const options=(items,sel)=>items.map(x=>'<option'+(x===sel?' selected':'')+' value="'+esc(x)+'">'+esc(x)+'</option>').join('');
const chooseKind=(id,val)=>'<label>Моё действие<select id="'+id+'">'+Object.entries(labels).map(([k,v])=>'<option value="'+k+'"'+(k===val?' selected':'')+'>'+v+'</option>').join('')+'</select></label>';
const notice=t=>$('#notice').textContent=t;
async function api(path,body){
 if(window.ritmDemo)return window.ritmDemo.api(path,body);
 const res=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
 const data=await res.json();if(!res.ok)throw Error(data.error||'Не удалось открыть страницу.');return data;
}
const nonce=()=>Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
async function write(verb,fields={}){state=await api('/api/action',{verb,nonce:nonce(),...fields});return state.result;}
function timeSelect(){return '<label>Доступно минут<select id="minutes">'+options([5,10,15,20,30,60],minutes)+'</select></label>';}
function menu(){
 const plan=state.season?.plan;
 const picks=plan?.cooking==='15 минут'?[0,2,6]:plan?.cooking==='Готовить впрок'?[1,3,4,5]:[0,1,2,3,4,5,6];
 const index=Math.floor(Date.parse(state.day+'T12:00:00Z')/86400000);
 return food[picks[(index+dish)%picks.length]];
}
function foodCard(){const f=menu();return foodPlan()+'<section class="card"><small>Ужин на сегодня</small><h2>'+esc(f[0])+'</h2><p>'+esc(f[2])+'</p><p><b>В корзину</b> · '+esc(f[1])+'</p><p>'+esc(f[3])+'</p>'+btn('Другой ужин','swap')+'</section>';}
const gameName=g=>modes[g.mode];
function pulse(){
 if(!state.pulse.length)return '<p>Создайте круг до четырёх человек. Друзья увидят число выполненных дел. Вы выбираете видимость каждого дела перед отметкой.</p>'+btn('Создать свой круг','circle');
 return state.games.filter(g=>g.mode==='circle').map((g,i)=>'<section class="card"><h3>Мой круг '+(i+1)+'</h3>'+state.pulse.filter(p=>p.game===g.id).map(p=>'<div class="task"><span>'+esc(p.person===state.profile.id?'Вы':p.name||'Друг')+'</span><b>'+p.count+' / 3</b></div>'+(p.source&&p.person!==state.profile.id?'<p><small>'+(p.for_you?'Ответ на ваше дело · ':'Последнее дело · ')+labels[p.kind]+'</small> '+(p.answered?'Ответ принят':btn('Ответить своим делом','reply|'+g.id+'|'+p.source))+'</p>':'')).join('')+'<small>Виды дел за сегодня после вступления. Учитываются движение, питание и прогулка.</small></section>').join('');
}
function gameCard(g){
 let mine=g.participants.find(p=>p.id===state.profile.id), completed=mine.days.length>0;
 let status=g.mode==='circle'?'Общее пространство':g.mode==='duel'&&!g.starts?(g.invite_open?'Ожидает друга':'Приглашение закрыто'):g.mode==='relay'&&g.participants.length===2&&g.participants.every(p=>p.days.length)?'Ход принят':g.active?'В игре':'Завершено';
 return '<section class="card"><small>'+esc(status)+'</small><h3>'+esc(gameName(g))+'</h3>'+g.participants.map(p=>'<div class="task"><span>'+esc(p.id===state.profile.id?'Вы':p.name||'Друг')+' · '+labels[p.kind]+'</span><b>'+(g.mode==='circle'?'':p.days.length+(g.mode==='duel'?' / 7':' / 1'))+'</b></div>').join('')+
 (g.proposed?'<p>Предложенное время · '+esc(new Date(g.proposed*1000).toLocaleString('ru-RU'))+'</p>':'')+
 ((g.active&&g.mode==='relay'&&g.host!==state.profile.id&&!completed)||(g.active&&g.mode==='duel'&&!mine.days.includes(state.day))?timeSelect().replace('id="minutes"','data-time="'+g.id+'"')+btn('Выполнить мой ход','play-'+g.id,'primary'):'')+
 (g.token&&g.invite_open?btn('Показать приглашение','share-'+g.id):'')+(g.mode==='circle'?(askLeave===g.id?'<p>Выйти из этого круга?</p>'+btn('Да, выйти','confirmleave-'+g.id)+' '+btn('Остаться','stay'):btn('Покинуть круг','leave-'+g.id)):'')+'</section>';
}
function arena(){return '<h1>Арена</h1><p>В эстафете у друга есть сутки на ответ. В дуэли у каждого своё дело. За день можно заработать одно очко. Круг остаётся с вами после игры.</p><section class="card">'+chooseKind('arena-kind',kind)+'<label>Время встречи, если нужно<input id="slot" type="datetime-local"></label><div class="row">'+btn('Передать ход','relay')+btn('Дуэль на 7 дней','duel')+btn('Создать круг','circle')+'</div></section>'+state.games.map(gameCard).join('');}
function profile(){let p=state.profile;return '<h1>Мой план</h1><label>Имя для друзей<input id="name" maxlength="30" value="'+esc(p.name)+'"></label>'+[['goal','Цель',goals,p.goal],['barrier','Что чаще мешает',barriers,p.barrier],['program','По чему занимаетесь',programs,p.program]].map(([id,label,items,val])=>'<label>'+label+'<select id="'+id+'">'+options(items,val)+'</select></label>').join('')+btn('Сохранить план','profile','primary')+' '+btn('Мой сезон на 28 дней','plan-season')+settings();}
function personal(){let p=state.profile;return p.goal?'<p>'+esc(p.goal)+' · '+esc(p.program)+'</p><p>'+esc(['Выберите короткую версию дела.','Привяжите дело к свободному окну сегодня.','Передайте ход другу или выберите дуэль.','Откройте ужин и список продуктов на сегодня.'][barriers.indexOf(p.barrier)]||'Выберите дело на сегодня.')+'</p>':'<p>Выберите цель и то, что мешает ей следовать.</p>'+btn('Настроить личный план','p');}
function render(){
 $('nav').innerHTML=tabs.map(x=>'<button data-tab="'+x+'"'+(tab===x?' aria-current="page"':'')+'>'+x+'</button>').join('');
 if(invite&&preview){$('#app').innerHTML='<h1>'+esc(modes[preview.mode])+'</h1><p>'+esc(preview.name||'Друг')+' приглашает вас. Можно начать без аккаунта.</p>'+(preview.member?btn('Открыть мою арену','leaveinvite'):!preview.open?'<p>Срок приглашения вышел или места заняты.</p>'+btn('К моему дню','leaveinvite'):chooseKind('guest-kind',kind)+btn('Принять приглашение','join','primary')+' '+btn('Пропустить','decline'));return;}
 let body=tab==='Сегодня'?((!state.profile.goal&&!state.season)?intro():'')+'<section class="hero"><small>'+esc(state.day)+'</small><h1>'+esc(state.season?state.season.plan.focus:'Твой день')+'</h1>'+(state.season?'<p>День '+state.season.day+' из 28 · '+esc(state.season.plan.days)+' дн. в неделю</p>':personal())+'</section><h2>'+(replyTo?'Ваш ответ другу':'Одно дело сейчас')+'</h2>'+(replyTo?btn('Отменить ответ','cancelreply'):'')+chooseKind('kind',kind)+timeSelect()+(kind==='food'?foodCard():'<p>'+esc(kind==='walk'?'Выйдите на прогулку в удобное вам время.':'Выполните подходящий фрагмент своей привычной программы.')+'</p>')+(kind==='move'&&state.season?workCard():'')+privacyControl()+btn('Отметить выполнение','done','primary')+' '+btn(variant==='original'?'Выбрать облегчённое действие':'Вернуть исходное действие','variant')+'<p>За сегодня отмечено дел: '+state.actions.length+'</p>'+state.actions.map(a=>'<div class="task">'+esc(a.kind==='food'?a.label:labels[a.kind])+' · '+a.minutes+' мин</div>'+(a.shared?btn('Скрыть в кругах','hide-'+a.id):'')).join('')+'<h2>Пульс друзей</h2>'+pulse():
 tab==='Питание'?'<h1>Питание</h1>'+foodCard()+privacyControl()+btn('Отметить дело по питанию','fooddone','primary'):tab==='Арена'?arena():tab==='Профиль'?profile():tab==='Сезоны'?sellPage():tab==='Прогресс'?progress():seasonForm();
 const g=state.games.find(x=>x.id===shared);if(g&&tab==='Арена'&&g.token&&g.invite_open)body='<section class="card"><label>Ссылка для друга<input id="link" readonly value="'+esc(location.origin+'/?invite='+g.token)+'"></label>'+btn('Скопировать ссылку','copy')+'</section>'+body;
 $('#app').innerHTML=body;
 if(tab==='Сезоны')noteVisible('offers');
 if(tab==='Сегодня'&&!state.profile.goal&&!state.season)noteVisible('intro');
 if(tab==='Профиль'&&recoveryCode)$('details').open=true;
}
function doneData(k,m,game){return {kind:k,minutes:m,task:k==='food'?menu()[0]:k,variant,visibility:(shareAction||replyTo)?'circle':'private',...(game?{game}:{} )};}
function closeInvite(){invite=null;preview=null;history.replaceState(null,'','/');}
async function handle(act){
 if(await productAction(act))return;
 if(['relay','circle','duel','done','fooddone'].includes(act)&&!state.profile.goal&&!state.games.length){tab='Профиль';notice('Сначала выберите цель и условия. По ним мы подберём первое дело.');return;}
 if(act.startsWith('reply|')){const [,game,source]=act.split('|');replyTo={game,source};tab='Сегодня';notice('Выберите своё дело для ответа другу.');window.scrollTo(0,0);return;}
 if(act==='cancelreply'){replyTo=null;return;}
 if(act==='p'){tab='Профиль';return;} if(act==='swap'){dish+=1;return;}
 if(act==='variant'){variant=variant==='original'?'alternative':'original';if(variant==='alternative')minutes=5;return;}
 if(act==='copy'){let input=$('#link');input.select();try{await navigator.clipboard.writeText(input.value);notice('Ссылка скопирована.');}catch{notice('Ссылка выделена. Скопируйте её в буфер обмена.');}return;}
 if(act.startsWith('share-')){shared=act.slice(6);return;}
 if(act==='profile'){await write('profile',Object.fromEntries(['name','goal','barrier','program'].map(k=>[k,$('#'+k).value])));kind=state.profile.goal==='Питание'?'food':state.profile.goal==='Прогулки'?'walk':'move';tab='Сегодня';notice('Личный план сохранён.');return;}
 if(act==='join'){await write('join',{token:invite,kind:$('#guest-kind').value});closeInvite();tab='Арена';notice('Вы в игре. Ваш план может отличаться от плана друга.');return;}
 if(act==='decline'||act==='leaveinvite'){if(act==='decline')await write('decline',{token:invite});closeInvite();tab=act==='decline'?'Сегодня':'Арена';return;}
 if(act==='done'||act==='fooddone'){if(!replyTo&&state.actions.some(a=>a.kind===(act==='fooddone'?'food':kind))){notice('Это дело вы уже отметили сегодня.');return;}await write('done',{...doneData(act==='fooddone'?'food':kind,minutes),...(act==='done'?replyTo:null)});notice(replyTo&&act==='done'?'Друг получил ваш ответ.':'Дело за сегодня учтено.');if(act==='done')replyTo=null;shareAction=false;return;}
 if(act.startsWith('play-')){let id=act.slice(5),game=state.games.find(g=>g.id===id),k=game.participants.find(p=>p.id===state.profile.id).kind;
 await write('done',doneData(k,Number($('[data-time="'+id+'"]').value),id));notice('Действие сохранено. Счёт обновляется у обоих участников.');return;}
 if(act in modes){const val=$('#slot')?.value;let result=await write('create',{kind:$('#arena-kind')?.value||kind,mode:act,proposed:val?Math.floor(new Date(val).getTime()/1000):null});shared=result.game;tab='Арена';notice('Приглашение готово.');}
}
if(!window.RITM_PREMIUM){
document.addEventListener('change',e=>{if(e.target.id==='share-action')shareAction=e.target.checked;if(e.target.id==='pref-focus')$('#measurement').innerHTML=metricForm(e.target.value,null);if(e.target.id==='minutes')minutes=Number(e.target.value);if(e.target.id==='kind'){kind=e.target.value;render();}if(e.target.id==='arena-kind')kind=e.target.value;});
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b||busy)return;$('#error').textContent='';notice('');busy=true;try{if(b.dataset.tab){tab=b.dataset.tab;recoveryCode='';if(invite)closeInvite();shared='';}else if(b.dataset.act){await handle(b.dataset.act);}render();}catch(err){$('#error').textContent=err.message;}finally{busy=false;}});
async function init(){state=await api('/api/me');if(!state.allocation)await write('allocate',{channel:invite?'friend':entryChannel});if(state.season)minutes=state.season.plan.duration;kind=state.profile.goal==='Питание'?'food':state.profile.goal==='Прогулки'?'walk':'move';if(invite)try{preview=await api('/api/invite?token='+encodeURIComponent(invite));}catch(err){closeInvite();$('#error').textContent=err.message;}render();
 setInterval(async()=>{if(busy||invite||document.hidden||['Профиль','Анкета','Прогресс'].includes(tab)||['INPUT','SELECT'].includes(document.activeElement?.tagName))return;
 try{const prev=state,next=await api('/api/me');if(busy||state!==prev)return;const signature=s=>JSON.stringify([s.day,s.games,s.pulse,s.actions]);if(signature(prev)!==signature(next)){state=next;render();}}catch{}},4000);}
init().catch(err=>$('#error').textContent=err.message);

}
