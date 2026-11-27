function createJournal({state,write,route,draw,e,b,field,head,muted,read,save,nonce,notice}) {
  let metric='sets',exercise='',period=7, selected='', edit='', intakeDay='', ending=false;
  let trainingTab='sets';
  const number=n=>Number(n.toFixed(1)).toLocaleString('ru-RU');
  const labels={grams:'Порция, г',kcal:'ккал',protein:'Белки, г',fat:'Жиры, г',carbs:'Углеводы, г'};
  const macros=['kcal','protein','fat','carbs'];
  const active=()=>state().workouts.find(w=>w.status==='active');
  const numField=(id,name,value)=>field(id,name,value,'number','step="any" min="0" inputmode="decimal" required');
  const panel=(html)=>'<section class="journal-panel">'+html+'</section>';
  const title=(text,kicker)=>head(text,kicker);
  function cover(section,heading,kicker){
    return '<header class="jr-cover jr-cover-'+section+'"><div>'+title(heading,kicker)+'</div></header>';
  }
  function counter(id,name,value,increment){
    return '<div class="jr-counter">'+numField(id,name,value)+'<div class="jr-adjust">'+
      b('−','jr-adjust:'+id+':-'+increment,'linebtn')+b('+','jr-adjust:'+id+':'+increment,'linebtn')+'</div></div>';
  }
  function setTable(rows){
    if(!rows.length)return '';
    return '<table class="jr-table"><caption>Записанные подходы</caption><thead><tr><th>№</th><th>Упражнение</th><th>кг</th><th>Раз</th></tr></thead><tbody>'+
      rows.map(s=>'<tr class="journal-row"><td><button class="jr-repeat" data-a="jr-repeat:'+s.position+'" aria-label="Повторить вес и повторы подхода '+s.position+'">'+s.position+'</button></td><th scope="row">'+e(s.exercise)+'</th><td>'+number(s.kg)+'</td><td>'+s.reps+'</td></tr>').join('')+'</tbody></table>';
  }
  function restClock(w){
    const local=read('rest-clock-'+w.id);
    return local?.stamp===w.rest_until?local:{stamp:w.rest_until,end:w.rest_until};
  }
  function remaining(clock){return Math.max(0,clock.paused??Math.ceil(clock.end-Date.now()/1000));}
  function train(){
    const w=active();
    if(!w)return cover('train','Дневник тренировок','SMART TRAIN')+
      panel('<h2>Своя тренировка</h2>'+muted('Записывай выполненные подходы. Занятие можно закрыть и продолжить позже.')+field('jr-name','Название занятия','Моя тренировка')+'<label>Упражнения по порядку<textarea id="jr-plan" rows="3" placeholder="По одному упражнению на строку"></textarea></label>'+b('Начать занятие','jr-start','btn full','play'))+
      history();
    const last=w.sets.at(-1), draft=read('set-'+w.id)||{};
    const step=w.steps.find(s=>s.status==='next');
    const previous=state().workouts.filter(item=>item.id!==w.id).flatMap(item=>item.sets.slice().reverse()).find(s=>s.exercise===(step?.title||draft.title||last?.exercise));
    const heading=cover('train',step?.title||w.title,step?'Упражнение '+step.idx+' из '+w.steps.length:'SMART TRAIN · В процессе');
    const tabs='<div class="segmented" aria-label="Раздел упражнения">'+[['sets','Подходы'],['history','История'],['tech','Техника']].map(([key,name])=>'<button data-a="jr-tab:'+key+'" aria-pressed="'+(key===trainingTab)+'">'+name+'</button>').join('')+'</div>';
    if(trainingTab==='tech')return heading+tabs+panel('<h2>Техника упражнения</h2>'+muted('Для этого упражнения пока нет проверенного видео или анатомической схемы.'));
    if(trainingTab==='history'){
      const name=step?.title||draft.title||last?.exercise;
      const matches=state().workouts.filter(item=>item.id!==w.id).flatMap(item=>item.sets.filter(set=>set.exercise===name).map(set=>({day:item.day,set})));
      return heading+tabs+panel('<h2>Предыдущие подходы</h2>'+(matches.length?matches.map(({day,set})=>'<p>'+e(day)+' · '+number(set.kg)+' кг × '+set.reps+'</p>').join(''):muted('История появится после занятия с этим упражнением.')));
    }
    return heading+tabs+
      '<div class="journal-count"><strong>'+w.sets.length+'</strong><span>подходов записано</span></div>'+
      (queue().length?b('Ожидают отправки: '+queue().length+' · Повторить','jr-sync','linebtn full'):'')+

      (previous?muted('Предыдущее занятие · '+number(previous.kg)+' кг × '+previous.reps):'')+
      setTable(w.sets)+
      panel((step?'<input type="hidden" id="jr-name" value="'+e(step.title)+'">':field('jr-name','Упражнение',draft.title??last?.exercise??''))+
      '<div class="grid">'+counter('jr-kg','Вес, кг',draft.kg??last?.kg??0,0.5)+counter('jr-reps','Повторения',draft.reps??last?.reps??'',1)+'</div>'+
      '<details class="jr-rest"><summary>Отдых · '+e(draft.rest??90)+' с</summary>'+numField('jr-rest','Длительность, с',draft.rest??90)+'</details>'+
      b('Записать подход','jr-set','btn full','check')+'<output id="jr-clock" aria-label="Отдых"></output><div class="row" id="jr-rest-actions"'+(remaining(restClock(w))?'':' hidden')+'>'+b(restClock(w).paused!=null?'Продолжить':'Пауза','jr-rest-toggle','linebtn')+b('Завершить отдых','jr-rest-end','textbtn')+'</div>')+
      (step?b('Следующее упражнение','jr-next:done','linebtn')+b('Пропустить','jr-next:skipped','textbtn'):'')+
      (ending?panel('<h2>Завершить занятие?</h2>'+[['complete','Выполнено полностью'],['partial','Завершить частично'],['discard','Удалить это занятие'],['cancel','Продолжить']].map(([id,n])=>b(n,'jr-end:'+id,'linebtn full')).join('')):b('Завершить занятие','jr-finish','linebtn full'))+(document.body.dataset.screen==='journalTrain'&&!document.getElementById('head')?.textContent.includes('без сети')?b('Личный тренер · условия сопровождения','product:TRAIN','textbtn full'):'');
  }
  function history(){return (state().workouts||[]).filter(w=>w.status!=='active').map(w=>panel('<strong>'+e(w.title)+'</strong>'+muted(w.day+' · '+(w.status==='partial'?'Частично':'Завершено')+' · '+w.sets.length+' подходов')+w.sets.map(s=>'<p>'+e(s.exercise)+' · '+number(s.kg)+' кг × '+s.reps+'</p>').join(''))).join('');}
  function food(){
    intakeDay=intakeDay||state().day;
    const entries=state().food_log.filter(r=>r.day===intakeDay);
    const totals=macros.map(k=>entries.reduce((sum,r)=>sum+r[k]*r.grams/100,0));
    const macroEnergy=totals[1]*4+totals[2]*9+totals[3]*4;
    const proteinEnd=macroEnergy?totals[1]*400/macroEnergy:0;
    const fatEnd=macroEnergy?proteinEnd+totals[2]*900/macroEnergy:0;
    const ring=macroEnergy?'<span class="journal-ring" aria-hidden="true" style="background:conic-gradient(#d5fc53 0 '+proteinEnd+'%, #dcad80 '+proteinEnd+'% '+fatEnd+'%, #92adc9 '+fatEnd+'% 100%)"></span>':'';
    const row=state().food_log.find(r=>r.id===edit)||{};
    const form=edit?panel('<h2>'+ (row.id?'Изменить запись':'Записать еду')+'</h2>'+field('jr-name','Блюдо или продукт',row.title||'')+numField('jr-grams',labels.grams,row.grams??'')+'<p>По этикетке на 100 г</p><div class="grid">'+macros.map(k=>numField('jr-'+k,labels[k],row[k]??'')).join('')+'</div>'+b('Сохранить','jr-food-save','btn full')+b('Отмена','jr-edit:','linebtn full')):'';
    return cover('food','Дневник питания','SMART FOOD')+field('jr-date','День дневника',intakeDay,'date','max="'+state().day+'"')+
      '<div class="journal-count"><strong>'+number(totals[0])+'</strong><span>ккал записано</span>'+ring+'</div>'+
      '<div class="journal-macros">'+macros.slice(1).map((k,i)=>'<div>'+labels[k].split(',')[0]+'<b>'+number(totals[i+1])+' г</b></div>').join('')+'</div>'+
      b('Записать приём пищи','jr-edit:new','btn full','plus')+(edit?'<dialog class="jr-sheet" id="jr-food-sheet" aria-label="Запись питания">'+form+'</dialog>':'')+
      (entries.length?entries.map(r=>panel('<strong>'+e(r.title)+'</strong>'+muted(number(r.grams)+' г · '+number(r.kcal*r.grams/100)+' ккал')+b('Изменить','jr-edit:'+r.id,'linebtn')+b('Удалить','jr-remove:'+r.id,'textbtn'))).join(''):muted('За этот день записей пока нет.'))+b('Программа питания · FOOD 28','product:FOOD','textbtn full');
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
      if(metric==='weight')return summary(daily);
      if(metric==='volume')return daily.reduce((total,s)=>total+s.kg*s.reps,0);
      return daily.length;
    });
    const metricName={sets:'Подходы',weight:'Рабочий вес',volume:'Объём'}[metric];
    const unit=metric==='sets'?'':' кг';
    const priorStart=start-period*86400000;
    const prior=state().workouts.filter(w=>w.status!=='active'&&Date.parse(w.day+'T12:00:00Z')>=priorStart&&w.day<days[0]).flatMap(w=>w.sets);
    function summary(rows){
      if(metric==='sets')return rows.length;
      if(metric==='volume')return rows.reduce((v,s)=>v+s.kg*s.reps,0);
      const weights=rows.filter(s=>s.exercise===exercise).map(s=>s.kg);
      return weights.length?Math.max(...weights):null;
    }
    const prev=summary(prior),curr=summary(values);
    const comparison=prior.length&&prev!==null&&curr!==null?'Предыдущие '+period+' дн. · '+number(prev)+unit+' / сейчас '+number(curr)+unit:'За предыдущие '+period+' дн. нет сопоставимых записей';
    const group=items=>metric==='weight'?(items.some(v=>v!==null)?Math.max(...items.filter(v=>v!==null)):null):items.reduce((a,b)=>a+b,0);
    if(!days.includes(selected))selected=days.at(-1);
    const step=period===7?1:5;
    const bins=days.filter((_,i)=>i%step===0).map((d,i)=>({d,v:group(sums.slice(i*step,i*step+step))}));
    const peak=Math.max(1,...bins.map(b=>b.v));
    const measured=bins.map((bin,i)=>({x:8+284*i/Math.max(1,bins.length-1),y:88-76*bin.v/peak,value:bin.v})).filter(point=>point.value!==null);
    const points=measured.map(p=>p.x+','+p.y).join(' ');
    const area=measured.length>1?'<polygon points="'+measured[0].x+',100 '+points+' '+measured.at(-1).x+',100" fill="#d5fc5317"/>':'';
    const plot='<svg class="jr-trend" viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">'+area+'<polyline points="'+points+'" fill="none" stroke="#d5fc53" stroke-width="3" vector-effect="non-scaling-stroke"/>'+measured.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="3" fill="#d5fc53"/>').join('')+'</svg>';
    const selectedValue=sums[days.indexOf(selected)];
    return title('Мой прогресс','RITM ANALYTICS')+'<div class="chips">'+[7,30,90].map(n=>b(n+' дней','jr-period:'+n,'chip '+(n===period?'on':''))).join('')+'</div>'+
      '<div class="journal-count"><strong>'+count+'</strong><span>подходов · '+sessions.length+' занятий</span></div>'+
      (count?panel('<h2>'+metricName+' по дням</h2><div class="chips">'+[['sets','Подходы'],['weight','Вес'],['volume','Объём']].map(([k,n])=>b(n,'jr-metric:'+k,'chip '+(metric===k?'on':''))).join('')+'</div>'+
      (metric==='weight'&&exercises.length?'<label>Упражнение<select id="jr-exercise">'+exercises.map(n=>'<option '+(n===exercise?'selected':'')+'>'+e(n)+'</option>').join('')+'</select></label>':'')+
      (metric==='volume'?muted('Сумма веса × повторения в выполненных подходах.'):metric==='weight'?muted('Максимальный записанный вес выбранного упражнения. Учитываются завершённые и частичные занятия.'):'')+
      '<div class="jr-graph-scroll"><div style="min-width:'+bins.length*44+'px"><div class="jr-plot">'+plot+'</div><div class="journal-chart">'+bins.map(bin=>b(bin.d.slice(8),'jr-day:'+bin.d,'jr-point '+(selected>=bin.d&&days.indexOf(selected)<days.indexOf(bin.d)+step?'on':''))).join('')+'</div></div></div>'+muted(step===1?'Точки показывают дни.':'Точка объединяет пять дней. Ниже можно выбрать отдельную дату.')+field('jr-stats-date','Дата',selected,'date','min="'+days[0]+'" max="'+days.at(-1)+'"')+'<p>'+selected+' · '+metricName+' '+(selectedValue===null?'· нет записи':number(selectedValue)+unit)+'</p>'+muted('Записей питания: '+state().food_log.filter(r=>r.day===selected).length)):panel('<h2>Первая точка прогресса</h2>'+muted('За выбранный период нет записанных подходов.')+b('Открыть дневник','go:journalTrain','btn full')))+
      muted(comparison)+(count?'':muted('Здесь появятся результаты завершённых занятий.'));
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
    if(cmd==='jr-rest-toggle'||cmd==='jr-rest-end'){
      const w=active(),clock=restClock(w),left=remaining(clock);
      const next=cmd==='jr-rest-end'?{end:0}:clock.paused!=null?{end:Date.now()/1000+left}:{paused:left};
      save('rest-clock-'+w.id,{stamp:w.rest_until,...next});
    }
    if(cmd==='jr-tab')trainingTab=v;
    if(cmd==='jr-start')trainingTab='sets';
    if(cmd==='jr-repeat'){
      const prior=active().sets.find(s=>s.position===Number(v));
      if(!prior)return;
      for(const [id,value] of [['jr-kg',prior.kg],['jr-reps',prior.reps]]){
        const input=document.getElementById(id);
        input.value=value;
        input.dispatchEvent(new Event('input',{bubbles:true}));
      }
      document.getElementById('jr-kg').focus();
      notice('Вес и повторы перенесены в новый подход.');return;
    }
    if(cmd==='jr-adjust'){
      const [id,step]=v.split(':');
      const input=document.getElementById(id);
      input.value=Math.max(id==='jr-reps'?1:0,Math.round(((Number(input.value)||0)+Number(step))*10)/10);
      input.dispatchEvent(new Event('input',{bubbles:true}));return;
    }
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
    if(cmd==='jr-edit'&&edit){
      const dialog=document.getElementById('jr-food-sheet');
      dialog.showModal();
      dialog.addEventListener('cancel',()=>{edit='';},{once:true});
    }
  }
  document.addEventListener('input',ev=>{if(document.body.dataset.screen==='journalTrain'&&active()&&ev.target.id.startsWith('jr-'))save('set-'+active().id,draft());});
  document.addEventListener('change',ev=>{if(ev.target.id==='jr-exercise'){exercise=ev.target.value;draw();}if(ev.target.id==='jr-date'&&ev.target.value){intakeDay=ev.target.value;edit='';draw();}if(ev.target.id==='jr-stats-date'&&ev.target.value){selected=ev.target.value;draw();}});
  setInterval(()=>{const el=document.getElementById('jr-clock');if(el){const left=remaining(restClock(active()));const actions=document.getElementById('jr-rest-actions');if(actions)actions.hidden=!left;el.textContent=left?'Отдых · '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0'):'Можно записать следующий подход';}},300);
  window.addEventListener('online',async()=>{if(state()?.profile&&queue().length){await flush();if(document.body.dataset.screen==='journalTrain')draw();}});
  return {train,food,stats,act,sync:flush};
}
