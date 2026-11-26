/* Fast first paint for the isolated founders' demo. SQLite remains authoritative. */
window.ritmMeetingStart = (() => {
  const owner = 'owner';
  const stateKey = 'meeting-state-v1';
  let connection, bundle, firstRead = true;

  function database() {
    if (!connection) connection = new Promise((resolve, reject) => {
      const request = indexedDB.open('ritm-founders-premium', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('state');
      let expired=false;
      const limit=setTimeout(()=>{expired=true;reject(Error('storage timeout'));},1800);
      request.onsuccess = () => {clearTimeout(limit);if(expired) request.result.close();else resolve(request.result);};
      request.onerror = () => reject(request.error);
    });
    return connection;
  }

  function inspect(db, install) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('state', install ? 'readwrite' : 'readonly');
      const limit=setTimeout(()=>{try{tx.abort();}catch{}},1800);
      const store = tx.objectStore('state');
      const meta = store.get(stateKey), disk = store.getKey('database');
      let state;
      disk.onsuccess = () => {
        state = {meta:meta.result, exists:disk.result !== undefined};
        if (install) state = install(store, state);
      };
      tx.oncomplete = () => {clearTimeout(limit);resolve(state);};
      tx.onabort = () => {clearTimeout(limit);reject(tx.error);};
    });
  }

  function usable(state, kind) {
    const m = state.meta;
    if (!state.exists || !m || !m.snapshot || (kind === 'filled' && !m.seeded)) return false;
    const age = Date.now() - m.saved;
    if (age < 0 || age > 60000) return false;
    const now = m.snapshot.server_time + age / 1000;
    return new Date((now + 3 * 3600) * 1000).toISOString().slice(0,10) === m.snapshot.day;
  }

  function replaceable(state, kind) {
    return !state.exists || (kind === 'filled' && state.meta?.pristine);
  }

  async function read(kind) {
    const db = await database();
    const current = await inspect(db);
    if (usable(current,kind)) return current.meta.snapshot;
    if (!replaceable(current,kind)) return null;
    if (!bundle) { const controller=new AbortController(); const limit=setTimeout(()=>controller.abort(),3500);
      bundle = fetch(new URL('meeting-fixture.json?v=1', location.href),{signal:controller.signal}).then(r => {
      if (!r.ok) throw Error('Не удалось открыть учебный профиль.');
      return r.json();
    }).catch(err=>{bundle=null;throw err;}).finally(()=>clearTimeout(limit));}
    const fixture = await bundle;
    const sample = fixture[kind];
    const compressed = Uint8Array.from(atob(sample.database), char => char.charCodeAt(0));
    const bytes = new Uint8Array(await new Response(
      new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))
    ).arrayBuffer());
    const state = await inspect(db, (store, latest) => {
      if (usable(latest,kind) || !replaceable(latest,kind)) return latest;
      const stamp = Date.now();
      const meta = {anchor:fixture.anchor, started:stamp, saved:stamp, seeded:kind === 'filled',
                    pristine:kind === 'blank', snapshot:sample.snapshot};
      store.put(bytes, 'database');
      store.put(meta, stateKey);
      return {meta, exists:true};
    });
    return usable(state, kind) ? state.meta.snapshot : null;
  }

  return async function fast(path, actor) {
    const query = new URLSearchParams(location.search);
    if (actor !== owner || query.has('invite') || query.has('choice') ||
        (query.has('channel') && query.get('channel') !== 'direct') || !window.DecompressionStream) return null;
    const populate = path === '/demo/seed';
    if (!populate && (path !== '/api/me' || !firstRead)) return null;
    firstRead = false;
    const filledLink = ['today','reset-league','season-story','league-desk'].includes(query.get('screen'));
    try { return await read(populate || filledLink ? 'filled' : 'blank'); }
    catch { return null; } // Standard worker initialization also supports older browsers.
  };
})();

