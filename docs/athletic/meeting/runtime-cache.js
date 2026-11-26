const runtime=new URL('runtime/',self.registration.scope).href;
const cacheName='ritm-runtime-v1:'+runtime;
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||!req.url.startsWith(runtime)||req.headers.has('range'))return;
 event.respondWith((async()=>{
  const cache=await caches.open(cacheName).catch(()=>null);
  const hit=await cache?.match(req);
  if(hit)return hit;
  const response=await fetch(req);
  if(cache && response.status===200)await cache.put(req,response.clone()).catch(()=>{});
  return response;
 })());
});
