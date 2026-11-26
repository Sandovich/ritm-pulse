'use strict';
const previewQuery=new URLSearchParams(location.search);
const meetingRoot=location.pathname.split('/').includes('meeting');
const homeScenario=!meetingRoot&&(previewQuery.get('screen')==='today'||previewQuery.get('scenario')==='home');
if(homeScenario)document.querySelector('link[rel=manifest]').href='manifest-home.webmanifest?v=system1';
const sandboxStorageKey=meetingRoot?'ritm-premium-actor':homeScenario?'ritm-home-review-actor':'ritm-preview-actor';
if(previewQuery.get('screen')==='today'&&!previewQuery.has('as'))sessionStorage.setItem(sandboxStorageKey,'owner');
const requested=new URLSearchParams(location.search).get('as');
if(requested==='owner'||requested==='friend')sessionStorage.setItem(sandboxStorageKey,requested);
const previewActor=sessionStorage.getItem(sandboxStorageKey)==='friend'?'friend':'owner';
let previewWorker,warmTimer,startTimer,engineReady=false;
if(meetingRoot && 'serviceWorker' in navigator) navigator.serviceWorker.register('./runtime-cache.js').catch(()=>{});

function worker(){
  if (!previewWorker) {
    previewWorker=new Worker('./worker.js?rev=polish1'+(homeScenario?'&scenario=home':''));
    engineReady=false;
    startTimer=setTimeout(workerError,15000);
    previewWorker.onmessage=receive;previewWorker.onerror=workerError;
  }
  return previewWorker;
}

const calls=new Map();let requestId=0,initialized=false;
function releaseIdleWorker(){
  clearTimeout(warmTimer);
  if(!calls.size && previewWorker){clearTimeout(startTimer);previewWorker.terminate();previewWorker=null;engineReady=false;}
}
window.addEventListener('pagehide',releaseIdleWorker);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseIdleWorker();});
window.ritmDemo={
  actor:previewActor,
  storagePrefix:meetingRoot?'ritm-ui-premium-':homeScenario?'ritm-ui-home-':'ritm-ui-demo-',
  async api(path,body){
    if(meetingRoot && window.ritmMeetingStart){
      const value=await window.ritmMeetingStart(path,previewActor);
      if(value){initialized=true;if(!previewWorker&&!document.hidden){clearTimeout(warmTimer);warmTimer=setTimeout(worker,160);}return value;}
    }
    return new Promise((resolve,reject)=>{
      const id=++requestId;const message={id,actor:previewActor,path,body,initialized};
      calls.set(id,{resolve,reject,message});
      try { const active=worker();if(engineReady)active.postMessage(message); }
      catch {workerError();}
    });
  },
  openFriend(token){
    const url=new URL('./',location.href);url.searchParams.set('as',previewActor==='owner'?'friend':'owner');
    if(token)url.searchParams.set('invite',token);
    if(homeScenario)url.searchParams.set('scenario','home');
    return url.href;
  }
};
function receive({data}){
  if(data.engineReady){clearTimeout(startTimer);engineReady=true;for(const item of calls.values())previewWorker.postMessage(item.message);return;}
  if(data.startupError){workerError();return;}
  const call=calls.get(data.id);if(!call)return;calls.delete(data.id);
  if(data.error)call.reject(Error(data.error));else{initialized=true;call.resolve(data.value);}
};
function workerError(){
  clearTimeout(startTimer);engineReady=false;
  if(previewWorker)previewWorker.terminate();previewWorker=null;
  for(const item of calls.values())item.reject(Error('Движок демо не загрузился. Проверь соединение и попробуй ещё раз.'));
  calls.clear();
};
window.ritmDemo.reset=async()=>{
 await window.ritmDemo.api('/demo/reset',{});
 for(const k of Object.keys(localStorage))if(k.startsWith(window.ritmDemo.storagePrefix))localStorage.removeItem(k);
 for(const k of Object.keys(sessionStorage))if(k.startsWith(window.ritmDemo.storagePrefix))sessionStorage.removeItem(k);
 sessionStorage.removeItem(sandboxStorageKey);location.replace(new URL(homeScenario?'./?scenario=home':'./',location.href));
};
