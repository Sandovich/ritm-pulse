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

const plusMonthlyRubles = 499;

function createProgramViews({state,photo,I,b,e,label,head,num}) {
  const current = () => Object.keys(SoloPlans).find(id=>state().solo?.[id]?.selected);
  const recommended = () => Object.keys(SoloPlans).find(id=>SoloPlans[id].goal===state().dna?.goal) || 'studio';

  function row(action, title, note, image) {
    return '<button class="program-row" data-a="'+e(action)+'">'+photo(image,'','program-thumb')+
      '<span><strong>'+e(title)+'</strong><small>'+e(note)+'</small></span>'+I('chevron-right',17)+'</button>';
  }
  function plusCard() {
    const saved=state().interest?.includes('platform:plus');
    return '<button type="button" class="plus-card" data-a="go:plus"><span><small>Подписка для одного</small><strong>RITM PLUS</strong>'+
      '<span>'+ (saved?'Интерес сохранён':'Питание, тренировки и личный прогресс') +'</span></span>'+
      '<b>'+num(plusMonthlyRubles)+' ₽<small>в месяц</small></b>'+I('chevron-right',16)+'</button>';
  }
  function plus() {
    const saved=state().interest?.includes('platform:plus');
    const features=[
      ['utensils','Меню для одного','Подбор блюд на неделю с учётом бюджета и продуктов дома.'],
      ['dumbbell','Тренировки по твоему графику','Варианты занятий под свободное время и доступный инвентарь.'],
      ['activity','Личный прогресс','Сводка по неделям покажет, как часто удавалось придерживаться плана.']
    ];
    return head('RITM PLUS','Подписка для одного')+
      '<p class="plus-price"><strong>'+num(plusMonthlyRubles)+' ₽</strong> в месяц</p>'+
      '<p class="program-note">Тестовая цена для одного человека. Занимаешься самостоятельно, в своём темпе.</p>'+
      '<h2>Что планируем включить</h2>'+features.map(([icon,title,desc])=>
        '<div class="plus-feature">'+I(icon,20)+'<div><strong>'+e(title)+'</strong><small>'+e(desc)+'</small></div></div>').join('')+
      '<p class="program-note">Тариф готовится к запуску. Сейчас можно отметить интерес к этой цене. Оплаты и автопродления пока нет.</p>'+
      (saved?'<p class="plus-saved" role="status">'+I('check',18)+'Интерес к тарифу сохранён</p>':
        b('Мне подходит за '+num(plusMonthlyRubles)+' ₽ в месяц','interest:platform:plus','btn full'))+
      b('Личный тренер · '+num(Catalog.TRAIN.price)+' ₽ за 28 дней','product:TRAIN','linebtn full','dumbbell')+
      b('Личный нутрициолог · '+num(Catalog.NUTRI.price)+' ₽ за 28 дней','product:NUTRI','linebtn full','utensils')+
      b('Посмотреть сезон FOOD 28','product:FOOD','textbtn full');
  }
  function list() {
    const preferred=current()||recommended();
    const ids=[preferred,...Object.keys(SoloPlans).filter(id=>id!==preferred)];
    const solo=ids.map(id=>{
      const x=SoloPlans[id], progress=state().solo?.[id];
      const note=progress?.selected?'Моя программа · '+progress.days+' из 3 дней':x.note;
      return row('solo:'+id,x.title,note,x.photo);
    }).join('');
    const order=(state().allocation?.ordering||'RESET,FOOD,DUO').split(',');
    const info={FOOD:'Для одного · нутрициолог',RESET:'В группе · тренер и нутрициолог',DUO:'Для двоих · общие задания'};
    const seasons=order.filter(k=>Object.hasOwn(Catalog,k)).map(k=>{
      const x=Catalog[k];return row('product:'+k,k==='RESET'?'RESET LEAGUE':k+' 28',info[k]+' · '+num(x.price)+' ₽',x.pic);
    }).join('');
    return head('Программы')+plusCard()+
      ['TRAIN','NUTRI'].map(k=>row('product:'+k,Catalog[k].title,'Один на один · 28 дней · '+num(Catalog[k].price)+' ₽',Catalog[k].pic)).join('')+'<div class="program-heading"><h2>Для одного</h2><span>Бесплатно</span></div>'+
      '<p class="program-note">Выбери занятие и проходи его в своём темпе. Приглашать друга не нужно.</p>'+solo+
      '<div class="program-heading"><h2>С экспертами</h2><span>28 дней</span></div>'+seasons+
      b('Индивидуальные консультации','go:experts','linebtn full','users')+b('Подстроить план','go:ai','textbtn','sliders-horizontal');
  }
  function detail(id) {
    const x=SoloPlans[id];if(!x)return list();
    const status=state().solo?.[id], days=status?.days||0;
    return '<div class="solo-cover">'+photo(x.photo,'')+'</div>'+label('Личная программа · бесплатно')+head(x.title)+
      '<p class="program-note">'+e(x.note)+'. Три дня в своём темпе.</p>'+
      (status?'<div class="solo-progress"><b>'+ (days===3?'Программа пройдена':'Дней с отметкой')+'</b><span>'+days+' / 3</span></div>':'')+
      b(status?.selected?x.action:'Начать программу',status?.selected?'solo-next:'+id:'solo-start:'+id,'btn full','arrow-right')+
      '<h2>Как проходить</h2><ol class="steps">'+x.steps.map(s=>'<li>'+e(s)+'</li>').join('')+'</ol>'+
      b('Посмотреть все программы','go:store','linebtn full','book-open');
  }
  function home() {
    const id=current();
    if(id){const progress=state().solo[id];return row('solo:'+id,SoloPlans[id].title,'Моя программа · '+progress.days+' из 3 дней',SoloPlans[id].photo);}
    return '';
  }
  return {list,detail,plus,home,current,recommended};
}

