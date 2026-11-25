'use strict';
const previewQuery=new URLSearchParams(location.search);
const homeScenario=previewQuery.get('screen')==='today'||previewQuery.get('scenario')==='home';
if(homeScenario)document.querySelector('link[rel=manifest]').href='manifest-home.webmanifest?v=system1';
const sandboxStorageKey=homeScenario?'ritm-home-review-actor':'ritm-preview-actor';
if(previewQuery.get('screen')==='today'&&!previewQuery.has('as'))sessionStorage.setItem(sandboxStorageKey,'owner');
const requested=new URLSearchParams(location.search).get('as');
if(requested==='owner'||requested==='friend')sessionStorage.setItem(sandboxStorageKey,requested);
const previewActor=sessionStorage.getItem(sandboxStorageKey)==='friend'?'friend':'owner';
const previewWorker=new Worker('./worker.js?rev=system1'+(homeScenario?'&scenario=home':''));
const calls=new Map();let requestId=0,initialized=false;
window.ritmDemo={
  actor:previewActor,
  storagePrefix:homeScenario?'ritm-ui-home-':'ritm-ui-demo-',
  api(path,body){
    return new Promise((resolve,reject)=>{
      const id=++requestId;calls.set(id,{resolve,reject});
      previewWorker.postMessage({id,actor:previewActor,path,body,initialized});
    });
  },
  openFriend(token){
    const url=new URL('./',location.href);url.searchParams.set('as',previewActor==='owner'?'friend':'owner');
    if(token)url.searchParams.set('invite',token);
    if(homeScenario)url.searchParams.set('scenario','home');
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
 for(const k of Object.keys(localStorage))if(k.startsWith(window.ritmDemo.storagePrefix))localStorage.removeItem(k);
 sessionStorage.removeItem(sandboxStorageKey);location.replace(new URL(homeScenario?'./?scenario=home':'./',location.href));
};
