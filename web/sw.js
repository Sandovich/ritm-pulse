self.addEventListener('push',event=>{
 event.waitUntil(self.registration.showNotification('RITM · круг друзей',{body:'В круге новое действие. Ответьте, когда вам удобно.',tag:'ritm-pulse',icon:'/icon.png',data:{url:'/'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const pages=await clients.matchAll({type:'window',includeUncontrolled:true});
  for(const page of pages)if(new URL(page.url).origin===self.location.origin){await page.focus();return;}
  await clients.openWindow('/');
 })());
});
