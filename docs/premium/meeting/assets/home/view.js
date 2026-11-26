/* Home uses the pilot's private activity history and membership-filtered PULSE snapshot. */
window.RitmHome = (() => {
  const portraits = Object.freeze({
    "demo-owner": "sasha", "demo-friend": "lena", "demo-max": "max", "demo-masha": "masha"
  });
  const weekLabels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const words = {move:"тренировка", walk:"прогулка", food:"питание"};
  const image = (name, className="") => '<img class="'+className+'" src="assets/home/'+name+'-small.webp?v=1" alt="" draggable="false">';
  const calendarDay = iso => new Date(iso+"T12:00:00Z");
  function week(s, weekly) {
    if (s.season || !s.home_plan?.length) {
      const w = weekly();
      return {percent:w.percent, caption:w.total+" из "+w.target+" дней по плану", days:w.days.map((date,i)=>({date,level:w.counts[i]?1:0}))};
    }
    const marks = new Set(s.history.map(a=>a.day+"|"+a.kind));
    let done=0, target=0;
    const days=s.home_plan.map(day=>{
      const n=day.kinds.filter(kind=>marks.has(day.date+"|"+kind)).length;
      target+=day.kinds.length;
      done+=n;
      return {date:day.date,level:day.kinds.length?n/day.kinds.length:0};
    });
    return {percent:Math.round(100*done/Math.max(1,target)), caption:done+" из "+target+" действий",days};
  }
  function people(s) {
    const list=new Map();
    for(const member of s.pulse){
      if(member.person===s.profile.id) continue;
      const prev=list.get(member.person);
      if(!prev || (member.at||0)>(prev.at||0)) list.set(member.person,member);
    }
    return [...list.values()].sort((a,b)=>(b.at||0)-(a.at||0));
  }
  function portrait(person, demo, escape) {
    if(demo && portraits[person.person]) return image(portraits[person.person]);
    return '<span class="home-initial">'+escape((person.name||"У")[0].toUpperCase())+'</span>';
  }
  function header(s, {I,e,demo}) {
    return '<div class="home-brand"><button data-a="go:today" aria-label="Сегодня, RITM" class="home-wordmark">ritm.</button>'+
      (demo?'<button class="home-demo" data-a="demomenu" aria-label="Настройки демонстрации">Premium Preview</button>':'')+
      '</div><div class="home-tools"><button class="home-icon" data-a="go:notifications" aria-label="Уведомления">'+I('bell',21)+'</button>'+
      '<button class="home-avatar-button" data-a="go:profile" aria-label="Мой профиль"><span class="user-photo">'+portrait({person:s.profile.id,name:s.profile.name},demo,e)+'</span></button></div>';
  }
  function ring(value) {
    return '<svg viewBox="0 0 104 104" class="home-ring" aria-hidden="true"><circle class="track" cx="52" cy="52" r="46"/><circle class="progress" cx="52" cy="52" r="46" pathLength="100" stroke-dasharray="'+value+' 100" transform="rotate(-90 52 52)"/><circle class="inner" cx="52" cy="52" r="35"/><path d="M28 54h13l7-17 11 32 7-15h12"/></svg>';
  }
  function summary(s, helpers) {
    const w=week(s,helpers.weekly);
    const bars=w.days.map(({date,level})=>{
      const label=weekLabels[calendarDay(date).getUTCDay()];
      return '<span aria-label="'+date+', '+Math.round(level*100)+'%"><i style="--fill:'+Math.round(level*100)+'%"></i><small>'+label+'</small></span>';
    }).join("");
    return '<button class="home-week" data-a="homeplan" aria-label="Мой план недели, '+w.percent+' процентов. '+w.caption+'"><span class="week-values"><span class="home-eyebrow">Твоя неделя</span><strong>'+w.percent+'<em>%</em></strong><span class="week-caption">'+w.caption+'</span><span class="day-bars">'+bars+'</span></span>'+ring(w.percent)+'</button>';
  }
  function circle(s,helpers) {
    const {I,e,demo}=helpers;
    const members=people(s).slice(0,3);
    const faces=members.map((p,i)=>{
      const active=Boolean(p.count||p.source);
      const status=i===0&&p.source&&!p.answered?'Импульс':p.count?'Готово':p.source?'Вчера':'В круге';
      return '<button class="home-member" data-a="homeperson:'+e(p.person)+'" aria-label="'+e((p.name||'Участник')+', '+status)+'"><span class="face-ring '+(active?'lit':'')+'">'+portrait(p,demo,e)+'</span><b>'+e(p.name||'Участник')+'</b><small>'+status+'</small></button>';
    }).join("");
    return '<section class="home-circle"><div class="home-section-head"><h2>Твой круг</h2><button data-a="go:pulse">Все '+I('arrow-up-right',13)+'</button></div><div class="home-people">'+faces+'<button class="home-member invite" data-a="homeinvite"><span class="face-ring">'+I('plus',22)+'</span><b>Позвать</b><small>друга</small></button></div></section>';
  }
  function relative(at,now) {
    const minutes=Math.max(0,Math.floor((now-at)/60));
    if(!minutes) return "только что";
    return minutes<60?minutes+" мин назад":Math.floor(minutes/60)+" ч назад";
  }
  function pulse(s,{I,e,incoming,demo}) {
    const p=incoming();
    let title="Поделись своим делом.", status="Твой круг", stamp="Твой круг", cmd="action:move", cta="Начать";
    if(p){
      const name=p.name||"Участник";
      const forms={move:"закончила тренировку.",food:"приготовила блюдо.",walk:"завершила прогулку."};
      title=demo&&["demo-friend","demo-masha"].includes(p.person)?name+" "+forms[p.kind]:name+" · "+(words[p.kind]||"новое действие")+".";
      status="Твой ход.";stamp=relative(p.at,s.server_time);cmd="respond";cta="Ответить";
    } else if(s.feed?.some(x=>x.person===s.profile.id)){
      title="Твоё дело в ленте круга.";status="Движение продолжается.";stamp="Круг";cmd="go:pulse";cta="В круг";
    }
    return '<section class="home-pulse"><div class="pulse-stamp">'+RitmVisual.pulseTrace+I('zap',16)+'<span>PULSE / '+e(stamp)+'</span></div><h2>'+e(title)+'</h2><div class="pulse-foot"><span>'+status+'</span><button data-a="'+cmd+'">'+cta+' '+I('arrow-up-right',14)+'</button></div></section>';
  }
  function row(code,title,duration,img,link,{I,e}) {
    return '<button class="home-plan-row" data-a="'+link+'">'+image(img,"row-photo")+'<span class="row-text"><small>'+code+'</small><b>'+title+'</b><span>'+e(duration)+'</span></span>'+I("arrow-up-right",15)+'</button>';
  }
  function render(s,helpers){
    const {time,dinner}=helpers;
    const date=calendarDay(s.day).toLocaleDateString('ru-RU',{weekday:'short',timeZone:'UTC'}).toUpperCase()+' / '+calendarDay(s.day).toLocaleDateString('ru-RU',{month:'short',day:'numeric',timeZone:'UTC'}).replace(/\.$/,'').toUpperCase();
    const foodTime=dinner?dinner.mins+' мин':'Выбрать продукты';
    return '<div class="home-content"><div class="home-title"><time datetime="'+s.day+'">'+date+'</time><h1>В своём ритме.</h1></div>'+helpers.personal+summary(s,helpers)+
      '<section class="home-agenda"><div class="agenda-top"><h2>План на сегодня</h2><button class="quick-time" data-a="quicktime" aria-label="Изменить доступное время">'+time+' мин '+helpers.I('chevron-down',14)+'</button></div>'+
      row('Тренировки','Выбрать занятие',time+' мин','training','go:train',helpers)+row('Питание',dinner?dinner.name:'Выбрать ужин',foodTime,'dinner','go:food',helpers)+'</section>'+
      (people(s).length?pulse(s,helpers)+circle(s,helpers):'<button class="linebtn full" data-a="go:pulse">Пригласить друга</button>')+'</div>';
  }
  return {header,render,people,relative,week,ring,summary,pulse,portrait};
})();
