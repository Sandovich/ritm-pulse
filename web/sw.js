self.addEventListener('push', event => {
 let data;
 try { data = event.data?.json(); } catch { data = null; }
 const choice = data?.type === 'choice' && /^[A-Za-z0-9_-]{10,64}$/.test(data.choice || '') ? data.choice : '';
 const url = new URL(self.registration.scope);
 if (choice) url.searchParams.set('choice_result', choice);
 const title = choice ? 'RITM · Выбери мой ход' : 'RITM · круг друзей';
 const body = choice ? 'Друг выполнил выбранное тобой дело. Поменяться ролями?' : 'В круге новое действие. Ответьте, когда вам удобно.';
 event.waitUntil(self.registration.showNotification(title, {
  body, tag: choice ? 'ritm-choice-' + choice : 'ritm-pulse', icon: new URL('icon.png', self.registration.scope).href, data: {url: url.href}
 }));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 event.waitUntil((async () => {
  const url = new URL(self.registration.scope);
  const requested = new URL(event.notification.data?.url || url, url);
  if (requested.origin === url.origin && requested.pathname === url.pathname) url.search = requested.search;
  const pages = await clients.matchAll({type:'window', includeUncontrolled:true});
  for (const page of pages) {
   const current = new URL(page.url);
   if (current.origin !== url.origin || current.pathname !== url.pathname) continue;
   if (url.search && page.url !== url.href) {
    const navigated = await page.navigate(url.href);
    if (navigated) { await navigated.focus(); return; }
    continue;
   }
   await page.focus();
   return;
  }
  await clients.openWindow(url.href);
 })());
});
/* The offline cache contains only the app shell. Private API responses stay out. */
const shellCache='ritm-athletic-shell-1';
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const root=new URL('./',self.registration.scope);
  const response=await fetch(root,{cache:'reload'});
  if(!response.ok)throw Error('Shell unavailable');
  const html=await response.clone().text();
  const files=Array.from(html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g),m=>new URL(m[1],root)).filter(u=>u.origin===root.origin);
  const cache=await caches.open(shellCache);
  await cache.addAll([...new Set(files.map(u=>u.href))]);
  await cache.put(root,response);
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(event.request.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
  event.respondWith((async()=>{
    try{return await fetch(event.request);}
    catch(error){
      const cache=await caches.open(shellCache);
      const cached=await cache.match(u.pathname==='/'?new URL('./',self.registration.scope).href:event.request);
      if(cached)return cached;
      throw error;
    }
  })());
});
