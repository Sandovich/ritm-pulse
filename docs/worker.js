'use strict';
const runtimeBase = new URL('./runtime/', self.location.href).href;
importScripts(runtimeBase + 'pyodide.js');
async function init(){
  const runtime=await loadPyodide({indexURL:runtimeBase});
  await runtime.loadPackage('sqlite3');
  for(const name of ['core.py','season.py','notifications.py','journey.py','fixture.py','bridge.py']){
    const response=await fetch(new URL('./'+name,self.location.href));
    if(!response.ok)throw Error('Не удалось загрузить '+name);
    runtime.FS.writeFile('/home/pyodide/'+name,await response.text());
  }
  runtime.runPython('from bridge import answer');
  const db=await new Promise((resolve,reject)=>{
    const open=indexedDB.open('ritm-pulse-2.1-device',1);
    open.onupgradeneeded=()=>open.result.createObjectStore('state');
    open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
  });
  return {runtime,db};
}
const ready=init().then(value=>({value}),error=>({error}));
async function handle(message){
  const start=await ready;if(start.error)throw start.error;
  const {runtime,db}=start.value;
  // An IndexedDB write transaction serializes changes across browser tabs.
  return new Promise((resolve,reject)=>{
    let result,failed;
    const tx=db.transaction('state','readwrite');
    const store=tx.objectStore('state'),get=store.get('database');
    get.onsuccess=()=>{
      try{
        if(message.path==='/demo/reset'){store.delete('database');result={value:{ok:true}};return;}
        const disk='/device.sqlite';
        if(get.result)runtime.FS.writeFile(disk,new Uint8Array(get.result));
        else if(runtime.FS.analyzePath(disk).exists)runtime.FS.unlink(disk);
        runtime.globals.set('input_json',JSON.stringify(message));
        result=JSON.parse(runtime.runPython('answer(input_json)'));
        const data=runtime.FS.readFile(disk);
        if(!result.error&&(!get.result||message.path!=='/api/me'||!message.initialized))store.put(data,'database');
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
