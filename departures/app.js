/* Departures — shared shell: registry, routing, storage, sound, helpers.
 * Everything here is deliberately dependency-free so the whole pack can be
 * cached by the service worker and played with no signal at all.
 */
(function () {
  'use strict';

  var VERSION = '1.1';
  var STORE_PREFIX = 'departures:';

  // ---------------------------------------------------------------- storage
  var store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(STORE_PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (err) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
      } catch (err) {
        /* private mode or full quota — the games all cope without saving */
      }
    },
    remove: function (key) {
      try {
        localStorage.removeItem(STORE_PREFIX + key);
      } catch (err) {}
    }
  };

  // --------------------------------------------------------------- settings
  var settings = Object.assign(
    { sound: false, haptics: true, theme: 'dark' },
    store.get('settings', {})
  );

  function saveSettings() {
    store.set('settings', settings);
    applyTheme();
  }

  function applyTheme() {
    var root = document.documentElement;
    if (settings.theme === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', settings.theme);
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var dark = settings.theme === 'dark' ||
        (settings.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      meta.setAttribute('content', dark ? '#0d1526' : '#eef3fb');
    }
  }

  // ------------------------------------------------------------------ sound
  // Short synthesised blips: no audio files to download, nothing to fail
  // offline, and silent by default because most of this gets played on a plane.
  var audioCtx = null;

  function ctx() {
    if (!settings.sound) return null;
    try {
      if (!audioCtx) {
        var Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        audioCtx = new Ctor();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    } catch (err) {
      return null;
    }
  }

  function tone(freq, duration, type, volume, delay) {
    var ac = ctx();
    if (!ac) return;
    var start = ac.currentTime + (delay || 0);
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume || 0.14, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  var sfx = {
    tap: function () { tone(420, 0.06, 'sine', 0.08); },
    flip: function () { tone(620, 0.07, 'triangle', 0.09); },
    good: function () { tone(660, 0.1, 'sine', 0.12); tone(880, 0.14, 'sine', 0.1, 0.08); },
    bad: function () { tone(190, 0.16, 'sawtooth', 0.07); },
    win: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone(f, 0.18, 'sine', 0.11, i * 0.09);
      });
    },
    lose: function () {
      [392, 330, 262].forEach(function (f, i) {
        tone(f, 0.22, 'triangle', 0.09, i * 0.11);
      });
    }
  };

  function buzz(pattern) {
    if (!settings.haptics) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern || 12);
    } catch (err) {}
  }

  // ------------------------------------------------------------- DOM helper
  // h('div.card', { onclick: fn }, 'text', childNode, [more, children])
  function h(spec, props) {
    var parts = String(spec).split('.');
    var tag = parts.shift() || 'div';
    var node = document.createElement(tag);
    if (parts.length) node.className = parts.join(' ');

    var start = 1;
    if (props && typeof props === 'object' && !(props instanceof Node) && !Array.isArray(props)) {
      start = 2;
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') node.className += (node.className ? ' ' : '') + value;
        else if (key === 'html') node.innerHTML = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
        else if (key.indexOf('on') === 0 && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === true) node.setAttribute(key, '');
        else node.setAttribute(key, value);
      });
    }

    for (var i = start; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function append(parent, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) {
      child.forEach(function (c) { append(parent, c); });
    } else if (child instanceof Node) {
      parent.appendChild(child);
    } else {
      parent.appendChild(document.createTextNode(String(child)));
    }
  }

  // ------------------------------------------------------------- small utils
  function shuffle(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function clamp(n, min, max) { return n < min ? min : n > max ? max : n; }

  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // A segmented picker. Every game setup screen wants one of these, so it
  // lives here rather than being copied into each of them.
  function segGroup(label, options, value, onPick) {
    var seg = h('div.seg', { role: 'group' }, options.map(function (opt) {
      return h('button.seg-btn', {
        type: 'button',
        'aria-pressed': opt.value === value ? 'true' : 'false',
        onclick: function (event) {
          sfx.tap();
          Array.prototype.forEach.call(seg.children, function (button) {
            button.setAttribute('aria-pressed', 'false');
          });
          event.currentTarget.setAttribute('aria-pressed', 'true');
          onPick(opt.value);
        }
      }, opt.label);
    }));
    if (!label) return seg;
    return h('div.option-group', null, h('span.option-label', { text: label }), seg);
  }

  // ------------------------------------------------------------------ sheet
  var sheetEl, sheetBody, sheetTitle, sheetBackdrop, lastFocus;

  function openSheet(title, buildBody) {
    lastFocus = document.activeElement;
    sheetTitle.textContent = title;
    sheetBody.innerHTML = '';
    append(sheetBody, buildBody());
    sheetEl.hidden = false;
    sheetBackdrop.hidden = false;
    requestAnimationFrame(function () { sheetEl.classList.add('is-open'); });
    document.body.classList.add('sheet-open');
    sheetEl.querySelector('button, [href], input, select').focus();
  }

  function closeSheet() {
    sheetEl.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    window.setTimeout(function () {
      sheetEl.hidden = true;
      sheetBackdrop.hidden = true;
    }, 200);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function toggleRow(label, description, isOn, onChange) {
    var input = h('input', { type: 'checkbox', role: 'switch' });
    input.checked = isOn;
    input.addEventListener('change', function () { onChange(input.checked); });
    return h('label.toggle-row', null,
      h('span.toggle-copy', null,
        h('span.toggle-label', { text: label }),
        description ? h('span.toggle-desc', { text: description }) : null),
      h('span.toggle-switch', null, input, h('span.toggle-track', { 'aria-hidden': 'true' })));
  }

  // ----------------------------------------------------------- game registry
  var games = [];
  var byId = {};

  function register(game) {
    games.push(game);
    byId[game.id] = game;
  }

  // ---------------------------------------------------------------- routing
  var screen, topbarHeading, backBtn, helpBtn, settingsBtn;
  var current = null; // { game, teardown }

  function unmount() {
    if (current && typeof current.teardown === 'function') {
      try { current.teardown(); } catch (err) { /* keep navigating regardless */ }
    }
    current = null;
    screen.innerHTML = '';
    screen.className = 'screen';
  }

  function route() {
    var hash = window.location.hash.replace(/^#\/?/, '');
    var match = /^g\/([\w-]+)$/.exec(hash);
    unmount();
    if (match && byId[match[1]]) {
      openGame(byId[match[1]]);
    } else {
      renderHub();
    }
    screen.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function go(hash) {
    if (window.location.hash === hash) route();
    else window.location.hash = hash;
  }

  function openGame(game) {
    document.title = game.title + ' · Departures';
    topbarHeading.textContent = game.title;
    backBtn.hidden = false;
    helpBtn.hidden = !game.howTo;
    document.body.setAttribute('data-accent', game.accent || 'sky');
    screen.classList.add('screen-game');
    if (game.fullBleed) screen.classList.add('screen-full');

    var teardown = game.mount(screen, API);
    current = { game: game, teardown: teardown };
  }

  function gameCard(game) {
    var best = game.summary ? game.summary(API) : '';
    return h('a.game-card', {
      href: '#/g/' + game.id,
      'data-accent': game.accent || 'sky',
      onclick: function () { sfx.tap(); }
    },
      h('span.game-emoji', { 'aria-hidden': 'true', text: game.emoji }),
      h('span.game-body', null,
        h('span.game-title', { text: game.title }),
        h('span.game-blurb', { text: game.blurb }),
        h('span.game-meta', null,
          h('span.chip', { text: game.players }),
          h('span.chip', { text: game.ages }),
          best ? h('span.chip.chip-best', { text: best }) : null)),
      h('span.game-go', { 'aria-hidden': 'true', text: '→' }));
  }

  function renderHub() {
    document.title = 'Departures · Offline travel games';
    topbarHeading.textContent = 'Departures';
    backBtn.hidden = true;
    helpBtn.hidden = true;
    document.body.setAttribute('data-accent', 'sky');

    var intro = h('section.hub-intro', null,
      h('p.hub-kicker', { text: 'Gate open · no signal needed' }),
      h('h2.hub-heading', { text: 'Six games for the airport and the plane.' }),
      h('p.hub-sub', { text: 'Everything works in flight mode, saves as you go, and never asks for the internet. Pass the phone around — half of these are best played together.' }));

    var offlineChip = h('div.offline-chip', { id: 'offline-chip' },
      h('span.dot', { 'aria-hidden': 'true' }),
      h('span', { id: 'offline-text', text: 'Saving the games to your phone…' }));

    var grid = h('div.game-grid', null, games.map(gameCard));

    var shuffleBtn = h('button.btn.btn-primary.hub-shuffle', {
      onclick: function () {
        sfx.tap();
        buzz();
        go('#/g/' + pick(games).id);
      }
    }, '🎲 Surprise me');

    var tips = h('details.tips', null,
      h('summary', { text: 'Before you fly — read this bit' }),
      h('ul.tip-list', null,
        h('li', { html: '<strong>Add it to your home screen while you still have wi-fi.</strong> On iPhone: Share → Add to Home Screen. On Android: menu → Install app. It then opens like a normal app, in flight mode, with no browser bar.' }),
        h('li', { html: '<strong>Sound is off by default</strong> — turn it on in ⚙ if you have headphones, or leave it off for a quiet cabin.' }),
        h('li', { html: '<strong>Everything saves automatically.</strong> Scores, half-finished bingo cards and quiz teams all survive the phone being locked or the app being closed.' }),
        h('li', { html: '<strong>Dark by default</strong> to be kind to a dark cabin and your battery. Switch to light in ⚙.' })));

    append(screen, [intro, offlineChip, grid, shuffleBtn, tips,
      h('p.foot-note', null, 'Made for two impatient kids and one long flight. ',
        h('a', { href: '/', text: 'jsip.uk' }))]);

    updateOfflineChip();
  }

  // ------------------------------------------------------- offline readiness
  var offlineReady = false;

  function updateOfflineChip() {
    var chip = document.getElementById('offline-chip');
    var text = document.getElementById('offline-text');
    if (!chip || !text) return;
    if (!('serviceWorker' in navigator)) {
      chip.classList.add('is-warn');
      text.textContent = 'This browser cannot save the games offline — keep the tab open.';
    } else if (offlineReady) {
      chip.classList.add('is-ready');
      text.textContent = 'Saved to your phone — ready to play with no signal.';
    } else {
      text.textContent = 'Saving the games to your phone…';
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      if (navigator.serviceWorker.controller) {
        offlineReady = true;
        updateOfflineChip();
      }
      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          if (sw.state === 'installed') {
            offlineReady = true;
            updateOfflineChip();
          }
        });
      });
    }).catch(function () { /* offline-first is a bonus, never a blocker */ });

    navigator.serviceWorker.addEventListener('controllerchange', function () {
      offlineReady = true;
      updateOfflineChip();
    });
  }

  // --------------------------------------------------------- settings sheet
  function settingsSheet() {
    var wrap = h('div.settings-list');

    append(wrap, toggleRow('Sound', 'Little blips and jingles. Off is best in a quiet cabin.',
      settings.sound, function (on) {
        settings.sound = on;
        saveSettings();
        if (on) sfx.good();
      }));

    append(wrap, toggleRow('Vibration', 'A gentle buzz when you tap things.',
      settings.haptics, function (on) {
        settings.haptics = on;
        saveSettings();
        if (on) buzz(20);
      }));

    append(wrap, h('div.seg-row', null,
      h('span.toggle-label', { text: 'Look' }),
      segGroup(null, [
        { value: 'dark', label: 'Night' },
        { value: 'light', label: 'Day' },
        { value: 'auto', label: 'Auto' }
      ], settings.theme, function (mode) {
        settings.theme = mode;
        saveSettings();
      })));

    append(wrap, h('div.sheet-note', null,
      h('p', { text: 'Departures keeps your scores in this browser, on this device. Nothing is sent anywhere, and it never needs a connection once it has loaded.' }),
      h('p.reset-explainer', { html: 'The button below is a <strong>fresh start for Departures only</strong>. It clears the high scores, saved word puzzle, bingo cards, quiz records and the settings on this page. It cannot touch anything else &mdash; not your photos, not other apps, not other websites, and not the copy of the games saved for offline play. You can carry on playing straight afterwards.' }),
      h('button.btn.btn-quiet', {
        onclick: function () {
          var message = 'Start Departures over?\n\n' +
            'This clears the Departures high scores, saved puzzles, bingo cards and settings stored in this browser.\n\n' +
            'It does not affect anything else on your device, and the games will still work offline afterwards.';
          if (!window.confirm(message)) return;
          try {
            Object.keys(localStorage)
              .filter(function (k) { return k.indexOf(STORE_PREFIX) === 0; })
              .forEach(function (k) { localStorage.removeItem(k); });
          } catch (err) {}
          settings.sound = false;
          settings.haptics = true;
          settings.theme = 'dark';
          saveSettings();
          closeSheet();
          go('#/');
          route();
        }
      }, 'Clear Departures scores and start over'),
      h('p.version-note', { text: 'Departures ' + VERSION + ' · plays with no signal' })));

    return wrap;
  }

  function helpSheet(game) {
    return h('div.help-body', null,
      h('ul.help-list', null, game.howTo.map(function (line) {
        return h('li', { html: line });
      })));
  }

  // ------------------------------------------------------------- public API
  var API = {
    store: store,
    settings: settings,
    sfx: sfx,
    buzz: buzz,
    h: h,
    append: append,
    segGroup: segGroup,
    shuffle: shuffle,
    pick: pick,
    clamp: clamp,
    plural: plural,
    prefersReducedMotion: prefersReducedMotion,
    go: go,
    exit: function () { go('#/'); },
    openSheet: openSheet,
    closeSheet: closeSheet
  };

  function boot() {
    screen = document.getElementById('screen');
    topbarHeading = document.getElementById('topbar-heading');
    backBtn = document.getElementById('back-btn');
    helpBtn = document.getElementById('help-btn');
    settingsBtn = document.getElementById('settings-btn');
    sheetEl = document.getElementById('sheet');
    sheetBody = document.getElementById('sheet-body');
    sheetTitle = document.getElementById('sheet-title');
    sheetBackdrop = document.getElementById('sheet-backdrop');

    applyTheme();

    backBtn.addEventListener('click', function () { sfx.tap(); go('#/'); });
    settingsBtn.addEventListener('click', function () {
      sfx.tap();
      openSheet('Settings', settingsSheet);
    });
    helpBtn.addEventListener('click', function () {
      if (!current || !current.game.howTo) return;
      sfx.tap();
      openSheet('How to play · ' + current.game.title, function () {
        return helpSheet(current.game);
      });
    });
    document.getElementById('sheet-close').addEventListener('click', closeSheet);
    sheetBackdrop.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (event) {
      if (sheetEl.hidden) return;
      if (event.key === 'Escape') {
        closeSheet();
        return;
      }
      if (event.key !== 'Tab') return;
      // Keep tabbing inside the open sheet rather than wandering off behind it.
      var focusable = sheetEl.querySelectorAll('button, [href], input, select, textarea');
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    var onSchemeChange = function () { if (settings.theme === 'auto') applyTheme(); };
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSchemeChange);
    else if (darkQuery.addListener) darkQuery.addListener(onSchemeChange);

    window.addEventListener('hashchange', route);
    route();
    registerServiceWorker();
  }

  window.Departures = {
    register: register,
    games: games,
    api: API,
    boot: boot
  };
})();
