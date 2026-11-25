'use strict';
const sandboxStorageKey='ritm-preview-actor';
const requested=new URLSearchParams(location.search).get('as');
if(requested==='owner'||requested==='friend')sessionStorage.setItem(sandboxStorageKey,requested);
const previewActor=sessionStorage.getItem(sandboxStorageKey)==='friend'?'friend':'owner';
const previewWorker=new Worker('./worker.js');
const calls=new Map();let requestId=0,initialized=false;
window.ritmDemo={
  actor:previewActor,
  api(path,body){
    return new Promise((resolve,reject)=>{
      const id=++requestId;calls.set(id,{resolve,reject});
      previewWorker.postMessage({id,actor:previewActor,path,body,initialized});
    });
  },
  openFriend(token){
    const url=new URL('./',location.href);url.searchParams.set('as',previewActor==='owner'?'friend':'owner');
    if(token)url.searchParams.set('invite',token);
    return url.href;
  }
};
previewWorker.onmessage=({data})=>{
  const call=calls.get(data.id);if(!call)return;calls.delete(data.id);
  if(data.error)call.reject(Error(data.error));else{initialized=true;call.resolve(data.value);}
};
previewWorker.onerror=()=>{
  for(const item of calls.values())item.reject(Error('Не удалось запустить демо. Обновите страницу в обычном браузере.'));
  calls.clear();
};
window.ritmDemo.reset=async()=>{
 await window.ritmDemo.api('/demo/reset',{});
 for(const k of Object.keys(localStorage))if(k.startsWith('ritm-ui-demo-'))localStorage.removeItem(k);
 sessionStorage.removeItem(sandboxStorageKey);location.replace(new URL('./',location.href));
};
