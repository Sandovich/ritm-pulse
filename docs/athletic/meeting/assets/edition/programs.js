/* Self-guided programs point to the same recipes, workouts and activity records as Today. */
const SoloPlans = {
  studio: {title:'Движение дома', photo:'edition/mobility', goal:'Регулярность тренировок',
    note:'Разминка без инвентаря', action:'Открыть занятие дома',
    steps:['Освободи место для знакомой разминки.', 'Открой занятие и выбери удобный отрезок времени.', 'Запиши занятие. Три разных дня движения завершат программу.']},
  walk: {title:'Начать гулять', photo:'track', goal:'Больше движения',
    note:'Прогулки в своём темпе', action:'Открыть прогулку',
    steps:['Выбери короткий маршрут от дома или работы.', 'Возьми телефон и пройдись в удобном темпе.', 'Запиши прогулку. Цель программы — выйти на прогулку в три разных дня.']},
  kitchen: {title:'Готовлю для себя', photo:'edition/salad', goal:'Питание в будни',
    note:'Простые блюда на одну порцию', action:'Выбрать рецепт',
    steps:['Выбери блюдо и проверь, какие ингредиенты уже дома.', 'Оставь одну порцию или измени количество в рецепте.', 'После готовки отметь блюдо. Для завершения нужны три разных дня.']},
  strength: {title:'Силовой старт', photo:'edition/strength', goal:'Стать сильнее',
    note:'Знакомые упражнения с инвентарём', action:'Открыть силовое занятие',
    steps:['Подготовь инвентарь для освоенного упражнения.', 'Открой силовой блок и выполни занятие по своему плану.', 'Запиши подходы и повторы. Программа завершится после трёх тренировочных дней.']}
};

const plusMonthlyRubles = 990;

function createProgramViews({state,photo,I,b,e,label,head,num}) {
  const current = () => Object.keys(SoloPlans).find(id=>state().solo?.[id]?.selected);
  const recommended = () => Object.keys(SoloPlans).find(id=>SoloPlans[id].goal===state().dna?.goal) || 'studio';

  function row(action, title, note, image) {
    return '<button class="program-row" data-a="'+e(action)+'">'+photo(image,'','program-thumb')+
      '<span><strong>'+e(title)+'</strong><small>'+e(note)+'</small></span>'+I('chevron-right',17)+'</button>';
  }
  function plusCard() {
    const saved=state().interest?.includes('platform:plus990');
    return '<button type="button" class="plus-card" data-a="go:plus"><span><small>RITM PLUS</small><strong>Самостоятельно</strong>'+
      '<span>'+ (saved?'Интерес сохранён':'Программы, рецепты и дневник') +'</span></span>'+
      '<b>'+num(plusMonthlyRubles)+' ₽<small>в месяц</small></b>'+I('chevron-right',16)+'</button>';
  }
  function plus() {
    const saved=state().interest?.includes('platform:plus990');
    const features=[
      ['utensils','Рецепты и список покупок','Подбор блюд на неделю с учётом бюджета и продуктов дома.'],
      ['dumbbell','Программы для дома и зала','Варианты занятий под свободное время и доступный инвентарь.'],
      ['activity','Личный прогресс','Сводка по неделям покажет, как часто удавалось придерживаться плана.']
    ];
    return head('RITM PLUS','Подписка для одного')+
      '<p class="plus-price"><strong>'+num(plusMonthlyRubles)+' ₽</strong> в месяц</p>'+
      '<p class="program-note">Тестовая цена для одного человека. Занимаешься самостоятельно, в своём темпе.</p>'+
      '<h2>Что планируем включить</h2>'+features.map(([icon,title,desc])=>
        '<div class="plus-feature">'+I(icon,20)+'<div><strong>'+e(title)+'</strong><small>'+e(desc)+'</small></div></div>').join('')+
      '<p class="program-note">Тариф готовится к запуску. Сейчас можно отметить интерес к этой цене. Оплаты и автопродления пока нет.</p>'+
      (saved?'<p class="plus-saved" role="status">'+I('check',18)+'Интерес к тарифу сохранён</p>':
        b('Мне подходит за '+num(plusMonthlyRubles)+' ₽ в месяц','interest:platform:plus990','btn full'))+
      b('Личный тренер · '+num(Catalog.TRAIN.price)+' ₽ за 28 дней','product:TRAIN','linebtn full','dumbbell')+
      b('Личный нутрициолог · '+num(Catalog.NUTRI.price)+' ₽ за 28 дней','product:NUTRI','linebtn full','utensils')+
      b('Посмотреть сезон FOOD 28','product:FOOD','textbtn full');
  }
  const filters={format:'Все',goal:'Все',level:'Все',price:'Все'};
  const facets={
    format:['Все','Самостоятельно','В группе','С экспертом','Для двоих'],
    goal:['Все','Движение','Питание'],level:['Все','Для старта','С опытом','По согласованию'],
    price:['Все','Бесплатно','До 3 500 ₽','От 3 501 ₽']
  };
  function filter(key,value) {
    if(key==='reset'){Object.keys(filters).forEach(k=>filters[k]='Все');return;}
    if(facets[key]?.includes(value))filters[key]=value;
  }
  function active(){
    const s=state(), order=s.booking;
    const paid=order && order.paid_kopeks>order.refunded_kopeks && Catalog[order.sku];
    return (paid?row(order.sku==='RESET'?'go:league-support':'product:'+order.sku,order.sku==='RESET'?'RESET LEAGUE':Catalog[order.sku].title,'Моя программа · открыть',Catalog[order.sku].pic):'')+home();
  }
  function resetCover(){
    return '<button class="ath-cover catalog-item" data-a="product:RESET">'+photo('edition/strength','')+'<span class="ath-copy">'+label('Авторский сезон / в группе')+'<strong>RESET LEAGUE</strong><span>Выстрой режим тренировок и питания с тренером и нутрициологом.</span><span class="ath-price">28 дней<b>'+num(Catalog.RESET.price)+' ₽</b></span></span></button>';
  }
  function list(){
    const offers=[['RESET','RESET LEAGUE','В группе',['Движение','Питание']],['FOOD','FOOD 28','В группе',['Питание']],['TRAIN','Личный тренер','С экспертом',['Движение']],['NUTRI','Личный нутрициолог','С экспертом',['Питание']],['DUO','DUO 28','Для двоих',['Движение','Питание']]];
    const entries=offers.map(([id,title,format,goals])=>{
      const x=Catalog[id];
      const benefit={TRAIN:'Личный план и четыре разбора',NUTRI:'Дневник питания и четыре разбора',RESET:'Тренировки и питание в лиге до 10 человек',FOOD:'Меню и разбор питания в группе',DUO:'Два личных плана и общие задания'}[id];
      return {title,format,goals,price:x.price,who:x.who,level:'По согласованию',term:'28 дней',note:benefit,img:x.pic,action:'product:'+id};
    });
    entries.splice(1,0,...Object.entries(SoloPlans).map(([id,x])=>({title:x.title,format:'Самостоятельно',goals:[id==='kitchen'?'Питание':'Движение'],price:0,who:'Каталог RITM',level:id==='strength'?'С опытом':'Для старта',term:'3 дня с отметкой',note:x.note,img:x.photo,action:'solo:'+id})));
    entries.push({title:'RITM PLUS',format:'Самостоятельно',goals:['Движение','Питание'],price:plusMonthlyRubles,who:'RITM',level:'Для старта',term:'в месяц · сбор интереса',note:'Самостоятельные программы, рецепты и дневник',img:'edition/mobility',action:'go:plus'});
    const matches=entries.filter(x=>(filters.format==='Все'||filters.format===x.format)&&(filters.goal==='Все'||x.goals.includes(filters.goal))&&(filters.level==='Все'||x.level===filters.level)&&(filters.price==='Все'||(filters.price==='Бесплатно'?x.price===0:filters.price==='До 3 500 ₽'?x.price>0&&x.price<=3500:x.price>3500)));
    const selector=(k,t)=>'<label>'+t+'<select data-catalog="'+k+'">'+facets[k].map(v=>'<option'+(filters[k]===v?' selected':'')+'>'+e(v)+'</option>').join('')+'</select></label>';
    const quick=['Все','Бесплатные','Самостоятельно','В группе','С экспертом'];
    const card=x=>'<button class="catalog-item program-row" data-a="'+x.action+'">'+photo(x.img,'','catalog-photo')+'<span><strong>'+e(x.title)+'</strong><small>'+e(x.format)+' · '+e(x.note)+' · '+e(x.term)+'</small><b>'+(x.price?num(x.price)+' ₽':'Бесплатно')+'</b></span></button>';
    const group=(title,items,cls='')=>items.length?'<section class="catalog-section"><h2>'+title+'</h2><div class="'+cls+'">'+items.map(card).join('')+'</div></section>':'';
    const flagship=matches.find(x=>x.action==='product:RESET');
    const season=flagship?resetCover():'';
    return head('Программы.')+active()+'<details class="catalog-filters" '+(Object.values(filters).some(v=>v!=='Все')?'open':'')+'><summary>Подобрать по фильтрам</summary><div class="catalog-tabs">'+quick.map(v=>{
      const on=v==='Все'?Object.values(filters).every(f=>f==='Все'):v==='Бесплатные'?filters.price==='Бесплатно':filters.format===v;
      return '<button data-a="catalog-quick:'+v+'" aria-pressed="'+on+'">'+v+'</button>';
    }).join('')+'</div><div>'+selector('goal','Цель')+selector('format','Формат')+selector('level','Подготовка')+selector('price','Цена')+'</div></details>'+
    season+group('Авторские программы',matches.filter(x=>x.action==='product:FOOD'),'ath-food')+
    group('Самостоятельно',matches.filter(x=>x.action==='solo:studio'||x.action==='go:plus'),'ath-options')+
    group('Личное сопровождение',matches.filter(x=>x.format==='С экспертом'),'ath-experts')+
    group('Для двоих',matches.filter(x=>x.action==='product:DUO'),'ath-food')+
    group('Ещё бесплатно',matches.filter(x=>x.price===0&&x.action!=='solo:studio'))+
    (!matches.length?mutedEmpty():'')+b('Консультации специалистов','go:experts','textbtn full');
  }
  function mutedEmpty(){return '<p>По этим условиям программ пока нет.</p>'+b('Сбросить фильтры','catalog-quick:Все','linebtn');}

  function detail(id) {
    const x=SoloPlans[id];if(!x)return list();
    const status=state().solo?.[id], days=status?.days||0;
    return '<div class="solo-cover">'+photo(x.photo,'')+'</div>'+label('Личная программа · бесплатно')+head(x.title)+
      '<p class="program-note">'+e(x.note)+'. Три дня в своём темпе.</p>'+
      (state().dna?.minutes?'<p class="solo-context">'+e(state().dna.minutes)+' мин в день'+(state().dna.place&&id!=='kitchen'?' · '+e(state().dna.place):'')+'</p>':'')+
      (status?'<div class="solo-progress"><b>'+ (days===3?'Программа пройдена':'Дней с отметкой')+'</b><span>'+days+' / 3</span></div>':'')+
      b(status?.selected?x.action:'Начать программу',status?.selected?'solo-next:'+id:'solo-start:'+id,'btn full','arrow-right')+
      '<h2>Как проходить</h2><ol class="steps">'+x.steps.map(s=>'<li>'+e(s)+'</li>').join('')+'</ol>'+
      b('Изменить ответы','start','textbtn full')+b('Посмотреть все программы','go:store','linebtn full','book-open');
  }
  function home() {
    const id=current();
    if(id){const progress=state().solo[id];return row('solo:'+id,SoloPlans[id].title,'Моя программа · '+progress.days+' из 3 дней',SoloPlans[id].photo);}
    return '';
  }
  return {resetCover,list,detail,plus,home,current,recommended,active,filter};
}

