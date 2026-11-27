function createJournal({state,write,route,draw,e,b,field,head,muted,read,save,nonce,notice}) {
  let metric='sets',exercise='',period=7, selected='', edit='', intakeDay='', ending=false;
  const number=n=>Number(n.toFixed(1)).toLocaleString('ru-RU');
  const labels={grams:'Порция, г',kcal:'ккал',protein:'Белки, г',fat:'Жиры, г',carbs:'Углеводы, г'};
  const macros=['kcal','protein','fat','carbs'];
  const active=()=>state().workouts.find(w=>w.status==='active');
  const numField=(id,name,value)=>field(id,name,value,'number','step="any" min="0" inputmode="decimal" required');
  const panel=(html)=>'<section class="journal-panel">'+html+'</section>';
  const title=(text,kicker)=>head(text,kicker);
  function train(){
    const w=active();
    if(!w)return title('Дневник тренировок','SMART TRAIN')+
      panel('<h2>Своя тренировка</h2>'+muted('Записывай выполненные подходы. Занятие можно закрыть и продолжить позже.')+field('jr-name','Название занятия','Моя тренировка')+'<label>Упражнения по порядку<textarea id="jr-plan" rows="3" placeholder="По одному упражнению на строку"></textarea></label>'+b('Начать занятие','jr-start','btn full','play'))+
      history();
    const last=w.sets.at(-1), draft=read('set-'+w.id)||{};
    const step=w.steps.find(s=>s.status==='next');
    const previous=state().workouts.filter(item=>item.id!==w.id).flatMap(item=>item.sets.slice().reverse()).find(s=>s.exercise===(step?.title||draft.title||last?.exercise));
    return title(w.title,'SMART TRAIN · В процессе')+
      '<div class="journal-count"><strong>'+w.sets.length+'</strong><span>подходов записано</span></div>'+
      (queue().length?b('Ожидают отправки: '+queue().length+' · Повторить','jr-sync','linebtn full'):'')+
      (step?'<h2>'+e(step.title)+'</h2>'+muted('Упражнение '+step.idx+' из '+w.steps.length):'')+
      (previous?muted('Предыдущее занятие · '+number(previous.kg)+' кг × '+previous.reps):'')+
      panel(field('jr-name','Упражнение',step?.title??draft.title??last?.exercise??'','text',step?'readonly':'')+
      '<div class="grid">'+numField('jr-kg','Рабочий вес, кг',draft.kg??last?.kg??0)+numField('jr-reps','Повторения',draft.reps??last?.reps??'')+'</div>'+
      numField('jr-rest','Отдых после подхода, с',draft.rest??90)+
      b('Записать подход','jr-set','btn full','check')+'<p id="jr-clock" aria-label="Отдых"></p>')+
      (step?b('Следующее упражнение','jr-next:done','linebtn')+b('Пропустить','jr-next:skipped','textbtn'):'')+
      w.sets.map(s=>'<p class="journal-row">Подход '+s.position+' · '+e(s.exercise)+' <b>'+number(s.kg)+' кг × '+s.reps+'</b></p>').join('')+
      (ending?panel('<h2>Завершить занятие?</h2>'+[['complete','Выполнено полностью'],['partial','Завершить частично'],['discard','Удалить это занятие'],['cancel','Продолжить']].map(([id,n])=>b(n,'jr-end:'+id,'linebtn full')).join('')):b('Завершить занятие','jr-finish','linebtn full'));
  }
  function history(){return (state().workouts||[]).filter(w=>w.status!=='active').map(w=>panel('<strong>'+e(w.title)+'</strong>'+muted(w.day+' · '+(w.status==='partial'?'Частично':'Завершено')+' · '+w.sets.length+' подходов')+w.sets.map(s=>'<p>'+e(s.exercise)+' · '+number(s.kg)+' кг × '+s.reps+'</p>').join(''))).join('');}
  function food(){
    intakeDay=intakeDay||state().day;
    const entries=state().food_log.filter(r=>r.day===intakeDay);
    const totals=macros.map(k=>entries.reduce((sum,r)=>sum+r[k]*r.grams/100,0));
    const macroEnergy=totals[1]*4+totals[2]*9+totals[3]*4;
    const proteinEnd=macroEnergy?totals[1]*400/macroEnergy:0;
    const fatEnd=macroEnergy?proteinEnd+totals[2]*900/macroEnergy:0;
    const ring=macroEnergy?'<span class="journal-ring" aria-hidden="true" style="background:conic-gradient(#d5fc53 0 '+proteinEnd+'%, #939e87 '+proteinEnd+'% '+fatEnd+'%, #f5f6f2 '+fatEnd+'% 100%)"></span>':'';
    const row=state().food_log.find(r=>r.id===edit)||{};
    const form=edit?panel('<h2>'+ (row.id?'Изменить запись':'Записать еду')+'</h2>'+field('jr-name','Блюдо или продукт',row.title||'')+numField('jr-grams',labels.grams,row.grams??'')+'<p>По этикетке на 100 г</p><div class="grid">'+macros.map(k=>numField('jr-'+k,labels[k],row[k]??'')).join('')+'</div>'+b('Сохранить','jr-food-save','btn full')+b('Отмена','jr-edit:','linebtn full')):'';
    return title('Дневник питания','SMART FOOD')+field('jr-date','День дневника',intakeDay,'date','max="'+state().day+'"')+
      '<div class="journal-count"><strong>'+number(totals[0])+'</strong><span>ккал записано</span>'+ring+'</div>'+
      '<div class="journal-macros">'+macros.slice(1).map((k,i)=>'<div>'+labels[k].split(',')[0]+'<b>'+number(totals[i+1])+' г</b></div>').join('')+'</div>'+
      (edit?form:b('Записать приём пищи','jr-edit:new','btn full','plus'))+
      (entries.length?entries.map(r=>panel('<strong>'+e(r.title)+'</strong>'+muted(number(r.grams)+' г · '+number(r.kcal*r.grams/100)+' ккал')+b('Изменить','jr-edit:'+r.id,'linebtn')+b('Удалить','jr-remove:'+r.id,'textbtn'))).join(''):muted('За этот день записей пока нет.'));
  }
  function stats(){
    const end=Date.parse(state().day+'T12:00:00Z');
    const start=end-(period-1)*86400000;
    const sessions=state().workouts.filter(w=>w.status!=='active'&&Date.parse(w.day+'T12:00:00Z')>=start);
    const count=sessions.reduce((n,w)=>n+w.sets.length,0);
    const days=Array.from({length:period},(_,i)=>new Date(start+i*86400000).toISOString().slice(0,10));
    const exercises=[...new Set(sessions.flatMap(w=>w.sets.map(s=>s.exercise)))];
    if(!exercises.includes(exercise))exercise=exercises[0]||'';
    const values=sessions.flatMap(w=>w.sets.map(s=>({...s,day:w.day})));
    const sums=days.map(d=>{
      const daily=values.filter(s=>s.day===d);
      if(metric==='weight')return Math.max(0,...daily.filter(s=>s.exercise===exercise).map(s=>s.kg));
      if(metric==='volume')return daily.reduce((total,s)=>total+s.kg*s.reps,0);
      return daily.length;
    });
    const metricName={sets:'Подходы',weight:'Рабочий вес',volume:'Объём'}[metric];
    const unit=metric==='sets'?'':' кг';
    const group=items=>metric==='weight'?Math.max(0,...items):items.reduce((a,b)=>a+b,0);
    if(!days.includes(selected))selected=days.at(-1);
    const step=period===7?1:5;
    return title('Мой прогресс','RITM ANALYTICS')+'<div class="chips">'+[7,30,90].map(n=>b(n+' дней','jr-period:'+n,'chip '+(n===period?'on':''))).join('')+'</div>'+
      '<div class="journal-count"><strong>'+count+'</strong><span>подходов · '+sessions.length+' занятий</span></div>'+
      panel('<h2>'+metricName+' по дням</h2><div class="chips">'+[['sets','Подходы'],['weight','Вес'],['volume','Объём']].map(([k,n])=>b(n,'jr-metric:'+k,'chip '+(metric===k?'on':''))).join('')+'</div>'+
      (metric==='weight'&&exercises.length?'<label>Упражнение<select id="jr-exercise">'+exercises.map(n=>'<option '+(n===exercise?'selected':'')+'>'+e(n)+'</option>').join('')+'</select></label>':'')+
      (metric==='volume'?muted('Сумма веса × повторения в выполненных подходах.'):metric==='weight'?muted('Максимальный записанный вес выбранного упражнения. Учитываются завершённые и частичные занятия.'):'')+
      '<div class="journal-chart">'+days.filter((_,i)=>i%step===0).map(d=>{
        const i=days.indexOf(d), value=group(sums.slice(i,i+step));
        return '<button data-a="jr-day:'+d+'" aria-label="'+d+', '+metricName+' '+number(value)+unit+'"><i style="height:'+Math.min(88,4+84*value/Math.max(1,...days.filter((_,n)=>n%step===0).map((_,n)=>group(sums.slice(n*step,n*step+step)))))+'px"></i>'+d.slice(8)+'</button>';
      }).join('')+'</div>'+muted(step===1?'Каждый столбец — один день.':'Каждый столбец — пять дней. Выбери дату для подробностей.')+field('jr-stats-date','Дата',selected,'date','min="'+days[0]+'" max="'+days.at(-1)+'"')+'<p>'+selected+' · '+metricName+' '+number(sums[days.indexOf(selected)])+unit+'</p>'+muted('Записей питания: '+state().food_log.filter(r=>r.day===selected).length))+
      (count?'':muted('Здесь появятся результаты завершённых занятий.'));
  }
  const val=id=>document.getElementById('jr-'+id)?.value??'';
  const draft=()=>({title:val('name'),kg:val('kg'),reps:val('reps'),rest:val('rest')});
  const queue=()=>read('pending-sets')||[];
  let syncing=null;
  async function flush(){
    if(syncing)return syncing;
    const owner=state().profile.id;
    syncing=(async()=>{
      while(state().profile.id===owner && queue().length){
        const item=queue()[0];
        try{await write('journal_set',item);}
        catch(error){notice(error.message+' Подходы сохранены на устройстве.');return false;}
        if(state().profile.id!==owner)return false;
        save('pending-sets',queue().filter(x=>x.nonce!==item.nonce));
      }
      return true;
    })();
    try{return await syncing;}finally{syncing=null;}
  }
  async function act(cmd,v){
    if(cmd==='jr-start')await write('journal_start',{title:val('name'),steps:val('plan').split(/\n/).map(s=>s.trim()).filter(Boolean)});
    if(cmd==='jr-sync'){await flush();draw();return;}
    if(cmd==='jr-set'){
      const data=draft();
      if(!data.title.trim()||data.title.length>80||data.reps===''||Number(data.reps)<1||!Number.isInteger(Number(data.reps))||Number(data.reps)>10000||data.kg===''||Number(data.kg)<0||Number(data.kg)>1500||data.rest===''||Number(data.rest)<0||Number(data.rest)>3600)throw Error('Проверь упражнение, вес, повторения и отдых.');
      save('pending-sets',[...queue(),{...data,id:active().id,nonce:nonce()}]);
      await flush();
    }
    if(cmd==='jr-next'){
      if(queue().length&&!await flush())return;
      const w=active(), step=w.steps.find(s=>s.status==='next');
      if(step)await write('journal_next',{id:w.id,idx:step.idx,status:v});
    }
    if(cmd==='jr-finish')ending=true;
    if(cmd==='jr-end'){
      if(v!=='cancel'){
        if(queue().length&&!await flush())return;
        await write('journal_end',{id:active().id,status:v});
      }
      ending=false;
    }
    if(cmd==='jr-edit')edit=v;
    if(cmd==='jr-remove'&&window.confirm('Удалить эту запись питания?'))await write('journal_delete',{id:v});
    if(cmd==='jr-food-save'){
      const data={title:val('name'),day:intakeDay};
      for(const k of ['grams',...macros]){
        if(val(k)==='')throw Error('Заполни массу и показатели с этикетки.');
        data[k]=Number(val(k));
      }
      await write('journal_food',{...data,id:edit==='new'?'':edit});edit='';
    }
    if(cmd==='jr-metric')metric=v;
    if(cmd==='jr-period')period=Number(v);
    if(cmd==='jr-day')selected=v;
    draw();
  }
  document.addEventListener('input',ev=>{if(document.body.dataset.screen==='journalTrain'&&active()&&ev.target.id.startsWith('jr-'))save('set-'+active().id,draft());});
  document.addEventListener('change',ev=>{if(ev.target.id==='jr-exercise'){exercise=ev.target.value;draw();}if(ev.target.id==='jr-date'&&ev.target.value){intakeDay=ev.target.value;edit='';draw();}if(ev.target.id==='jr-stats-date'&&ev.target.value){selected=ev.target.value;draw();}});
  setInterval(()=>{const el=document.getElementById('jr-clock');if(el){const left=Math.max(0,Math.ceil(active().rest_until-Date.now()/1000));el.textContent=left?'Отдых · '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):'Можно записать следующий подход';}},300);
  window.addEventListener('online',async()=>{if(state()?.profile&&queue().length){await flush();if(document.body.dataset.screen==='journalTrain')draw();}});
  return {train,food,stats,act,sync:flush};
}
