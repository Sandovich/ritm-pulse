'use strict';

window.RitmChoice = function ({state, write, route, draw, notice, e, b, I, face, label, demo, heartbeat}) {
  let draft = {options: [], minutes: 10, parent: null};
  let opened = null;
  let openedToken = '';
  let picked = '';
  let openError = '';
  let refreshedPush = false;
  const items = () => state().choices || [];
  const byId = id => items().find(item => item.id === id);
  const current = id => byId(id) || (opened?.id === id ? opened : null);
  const selected = item => item.options.find(option => option.id === item.selected);
  const minutesLabel = n => n + (n === 1 ? ' минута' : ' минут');
  const hasPush = () => !demo && state().push_key && window.isSecureContext &&
    'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  const button = (text, action, enabled) =>
    '<button type="button" class="btn full choice-submit" data-a="'+e(action)+'"'+(enabled?'':' disabled')+'>'+e(text)+'</button>';
  const demoNote = () => demo ? '<p class="hint choice-demo-note">Демо · оба участника в этом браузере.</p>' : '';
  function optionRow(option, on, action, disabled = false) {
    const icon = {walk:'footprints', food:'utensils', move:'activity'}[option.kind] || 'activity';
    const content = I(icon,22)+'<span><b>'+e(option.title)+'</b><small>'+e(option.description)+'</small></span>'+
      (action ? '<i class="choice-tick">'+(on?I('check',13):'')+'</i>' : '');
    return action ? '<button class="choice-option" type="button" data-a="'+e(action+':'+option.id)+'" aria-pressed="'+on+'"'+(disabled?' disabled':'')+'>'+content+'</button>' :
      '<div class="choice-option choice-result">'+content+'</div>';
  }
  function composer() {
    const options = state().choice_plan || [];
    return '<section class="choice-flow">'+label('PULSE / CHOICE')+
      '<h1>'+(draft.parent?'Теперь твой ход.':'Выбери мой ход.')+'</h1>'+
      '<p class="choice-lead">Выбери два дела, на которые у тебя сегодня есть силы. Друг решит, с какого начать.</p>'+
      '<h2>Сколько есть времени?</h2><div class="chips">'+[5,10,20,30,60].map(n=>b(n+' мин','choice-minutes:'+n,'chip '+(n===draft.minutes?'on':''))).join('')+
      '</div><div class="between"><h2>Дела из твоего плана</h2><small>'+draft.options.length+' из 2</small></div>'+
      '<div class="choice-options">'+options.map(option=>optionRow(option,draft.options.includes(option.id),'choice-option',draft.options.length===2&&!draft.options.includes(option.id))).join('')+'</div>'+
      (!options.length?'<p class="hint">В плане пока нет доступных действий.</p>':'')+
      button(draft.parent?'Передать выбор другу':'Создать приглашение','choice-create',draft.options.length===2)+demoNote()+'</section>';
  }
  function status(item) {
    if (item.completed) return item.role==='owner'?'Ты выполнил свой ход':'Ход выполнен';
    if (item.expired) return 'Время хода вышло';
    if (item.selected) return item.role==='owner'?'Друг сделал выбор':'Твой выбор принят';
    return item.role==='owner'?'Ждём выбора друга':'Выбери ход друга';
  }
  function noticeRows() {
    return items().filter(item => !item.expired && (
      item.role==='voter' && item.completed || item.role==='owner' && item.selected && !item.completed ||
      item.role==='guest' && item.target && !item.selected
    )).map(item => [status(item),selected(item)?.title || (item.name||'Друг')+' предлагает поменяться ролями','choice-open:'+item.id]);
  }
  function modeMenu(hasReply) {
    const modes = [
      ['choice-new','hand-heart','CHOICE','Выбери мой ход'],
      ['pulse-reply','zap','REPLY',hasReply?'Ответить своим делом':'Ответы друзей'],
      ['setup:duel','swords','DUEL','Дуэль на неделю'],
      ['together','users','TOGETHER','Вместе по времени']
    ];
    return '<div class="choice-modes">'+modes.map(([action,icon,cap,title])=>
      '<button type="button" data-a="'+e(action)+'">'+I(icon,19)+'<span><small>'+cap+'</small><b>'+title+'</b></span></button>').join('')+'</div>'+
      (items().length?'<section class="choice-history"><h2>Ваши ходы</h2>'+items().map(item=>
        '<button type="button" data-a="choice-open:'+e(item.id)+'">'+I(item.completed?'check-check':'circle-dot',18)+'<span><b>'+e(status(item))+'</b><small>'+
        e(selected(item)?.title || item.options.map(x=>x.title).join(' / '))+'</small></span>'+I('chevron-right',17)+'</button>').join('')+'</section>':'');
  }
  function participantAddress(id) {
    const url=new URL(location.href);
    for(const name of ['invite','choice','choiceId','feature']) url.searchParams.delete(name);
    if(id) url.searchParams.set('choice_result',id);
    else url.searchParams.delete('choice_result');
    history.replaceState(null,'',url);
  }
  function focusAction(action) {
    const target=Array.from(document.querySelectorAll('[data-a]')).find(el=>el.dataset.a===action);
    target?.focus({preventScroll:true});
  }
  function linkFor(item, asOther = false) {
    const url = demo && asOther ? new URL(window.ritmDemo.openFriend(),location.href) : new URL(location.href);
    for (const key of ['invite','choice','choiceId','choice_result','screen','feature','channel']) url.searchParams.delete(key);
    url.hash = '';
    if (item.token && !item.selected && item.role==='owner') url.searchParams.set('choice', item.token);
    else url.searchParams.set('choice_result', item.id);
    return url.href;
  }
  function showPush() {
    return hasPush() && !refreshedPush && Notification.permission!=='denied' ?
      b('Уведомить меня о ходе','pushon','linebtn full','bell') : '';
  }
  function detail(id) {
    const item = current(id);
    if (!item) return '<section class="choice-flow">'+label('PULSE / CHOICE')+'<h1>Ход недоступен</h1><p class="muted">'+e(openError||'Открой первоначальное приглашение на устройстве участника.')+'</p>'+b('К PULSE','go:pulse','linebtn')+'</section>';
    const owner=item.role==='owner', voter=item.role==='voter', chosen=selected(item);
    const sender = item.name||'Друг';
    let body;
    if (item.completed) {
      const child=items().find(x=>x.parent===item.id);
      body='<h1>Ход выполнен.</h1>'+(chosen?optionRow(chosen,false):'')+'<p class="choice-lead">'+(owner?'Друг увидит, какое дело ты сделал.':'Теперь можно поменяться ролями. Предложи свои два дела другу.')+'</p>'+
        (child?b('Открыть ответный ход','choice-open:'+child.id,'btn full','repeat-2'):voter?b('Поменяться ролями','choice-swap','btn full','repeat-2'):'');
    } else if (item.expired) {
      body='<h1>Время хода вышло.</h1><p class="choice-lead">Можно выбрать новые дела, когда будет удобно.</p>'+b('Начать новый ход','choice-new','linebtn full');
    } else if (chosen) {
      body='<h1>'+(owner?'Друг выбрал твой ход.':'Ты выбрал ход.')+'</h1>'+optionRow(chosen,false)+
        '<p class="choice-lead">'+(owner?'Отметь ход, когда закончишь. Друг увидит результат.':'Результат появится здесь, когда друг отметит выполнение.')+'</p>'+
        (owner?b('Я выполнил этот ход','choice-complete','btn full','check'):showPush());
    } else if (owner) {
      body='<h1>'+(item.parent?'Ответный ход готов.':'Приглашение готово.')+'</h1><p class="choice-lead">'+
        (item.parent?'Теперь друг может выбрать одно из твоих дел.':'Отправь ссылку одному другу. Выбрать дело можно в течение суток.')+'</p>'+
        '<div class="choice-options">'+item.options.map(option=>optionRow(option,false)).join('')+'</div>';
      if (!demo && item.token) body+='<label class="choice-link">Ссылка другу<input id="choice-url" value="'+e(linkFor(item))+'" readonly></label>'+
        (navigator.share?b('Поделиться приглашением','choice-share','btn full','share-2'):'')+
        b('Скопировать ссылку','choice-copy',navigator.share?'linebtn full':'btn full','link');
    } else {
      body='<div class="choice-sender">'+face({id:item.owner||(demo?(window.ritmDemo.actor==='friend'?'demo-owner':'demo-friend'):null),name:sender})+'<div><b>'+e(sender)+'</b><small>Просит тебя выбрать ход</small></div></div>'+
        '<h1>У меня есть '+e(minutesLabel(item.minutes))+'.</h1><p class="choice-question">Что мне сегодня сделать?</p>'+
        '<div class="choice-options">'+item.options.map(opt=>optionRow(opt,opt.id===picked,'choice-pick')).join('')+'</div>'+
        button('Выбрать ход','choice-vote',item.options.some(opt=>opt.id===picked))+'<p class="hint">Можно выбрать без регистрации.</p>';
    }
    if (demo && (owner || voter)) {
      body+=b(owner?'Открыть за друга':'Открыть за автора','choice-demo',!item.selected&&owner?'btn full':'linebtn full','users');
    }
    return '<section class="choice-flow">'+label('PULSE / CHOICE')+body+demoNote()+'</section>';
  }
  function remember(item, token = '') {
    opened = item; openedToken = token || item.token || ''; picked = ''; openError = '';
  }
  async function initialize(query) {
    const token=query.get('choice'), id=query.get('choice_result')||query.get('choiceId');
    if (!token && !id) return false;
    try {
      const item=token?(await write('choice_open',{token})).choice:byId(id);
      if (!item) throw Error('Открой ссылку в браузере, где ты участвовал в этом ходе.');
      remember(item,token); route('choice',item.id,false);
    } catch(err) {
      opened=null; openedToken=''; openError=err.message; route('choice','',false);
    }
    return true;
  }
  function start(parent = null) {
    if (draft.parent!==parent) draft = {options:[], minutes:10, parent};
    route('choice-compose');
  }
  function openById(id) {
    const item=byId(id);
    if (!item) throw Error('Ход уже недоступен.');
    remember(item); participantAddress(id); route('choice', id);
  }
  async function handle(cmd, v, id) {
    const item=current(id);
    switch (cmd) {
      case 'choice-new':start();return;
      case 'choice-minutes':
        if ([5,10,20,30,60].includes(Number(v))) draft.minutes=Number(v);
        draw();focusAction('choice-minutes:'+v);return;
      case 'choice-option':
        if (!state().choice_plan.some(opt=>opt.id===v)) return;
        if (draft.options.includes(v)) draft.options=draft.options.filter(opt=>opt!==v);
        else if (draft.options.length<2) draft.options.push(v);
        draw();focusAction('choice-option:'+v);return;
      case 'choice-create': {
        if (draft.options.length!==2) return;
        const result=await write('choice_create',{options:draft.options,minutes:draft.minutes,...(draft.parent?{parent:draft.parent}:{})});
        draft={options:[],minutes:10,parent:null};
        remember(result.choice);participantAddress(opened.id);route('choice',opened.id);heartbeat();return;
      }
      case 'choice-open':openById(v);return;
    }
    if (!item) throw Error('Этот ход уже закрыт.');
    switch (cmd) {
      case 'choice-pick':if(item.options.some(opt=>opt.id===v)) picked=v;draw();focusAction('choice-pick:'+v);return;
      case 'choice-vote': {
        if (!picked) return;
        const result=await write('choice_vote',{token:item.token||openedToken,option:picked});
        remember(result.choice,item.token||openedToken);participantAddress(opened.id);heartbeat();draw();return;
      }
      case 'choice-complete': {
        const result=await write('choice_complete',{id:item.id});
        remember(result.choice);heartbeat();draw();return;
      }
      case 'choice-swap':start(item.id);return;
      case 'choice-demo':if (demo) location.assign(linkFor(item,true));return;
      case 'choice-share':
      case 'choice-copy': {
        if (demo || !item.token || item.selected) return;
        const url=linkFor(item);
        if(cmd==='choice-share') {
          await navigator.share({title:'Выбери мой ход · RITM',url});
        } else {
          try { await navigator.clipboard.writeText(url); }
          catch { const input=document.querySelector('#choice-url');input?.focus();input?.select();notice('Выделенная ссылка готова для копирования.');return; }
        }
        await write('choice_share',{id:item.id,method:cmd==='choice-share'?'share':'copy'});
        notice(cmd==='choice-share'?'Приглашение передано.':'Ссылка скопирована.');return;
      }
    }
  }
  return {composer, detail, start, initialize, modeMenu, noticeRows, handle,
    isBallot(id) {const item=current(id);return item?.role==='guest'&&!item.selected&&!item.expired;},
    pushEnabled() {refreshedPush=true;}, clearAddress() {participantAddress(null);}};
};
