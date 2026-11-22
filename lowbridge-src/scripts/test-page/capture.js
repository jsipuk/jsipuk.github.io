(() => {
  // Test page only: save story events (answered, recruited, delivered, caught...) and
  // any page error so Claude can review phone sessions, and offer the game a save slot
  // where the browser has no working storage. The game itself sends nothing; it only
  // fires "lowbridge:event" on the window.
  const queue = [];
  let db = null;
  let errors = 0;
  let events = 0;
  const session = Math.random().toString(36).slice(2, 10);
  const context = () => ({
    at: new Date().toISOString(),
    session,
    build: (window.lowbridge && window.lowbridge.build) || 'unknown',
    screen: innerWidth + 'x' + innerHeight,
    orientation: innerWidth > innerHeight ? 'landscape' : 'portrait',
    browser: navigator.userAgent.slice(0, 200),
  });
  const write = (item) => {
    try {
      db.collection(item.collection).add(item.row).catch(() => {});
    } catch (e) {
      /* capture is best effort */
    }
  };
  const save = (collection, row) => {
    const item = { collection, row: Object.assign(context(), row) };
    if (db) write(item);
    else if (queue.length < 60) queue.push(item);
  };
  // Bumps are frequent; keep every tenth. Story beats and free-play moments are kept.
  let bumps = 0;
  window.addEventListener('lowbridge:event', (e) => {
    const d = Object.assign({}, e.detail);
    if (d.type === 'bump' && bumps++ % 10 !== 0) return;
    if (events++ > 400) return;
    save('events', d);
  });
  const onError = (message, source) => {
    if (errors++ >= 20) return;
    save('errors', { message: String(message).slice(0, 500), source: String(source || '').slice(0, 200) });
  };
  window.addEventListener('error', (e) => onError(e.message, (e.filename || '') + ':' + (e.lineno || '')));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    onError(r && (r.stack || r.message) ? r.stack || r.message : r, 'promise');
  });
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude
      .use('db')
      .then((d) => {
        if (!d) return;
        db = d;
        while (queue.length) write(queue.shift());
        const build = document.querySelector('.build');
        if (build) {
          const p = document.createElement('p');
          p.className = 'build';
          p.textContent = 'Test page: story events, free-play moments (pigeons, shops, chats, unlocks) and any error are saved for Claude to review.';
          build.after(p);
        }
      })
      .catch(() => {});
  }

  // A save slot for views where the browser's own storage can't write (the Claude app on
  // iPhone). The game asks for it only when its storage probe fails. The slot lives in this
  // page's database under the viewer's private data/users/<id>/ path: nobody else, the
  // page's owner included, can read it. One document holds the current and previous save.
  window.lowbridgeHostStore = (async () => {
    if (!window.claude || typeof window.claude.use !== 'function') return null;
    const [store, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!store || !user) return null;
    const id = await user.id();
    if (!id) return null;
    const slot = store.collection('data/users/' + id).doc('lowbridge-save');
    const read = async () => {
      const snap = await slot.get();
      const body = snap.exists ? snap.data() : null;
      // Snapshots are frozen; the game gets its own copy.
      return body ? JSON.parse(JSON.stringify(body)) : { current: null, previous: null };
    };
    const reason = (e) => String((e && (e.code || e.message)) || e);
    return {
      async load() {
        return (await read()).current || null;
      },
      async loadPrevious() {
        return (await read()).previous || null;
      },
      async commit(expected, next) {
        try {
          const body = await read();
          const current = body.current || null;
          if ((current ? current.revision : 0) !== expected) return { ok: false, reason: 'conflict', current };
          await slot.set({ current: next, previous: current || body.previous || null });
          return { ok: true, envelope: next };
        } catch (e) {
          return { ok: false, reason: 'error', message: reason(e) };
        }
      },
      async clear() {
        await slot.delete();
      },
    };
  })().catch(() => null);
})();
