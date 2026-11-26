// Isolated founder demo. All people and season records below are fixtures.
window.createRitmLifecycle = function ({read, save, route, draw, b, e, I, label, muted, head, num, price, participantName, hasSeat, renewal}) {
  const key = 'reset-league-lifecycle-v1';
  const members = [
    ['self', '', 9, 10], ['lena', 'Лена', 8, 10], ['maks', 'Макс', 7, 10],
    ['masha', 'Маша', 10, 10], ['ira', 'Ира', 8, 10], ['lev', 'Лев', 9, 10],
    ['anna', 'Анна', 8, 10], ['dima', 'Дима', 7, 10], ['vera', 'Вера', 9, 10], ['oleg', 'Олег', 9, 10],
  ];
  const roles = {train:'Тренер', food:'Нутрициолог'};
  const goals = {
    schedule: {label:'Менялось расписание', aim:'Сохранить привычный режим, когда меняется расписание.', plan:'Тренер согласует короткий вариант знакомого занятия, нутрициолог — замены для ужина вне дома. Раз в неделю вы разбираете, что удалось применить.'},
    dinner: {label:'Было трудно успеть с ужином', aim:'Готовить дома даже в занятые будни.', plan:'С нутрициологом ты выберешь два быстрых ужина и соберёшь список на неделю. Тренер поможет разместить знакомые занятия в оставшиеся окна.'},
  };
  const requests = [
    {id:'exercise', role:'train', member:'lena', subject:'Запрос на замену упражнения'},
    {id:'dinner', role:'food', member:'maks', subject:'Вопрос об ужине в дороге'},
  ];
  const reportId = (role,id) => role+'-'+id;
  const memberName = member => member[0]==='self' ? participantName() : member[1];
  const blank = () => ({role:'train', goal:'schedule', enrolled:false, questions:[], answers:{}, drafts:{}, published:{}});
  const get = () => Object.assign(blank(),read(key)||{});
  const store = state => save(key,state);
  const queue = state => requests.concat(state.questions);
  function support() {
    const s=get();
    if(!hasSeat())return head('Твой сезон','RESET LEAGUE')+b('К условиям сезона','product:RESET','btn full');
    return '<div class="lc">'+head('Твой сезон','RESET LEAGUE · демо')+
      '<p class="lc-intro">Выбери задачу недели. Если план перестал подходить, напиши своему специалисту.</p>'+
      choose('Занятие по плану','go:train','activity')+choose('Подобрать ужин','go:food','utensils')+
      '<h2>Обратная связь</h2>'+
      s.questions.map(q=>'<section class="lc-report">'+label(roles[q.role]+' · '+(s.answers[q.id]?'есть ответ':'ожидает ответа'))+'<h3>'+e(q.subject)+'</h3>'+(s.answers[q.id]?'<p>'+e(s.answers[q.id])+'</p>':'')+'</section>').join('')+
      '<label for="lc-question">Что нужно изменить?</label><textarea id="lc-question" maxlength="320" rows="2" placeholder="Например, на этой неделе готовлю только вечером"></textarea>'+
      '<div class="lc-tabs">'+b('Спросить тренера','life-ask:train','linebtn')+b('Спросить нутрициолога','life-ask:food','linebtn')+'</div>'+
      choose('Открыть за специалиста','go:league-desk','users')+
      choose('Посмотреть пример итогов на 28-й день','go:season-story','trophy')+'</div>';
  }
  const choose = (text,action,icon) => '<button class="lc-link" data-a="'+e(action)+'">'+I(icon,19)+'<span>'+e(text)+'</span>'+I('chevron-right',16)+'</button>';
  function line(icon,kicker,title,description,active=false) {
    return '<li class="'+(active?'current':'')+'">'+I(icon,18)+'<div>'+label(kicker)+'<h3>'+e(title)+'</h3><p>'+e(description)+'</p></div></li>';
  }
  function journey() {
    const state=get();
    const next=renewal();
    const nextStatus=next?(next.refunded_at?'Season 02 · учебный возврат':'Season 02 · оплачен в демо'):state.enrolled?'Season 02 · выбран в демо':'Season 02 · следующий этап';
    const self=members[0];
    const reports=Object.keys(roles).filter(role=>state.published[reportId(role,'self')]);
    return '<div class="lc">'+head('Твоя история.','MY JOURNEY · пример')+
      '<ol class="lc-timeline">'+line('circle-check','Season 01 · завершён','RESET','Дни с отметкой по личному плану: '+self[2]+' из '+self[3]+'.')+
      line('activity',nextStatus,'STABILITY',goals[state.goal].aim,true)+
      line('lock','Season 03 · возможная цель','PROGRESS','Определишь новую задачу вместе со специалистом после второго сезона.')+'</ol>'+
      label('Твои достижения')+'<div class="lc-badges">'+[['trophy','Finisher'],['users','Team MVP'],['check','Consistency']].map(([ic,t])=>'<span>'+I(ic,18)+e(t)+'</span>').join('')+'</div>'+
      reports.map(role=>'<section class="lc-report">'+label('Проверено · '+roles[role])+'<p>'+e(state.published[reportId(role,'self')])+'</p></section>').join('')+
      (state.enrolled&&hasSeat()&&!next?b('Подтвердить второй сезон за '+num(price)+' ₽ в демо','renewal:paid','btn full','check'):'')+
      b(state.enrolled?'Условия выбранного сезона':'Посмотреть следующий сезон','go:next-season','btn full','arrow-up-right')+
      choose('Продолжить бесплатно в Арене','go:arena','swords')+
      choose('Посмотреть работу специалиста','go:league-desk','users')+'</div>';
  }
  function offer() {
    const state=get();
    const next=renewal();
    return '<div class="lc">'+head('STABILITY','Season 02 · демонстрация')+
      '<p class="lc-intro">В RESET ты отметил '+members[0][2]+' из '+members[0][3]+' запланированных дней. Где тебе пригодится поддержка в следующие четыре недели?</p>'+
      (state.enrolled?'':'<div class="lc-tabs" aria-label="Что было трудно в RESET">'+Object.entries(goals).map(([id,goal])=>'<button data-a="life-goal:'+id+'" aria-pressed="'+(id===state.goal)+'">'+e(goal.label)+'</button>').join('')+'</div>')+
      '<div class="lc-report">'+label('Твоя следующая цель')+'<h3>'+e(goals[state.goal].aim)+'</h3><p>'+e(goals[state.goal].plan)+'</p></div>'+
      '<div class="lc-price"><strong>'+num(price)+' ₽</strong><span>28 дней · разовая оплата</span></div>'+
      muted('Учебный набор. Дату и состав специалистов подтверждают до реальной продажи.')+
      (next?'<div class="order-state">'+label('Учебный заказ · '+next.ref)+'<h3>'+(next.refunded_at?'Возвращено ':'Оплачено ')+num(next.price)+' ₽</h3></div>'+(next.refunded_at?'':b('Оформить возврат второго сезона','renewal-review','textbtn full'))+b('Вернуться к истории','go:season-story','btn full'):state.enrolled?'<p role="status">Второй сезон выбран в демонстрации.</p>'+b('Вернуться к истории','go:season-story','btn full'):
        b('Выбрать в демо за '+num(price)+' ₽','life-enroll','btn full'))+
      choose('Пока продолжить бесплатно','go:arena','swords')+'</div>';
  }
  const summary = (member,role) => {
    const focus=role==='train'?'вариант занятия':'вариант ужина';
    return 'В этом сезоне отмечено '+member[2]+' из '+member[3]+' запланированных дней. На разборе можно обсудить, какой '+focus+' подходит при смене расписания.';
  };
  function desk() {
    const state=get(), role=state.role;
    const open=queue(state).filter(x=>x.role===role&&!state.answers[x.id]);
    const drafts=members.filter(m=>Object.hasOwn(state.drafts,reportId(role,m[0]))&&!state.published[reportId(role,m[0])]);
    const approved=members.filter(m=>state.published[reportId(role,m[0])]);
    const complete=members.reduce((n,m)=>n+m[2],0), target=members.reduce((n,m)=>n+m[3],0);
    const estimate=members.length*price*(1-.03)*.7/2;
    return '<div class="lc">'+head('Рабочий кабинет','ritm. expert · учебная лига')+
      '<div class="lc-tabs" aria-label="Роль специалиста">'+Object.entries(roles).map(([k,t])=>'<button aria-pressed="'+(role===k)+'" data-a="life-role:'+k+'">'+e(t)+'</button>').join('')+'</div>'+
      '<div class="lc-figures">'+[['Участники',members.length],['Ждут ответа',open.length],['Выполнение плана',Math.round(100*complete/target)+'%'],['За сезон¹',num(Math.round(estimate))+' ₽']].map(([t,n])=>'<div><small>'+t+'</small><strong>'+n+'</strong></div>').join('')+'</div>'+
      '<h2>Требуют внимания</h2>'+ (open.map(x=>choose(memberName(members.find(m=>m[0]===x.member))+' · '+x.subject,'life-open:'+x.id,'message-circle')).join('')||muted('Все обращения этой роли разобраны.'))+
      '<section class="lc-report">'+label('Помощник · демо по правилам')+'<h3>Отчёты участников</h3><p>На проверке '+drafts.length+' · утверждено '+approved.length+' из '+members.length+'</p>'+
      (drafts.length+approved.length<members.length?b('Подготовить черновики','life-generate','linebtn full'):'')+'</section>'+
      drafts.map(m=>choose(memberName(m)+' · проверить отчёт','life-report:'+m[0],'list-checks')).join('')+
      (approved.length?'<details><summary>Утверждённые отчёты · '+approved.length+'</summary>'+approved.map(m=>choose(memberName(m),'life-report:'+m[0],'check')).join('')+'</details>':'')+
      (hasSeat()?choose('Вернуться к своему сезону','go:league-support','arrow-right'):'')+
      muted('¹ Расчёт при полной учебной группе, возвратах 3% и равном разделе экспертного фонда. Фактических начислений нет.')+'</div>';
  }
  function review(id) {
    const state=get(), role=state.role;
    const request=queue(state).find(x=>x.id===id&&x.role===role);
    const member=members.find(m=>m[0]===(request?.member||id));
    if(!member)return desk();
    const rid=reportId(role,id);
    const published=request ? state.answers[id] : state.published[rid];
    const draft=request ? (state.drafts['reply-'+id]||'') : state.drafts[rid];
    if(!request && !published && draft===undefined)return desk();
    const title=request?request.subject:'Итоговый отчёт';
    return '<div class="lc">'+head(memberName(member),roles[role]+' · учебная лига')+'<h2>'+e(title)+'</h2>'+
      muted('Дни с отметкой по личному плану: '+member[2]+' из '+member[3]+'.')+
      (published?'<div class="lc-report">'+label('Утверждено специалистом')+'<p>'+e(published)+'</p></div>':
        '<label for="lc-editor">'+(request?'Ответ участнику':'Черновик для проверки')+'</label><textarea id="lc-editor" rows="6" maxlength="1600">'+e(draft)+'</textarea>'+
        b(request?'Сохранить ответ в демо':'Утвердить для участника','life-approve:'+id,'btn full'))+
      choose('К очереди специалиста','go:league-desk','list-checks')+'</div>';
  }
  function handle(cmd,id) {
    const s=get();
    if(cmd==='life-ask'&&Object.hasOwn(roles,id)&&hasSeat()){
      const subject=document.getElementById('lc-question')?.value.trim();
      if(!subject)throw Error('Напиши, в чём нужна помощь.');
      s.questions.push({id:'q-'+Array.from(crypto.getRandomValues(new Uint32Array(3))).join('-'),role:id,member:'self',subject:subject.slice(0,320)});
      s.role=id;store(s);draw();return;
    }
    if(cmd==='life-goal'&&!s.enrolled&&Object.hasOwn(goals,id)){s.goal=id;store(s);draw();return;}
    if(cmd==='life-enroll'){s.enrolled=true;store(s);route('season-story');return;}
    if(cmd==='life-role'&&Object.hasOwn(roles,id)){s.role=id;store(s);draw();return;}
    if(cmd==='life-open'||cmd==='life-report'){route('league-review',id);return;}
    if(cmd==='life-generate'){
      for(const m of members){
        const rid=reportId(s.role,m[0]);
        if(!Object.hasOwn(s.drafts,rid)&&!s.published[rid])s.drafts[rid]=summary(m,s.role);
      }
      store(s);draw();return;
    }
    if(cmd==='life-approve'){
      const text=document.getElementById('lc-editor')?.value.trim();
      if(!text)throw Error('Добавьте текст перед подтверждением.');
      const request=queue(s).find(x=>x.id===id&&x.role===s.role);
      if(request)s.answers[id]=text;
      else {
        const rid=reportId(s.role,id);
        if(!Object.hasOwn(s.drafts,rid)||s.published[rid])return;
        s.published[rid]=text;
      }
      store(s);route('league-desk');
    }
  }
  function edit(id,value) {
    const s=get();
    const request=queue(s).find(x=>x.id===id&&x.role===s.role);
    const rid=request?'reply-'+id:reportId(s.role,id);
    s.drafts[rid]=value;store(s);
  }
  return {journey, offer, desk, review, support, handle, edit};
};
