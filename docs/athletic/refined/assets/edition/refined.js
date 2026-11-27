/* Retain the existing select as the form value and dispatch the original change event. */
(()=>{
 function install(select){
   if(select.multiple || select.dataset.refPicker!==undefined)return;
   select.dataset.refPicker='';
   const trigger=document.createElement('button');
   trigger.type='button';trigger.className='ref-picker';
   const title=select.getAttribute('aria-label')||select.labels?.[0]?.childNodes[0]?.textContent?.trim()||'Выбери вариант';
   function refresh(){
     const value=select.selectedOptions[0]?.textContent||'Выбрать';
     trigger.textContent=value+'　⌄';trigger.disabled=select.disabled;
     trigger.setAttribute('aria-label',title+' · '+value);
   }
   trigger.setAttribute('aria-haspopup','dialog');
   select.after(trigger);refresh();
   trigger.onclick=()=>{
     const sheet=document.createElement('dialog');sheet.className='ref-sheet';sheet.setAttribute('aria-label',title);
     const h=document.createElement('h2');h.textContent=title;sheet.append(h);
     [...select.options].forEach((option,index)=>{
       const choice=document.createElement('button');choice.type='button';choice.textContent=option.textContent;
       choice.disabled=option.disabled;choice.setAttribute('aria-pressed',String(index===select.selectedIndex));
       choice.onclick=()=>{select.selectedIndex=index;refresh();sheet.close();select.dispatchEvent(new Event('change',{bubbles:true}));};
       sheet.append(choice);
     });
     const close=document.createElement('button');close.type='button';close.textContent='Закрыть';close.onclick=()=>sheet.close();sheet.append(close);
     document.body.append(sheet);sheet.addEventListener('close',()=>{sheet.remove();if(trigger.isConnected)trigger.focus();},{once:true});
     sheet.showModal();sheet.querySelector('[aria-pressed=true]')?.focus();
   };
 }
 const scan=node=>{if(node.nodeType!==1)return;if(node.matches('select'))install(node);else node.querySelectorAll('select').forEach(install);};
 new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(scan))).observe(document.body,{childList:true,subtree:true});
 scan(document.body);
})();
