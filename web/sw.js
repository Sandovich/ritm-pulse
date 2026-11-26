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
