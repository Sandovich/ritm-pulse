const productNames={FOOD:'Питание на 28 дней',RESET:'28 дней изменений',DUO:'Сезон для двоих'};
const products={
 FOOD:['1 490 ₽','За одного · 28 дней','Меню на рабочую неделю, список покупок, замены и групповой разбор нутрициолога.'],
 RESET:['1 990 ₽','За одного · 28 дней','Тренировки, план питания, недельные сверки и дуэли. Сопровождают тренер и нутрициолог.'],
 DUO:['2 990 ₽','За двоих · 28 дней','Отдельный план для каждого, общая миссия на неделю и разбор с экспертами.']
};
const sections={
 focus:['Какое изменение хотите заметить?',['Регулярность тренировок','Стать сильнее','Питание в будни','Больше движения']],
 days:['Сколько дней в неделю подойдут для плана?',[2,3,4,5,6,7]],
 duration:['Обычное окно, минут',[5,10,15,20,30,60]],
 place:['Где удобно заниматься?',['Дома','В зале','На улице']],
 equipment:['Что есть для занятий?',['Без оборудования','Есть инвентарь','Есть свой план тренера']],
 adaptation:['Нужна ли адаптация специалистом?',['Подойдёт привычная нагрузка','Сначала согласовать с тренером']],
 food_for:['На кого готовите?',['Для себя','Для двоих','Для семьи']],
 cooking:['Как удобнее готовить?',['15 минут','30 минут','Готовить впрок']],
 budget:['Что важнее при закупке?',['Важна доступная цена','Важнее сэкономить время']]
};
const progressUnits={'Регулярность тренировок':['Дни тренировок за последние 7 дней',7],'Стать сильнее':['Повторения одного упражнения с одинаковой нагрузкой',300],'Питание в будни':['Будни с запланированной едой из последних пяти',5],'Больше движения':['Дни прогулок за последние 7 дней',7]};
let shareAction=false,recoveryCode='',registration=null,askLeave='',seen=new Set(),entryChannel=new URLSearchParams(location.search).get('channel')||'direct';
function sellPage(){
 let order=(state.allocation?.ordering||'FOOD,RESET,DUO').split(',');
 const cards=order.map(k=>'<article class="card"><small>'+k+' · '+products[k][1]+'</small><h2>'+productNames[k]+'</h2><p>'+products[k][2]+'</p><div class="task"><b>'+products[k][0]+'</b>'+(!state.booking?btn('Выбрать '+k,'book-'+k,'primary'):'')+'</div></article>').join('');
 return '<h1>Выберите свой сезон</h1><p>Три формата первого набора. Оставьте одну заявку по указанной цене. Организатор подтвердит дату, состав сопровождения и возможность оплаты отдельно.</p>'+(state.booking?'<section class="hero"><h2>Ваша заявка · '+esc(state.booking.sku)+'</h2><p>Код для организатора <b>'+esc(state.booking.ref)+'</b></p><p>'+state.booking.price+' ₽ за '+(state.booking.seats===2?'двоих':'одного')+'. Сохраните код и сообщите его организатору для сверки.</p>'+(state.booking.checkout?'<a class="pay" rel="noopener noreferrer" target="_blank" href="'+esc(state.booking.checkout)+'">Открыть оплату у организатора</a>':'<p>Оплата откроется после подтверждения набора.</p>')+'</section>':'')+cards;
}
function intro(){
 const benefit=state.allocation?.arm==='benefit';
 return '<section class="card"><h2>'+(benefit?'Измени свою форму вместе с друзьями':'Ответь другу своим делом')+'</h2><p>'+(benefit?'Персональный план питания и тренировок и дружеские соревнования помогают вернуться после пропуска.':'Друг закончил тренировку. Выберите своё дело, ответьте ему и продолжайте вместе.')+'</p>'+btn('Подобрать мой сезон','start-offer','primary')+'</section>';
}
function formFields(keys,plan,locked){
 return keys.map(k=>'<label>'+sections[k][0]+'<select id="pref-'+k+'"'+(locked&&k==='focus'?' disabled':'')+'>'+options(sections[k][1],plan[k])+'</select></label>').join('');
}
function metricForm(focus,s){
 const [unit,max]=progressUnits[focus];
 return '<p><b>'+unit+'</b></p>'+(focus==='Стать сильнее'?'<label>Упражнение и фиксированная нагрузка<input id="comparison" maxlength="100" '+(s?'readonly':'')+' value="'+esc(s?.comparison||'')+'"></label>':'')+
 '<label>Мой исходный результат, по желанию<input id="baseline" type="number" min="0" max="'+max+'" step="1" '+(s?'readonly':'')+' value="'+esc(s?.baseline??'')+'"></label><label>Желаемый результат к 28-му дню, по желанию<input id="target" type="number" min="0" max="'+max+'" step="1" value="'+esc(s?.target??'')+'"></label>';
}
function seasonForm(){
 const s=state.season,plan=s?.plan||{focus:state.profile.goal==='Питание'?'Питание в будни':'Регулярность тренировок',days:3,duration:15};
 return '<h1>Мой сезон на 28 дней</h1><p>По ответам RITM предложит формат занятия и еды. Замеры видны только вам.</p>'+formFields(['focus','days','duration','place','equipment','adaptation','food_for','cooking','budget'],plan,!!s)+'<div id="measurement">'+metricForm(plan.focus,s)+'</div>'+btn(s?'Обновить условия':'Начать личный сезон','save-season','primary');
}
function workCard(){
 const p=state.season?.plan;
 if(!p)return '<p>Укажите доступное время, где вы занимаетесь и какое изменение хотите увидеть.</p>'+btn('Составить план','plan-season');
 let text=p.adaptation==='Сначала согласовать с тренером'?'Запишите, какую часть текущей программы хотите обсудить с тренером. Дождитесь согласованного задания.':
 p.equipment==='Есть свой план тренера'?'Откройте занятие своего тренера. Выберите знакомый блок, который целиком помещается в ваше окно.':
 p.focus==='Стать сильнее'?'Выберите знакомое упражнение из своего плана. Запишите упражнение и нагрузку, чтобы повторить замер в тех же условиях.':
 p.place==='На улице'?'Выберите знакомый маршрут для прогулки. Заранее определите точку разворота, чтобы уложиться в своё окно.':
 p.place==='В зале'?'Выберите освоенное упражнение из программы в зале. Для короткого окна используйте заранее согласованную с тренером часть занятия.':
 'Выберите знакомую домашнюю разминку из своей программы. Для первого дня достаточно одного заранее выбранного блока.';
 return '<small>'+esc(p.place)+' · '+p.duration+' мин · план на '+p.days+' дн. в неделю</small><p>'+esc(text)+'</p>';
}
function foodPlan(){
 const p=state.season?.plan;if(!p)return '';
 return '<p><strong>'+esc(p.food_for)+' · '+esc(p.cooking)+'</strong><br>'+esc(p.cooking==='Готовить впрок'?'Заложите ещё одну порцию основы на следующий день.':p.cooking==='15 минут'?'Для короткого окна возьмите готовую крупу или уже сваренные бобовые.':'Запланируйте один ужин и подготовьте продукты заранее.')+' '+esc(p.budget==='Важна доступная цена'?'При покупке сравните стоимость одной порции для двух доступных замен.':'Выберите продукт, который уже есть дома или готов к использованию.')+'</p>';
}
function progress(){
 const s=state.season;if(!s)return '<h1>Мой прогресс</h1>'+btn('Выбрать личную цель','plan-season','primary');
 const w=Math.min(4,Math.floor((s.elapsed+1)/7)), last=s.checkins.at(-1),delta=last?.actual!=null&&s.baseline!=null?last.actual-s.baseline:null;
 return '<h1>Мой прогресс</h1><section class="hero"><small>День '+s.day+' из 28</small><h2>'+esc(s.plan.focus)+'</h2><p>'+s.active_days+' дн. с отмеченным действием</p></section><h2>Моя цель</h2><p>'+esc(s.metric)+'</p><p>В начале · '+esc(s.baseline??'пропущено')+'　 Цель · '+esc(s.target??'не задана')+'</p>'+(s.comparison?'<p>'+esc(s.comparison)+'</p>':'')+
 (delta!==null?'<p><b>Изменение к сверке '+last.week+' · '+(delta>0?'+':'')+delta+'</b></p>':'')+
 '<h2>Сверка недели</h2>'+s.checkins.map(x=>'<p>Неделя '+x.week+' · удобство '+x.ease+' из 5 · результат '+esc(x.actual??'пропущен')+'</p>').join('')+
 (w>0?'<label>Неделя<select id="week">'+options(Array.from({length:w},(_,i)=>i+1),w)+'</select></label><label>Насколько план вписался в неделю? (1–5)<select id="ease">'+options([1,2,3,4,5],last?.ease||3)+'</select></label><label>'+esc(s.metric)+' · добровольно<input id="actual" type="number" min="0" max="'+s.max+'" value="'+esc(last?.week===w?last.actual??'':'')+'"></label>'+btn('Сохранить сверку','checkin','primary'):'<p>Первая сверка откроется на седьмой день. На 28-й день повторите исходный замер.</p>')+
 '<p>Самооценка и показатели хранятся в личном профиле.</p>'+btn('Изменить условия плана','plan-season');
}
function privacyControl(){return '<label class="inline"><input type="checkbox" id="share-action" '+(shareAction||replyTo?'checked':'')+(replyTo?' disabled':'')+'> Показывать вид действия моим кругам</label>';}
function settings(){
 return '<details><summary>Уведомления и доступ</summary><p>Разрешите короткое уведомление о новом действии в круге. Цель и вид действия в тексте скрыты.</p>'+btn('Включить системные уведомления','enablepush')+' '+btn('Отключить на этом устройстве','disablepush')+'<h3>Код восстановления</h3><p>Сохраните одноразовый код лично. После восстановления потребуется заново включить уведомления.</p>'+btn('Получить новый код','getcode')+(recoveryCode?'<p class="code">'+esc(recoveryCode)+'</p>':'')+'<label>Ввести сохранённый код<input id="recover" autocomplete="off" type="password"></label>'+btn('Восстановить профиль','recover')+'</details>';
}
function noteVisible(step){
 if(seen.has(step))return;seen.add(step);
 api('/api/action',{verb:'exposure',nonce:nonce(),step,channel:entryChannel}).catch(()=>seen.delete(step));
}
async function ensureWorker(){
 if(!isSecureContext||!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window))throw Error('Web Push требует HTTPS и поддерживаемый браузер. На iPhone установите приложение на экран «Домой».');
 registration=await navigator.serviceWorker.register('/sw.js');return await navigator.serviceWorker.ready;
}
async function pushChange(enable){
 if(enable&&!state.push_key)throw Error('Организатор ещё не настроил доставку Web Push на этом сервере.');
 if(enable&&(!isSecureContext||!('Notification' in window)))throw Error('Для уведомлений откройте приложение по HTTPS в поддерживаемом браузере.');
 const permission=enable?Notification.requestPermission():null;
 const granted=permission?await permission:null;const reg=await ensureWorker();let sub=await reg.pushManager.getSubscription();
 if(enable){if(granted!=='granted')throw Error('Разрешение на уведомления не получено.');
  if(!sub){const key=state.push_key.replace(/-/g,'+').replace(/_/g,'/');sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(atob(key),c=>c.charCodeAt(0))});}
  await write('subscribe',{subscription:sub.toJSON()});notice('Это устройство подписано на новые импульсы.');
 }else{if(sub){await write('unsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe();}notice('На этом устройстве уведомления отключены.');}
}
async function productAction(act){
 if(act==='start-offer'){await write('exposure',{step:'start',channel:entryChannel});tab='Сезоны';return true;}
 if(act==='plan-season'){tab='Анкета';return true;}
 if(act==='save-season'){
  const plan=Object.fromEntries(Object.keys(sections).map(k=>[k,['days','duration'].includes(k)?Number($('#pref-'+k).value):$('#pref-'+k).value]));
  const n=id=>$('#'+id).value===''?null:Number($('#'+id).value);
  await write('season',{plan,comparison:$('#comparison')?.value||'',baseline:n('baseline'),target:n('target')});tab='Сегодня';minutes=plan.duration;notice('Личный сезон сохранён.');return true;
 }
 if(act==='checkin'){await write('checkin',{week:Number($('#week').value),ease:Number($('#ease').value),actual:$('#actual').value===''?null:Number($('#actual').value)});notice('Личная сверка сохранена.');return true;}
 if(act.startsWith('book-')){await write('exposure',{step:'offers',channel:entryChannel});await write('book',{sku:act.slice(5)});return true;}
 if(act.startsWith('hide-')){await write('hide',{action:act.slice(5)});notice('Дело скрыто в лентах кругов.');return true;}
 if(act.startsWith('leave-')){askLeave=act.slice(6);return true;}
 if(act.startsWith('confirmleave-')){await write('leave',{game:act.slice('confirmleave-'.length)});askLeave='';shared='';replyTo=null;notice('Вы вышли из круга.');return true;}
 if(act==='stay'){askLeave='';return true;}
 if(act==='enablepush'||act==='disablepush'){await pushChange(act==='enablepush');return true;}
 if(act==='getcode'){recoveryCode=(await api('/api/recovery/create',{nonce:nonce()})).code;notice('Сохраните код из раздела доступа.');return true;}
 if(act==='recover'){await api('/api/recovery/restore',{nonce:nonce(),code:$('#recover').value});location.replace('/');return true;}
 return false;
}

