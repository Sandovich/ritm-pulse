'use strict';
const runtimeBase = new URL('./runtime/', self.location.href).href;
importScripts(runtimeBase + 'pyodide.js');
async function init(){
  const modules=['core.py','choices.py','season.py','notifications.py','journey.py','fixture.py','demo_ledger.py','bridge.py'];
  const sources=Promise.all(modules.map(async name=>{
    const moduleUrl=new URL('./'+name,self.location.href);
    const revision=new URL(self.location.href).searchParams.get('rev');
    if(revision)moduleUrl.searchParams.set('rev',revision);
    const response=await fetch(moduleUrl);
    if(!response.ok)throw Error('Не удалось загрузить '+name);
    return [name,await response.text()];
  }));
  const interpreter=loadPyodide({indexURL:runtimeBase}).then(async runtime=>{
    await runtime.loadPackage('sqlite3');return runtime;
  });
  const [runtime,files]=await Promise.all([interpreter,sources]);
  for(const [name,source] of files)runtime.FS.writeFile('/home/pyodide/'+name,source);
  runtime.runPython('from bridge import answer');
  const db=await new Promise((resolve,reject)=>{
    const dbName=self.location.pathname.split('/').includes('meeting')?'ritm-founders-meeting':
      new URL(self.location.href).searchParams.get('scenario')==='home'?'ritm-home-approval':'ritm-pulse-2.1-device';
    const open=indexedDB.open(dbName,1);
    open.onupgradeneeded=()=>open.result.createObjectStore('state');
    open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
  });
  return {runtime,db};
}
const ready=init().then(value=>({value}),error=>({error}));
async function handle(message){
  const start=await ready;if(start.error)return {startupError:true};
  const {runtime,db}=start.value;
  // An IndexedDB write transaction serializes changes across browser tabs.
  return new Promise((resolve,reject)=>{
    let result,failed;
    const tx=db.transaction('state','readwrite');
    const store=tx.objectStore('state');
    const metaRequest=store.get('meeting-state-v1'),get=store.get('database');
    get.onsuccess=()=>{
      try{
        if(message.path==='/demo/reset'){store.clear();result={value:{ok:true}};return;}
        const disk='/device.sqlite';
        if(get.result)runtime.FS.writeFile(disk,new Uint8Array(get.result));
        else if(runtime.FS.analyzePath(disk).exists)runtime.FS.unlink(disk);
        const meta=metaRequest.result;
        if(meta?.anchor)message.clock=meta.anchor+(Date.now()-meta.started)/1000;
        runtime.globals.set('input_json',JSON.stringify(message));
        result=JSON.parse(runtime.runPython('answer(input_json)'));
        const data=runtime.FS.readFile(disk);
        if(!result.error&&(!get.result||message.path!=='/api/me'||!message.initialized))store.put(data,'database');
        if(!result.error && self.location.pathname.split('/').includes('meeting')){
          const next=meta||{};
          // Even a guest write may change the owner’s feed or available actions.
          if(message.path!=='/api/me' || message.actor==='owner') {
            next.snapshot=message.actor==='owner' && result.value?.profile ? result.value : null;
            next.saved=Date.now();
          }
          if(message.path!=='/api/me')next.pristine=false;
          if(message.path==='/demo/seed')next.seeded=true;
          store.put(next,'meeting-state-v1');
        }
      }catch(error){failed=error;tx.abort();}
    };
    tx.oncomplete=()=>resolve(result);
    tx.onabort=()=>reject(failed||tx.error||Error('Не удалось сохранить данные.'));
    tx.onerror=()=>reject(tx.error);
  });
}
self.onmessage=async event=>{
  try{self.postMessage({id:event.data.id,...await handle(event.data)});}
  catch(error){self.postMessage({id:event.data.id,error:error.message||String(error)});}
};
