/* ===========================================================================
   Dino Expedition — app logic (vanilla JS, no build step, no tracking)
   Progress is stored only in this browser via localStorage.
   =========================================================================== */
(function () {
  'use strict';

  const STORE_KEY = 'dinoExpedition.v1';
  const stage = document.getElementById('main');
  const toastEl = document.getElementById('toast');

  /* ── Persistent progress ────────────────────────────────────────────── */
  const defaultState = () => ({
    name: '',
    onboarded: false,
    discovered: {},      // creatureId -> true
    quizBest: 0,
    digsDone: 0,
    habitatDone: false,
    badges: {},          // badgeId -> true
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { return defaultState(); }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }
  let state = load();

  /* ── Badge definitions ──────────────────────────────────────────────── */
  const BADGES = [
    { id: 'first_dino',  emoji: '🔎', name: 'First Find',     desc: 'Discover your first dinosaur' },
    { id: 'explorer',    emoji: '🧭', name: 'Explorer',       desc: 'Discover 5 different creatures' },
    { id: 'palaeo',      emoji: '🏆', name: 'Palaeontologist', desc: 'Discover every creature' },
    { id: 'digger',      emoji: '⛏️', name: 'Fossil Digger',  desc: 'Finish a fossil dig' },
    { id: 'detective',   emoji: '🕵️', name: 'Dino Detective', desc: 'Get every quiz question right' },
    { id: 'ranger',      emoji: '🗺️', name: 'Habitat Ranger', desc: 'Build a complete habitat' },
  ];

  function discoveredCount() { return Object.keys(state.discovered).length; }

  function discover(id, quiet) {
    if (!state.discovered[id]) {
      state.discovered[id] = true;
      if (!quiet) toast('New discovery! ' + (byId(id)?.name || ''));
    }
    // milestone badges
    if (discoveredCount() >= 1) grantBadge('first_dino', true);
    if (discoveredCount() >= 5) grantBadge('explorer', true);
    if (discoveredCount() >= ALL_CREATURES.length) grantBadge('palaeo', true);
    save();
    refreshChrome();
  }

  function grantBadge(id, quiet) {
    if (state.badges[id]) return false;
    state.badges[id] = true;
    save();
    const b = BADGES.find((x) => x.id === id);
    if (b && !quiet) toast(b.emoji + ' Badge earned: ' + b.name + '!');
    refreshChrome();
    return true;
  }

  /* ── Small DOM helpers ──────────────────────────────────────────────── */
  function el(tag, attrs, kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach((c) => {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  const byId = (id) => ALL_CREATURES.find((d) => d.id === id);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const dietWord = (d) => d === 'herbivore' ? 'Plant-eater' : d === 'carnivore' ? 'Meat-eater' : 'Eats both';

  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => { toastEl.hidden = true; }, 300);
    }, 2400);
  }

  /* ── Chrome (top bar count + active tab) ────────────────────────────── */
  function refreshChrome() {
    document.getElementById('badgeNum').textContent = discoveredCount();
  }
  function setActiveTab(route) {
    document.querySelectorAll('.tab').forEach((t) => {
      const on = t.getAttribute('data-go') === route;
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
  }

  /* ── Reusable bits ──────────────────────────────────────────────────── */
  function dietTag(d) { return el('span', { class: 'tag tag-' + d, text: dietWord(d) }); }
  function periodTag(p) { return el('span', { class: 'tag tag-period', text: PERIODS[p].name }); }

  function backButton(label, route) {
    return el('button', { class: 'back-link', onclick: () => go(route) }, ['← ', label]);
  }

  function dinoCard(d) {
    const found = !!state.discovered[d.id];
    const card = el('button', {
      class: 'dino-card' + (found ? '' : ' locked'),
      onclick: () => go('dino/' + d.id),
      'aria-label': d.name + (found ? ', discovered' : ', not yet discovered') + '. Open field guide.',
    }, [
      el('span', { class: 'dc-art', 'aria-hidden': 'true', text: d.emoji }),
      el('span', { class: 'dc-body' }, [
        el('h3', { text: d.name }),
        el('span', { class: 'dc-say', text: 'say: ' + d.say }),
        el('span', { class: 'dc-tags' }, [periodTag(d.period), dietTag(d.diet)]),
      ]),
    ]);
    if (found) card.appendChild(el('span', { class: 'star-pill', 'aria-hidden': 'true', text: '⭐' }));
    if (d.notADino) card.appendChild(el('span', { class: 'notdino-pill', text: 'Not a dino' }));
    return card;
  }

  /* ── Router ─────────────────────────────────────────────────────────── */
  const routes = {
    home: renderHome,
    explorer: renderExplorer,
    dig: renderDig,
    quiz: renderQuiz,
    habitat: renderHabitat,
    collection: renderCollection,
    guide: renderGuide,
    grownups: renderGrownups,
    dino: renderDetail,
  };

  function go(route) { location.hash = '#/' + route; }

  function router() {
    const hash = location.hash.replace(/^#\/?/, '') || 'home';
    const [name, param] = hash.split('/');
    const fn = routes[name] || renderHome;
    stage.innerHTML = '';
    fn(param);
    setActiveTab(['home', 'explorer', 'dig', 'quiz', 'habitat', 'collection'].includes(name) ? name : '');
    stage.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ── Screen: Home / Camp ────────────────────────────────────────────── */
  function renderHome() {
    const s = el('div', { class: 'screen' });
    const hi = state.name ? el('p', { class: 'greeting', html: 'Welcome back, Explorer ' + escapeHtml(state.name) + '! 🎒' }) : null;

    const hero = el('section', { class: 'hero' }, [
      el('span', { class: 'hero-dinos', 'aria-hidden': 'true', html: '<span>🦕</span><span>🦖</span>' }),
      el('p', { class: 'hero-eyebrow', text: 'Field expedition' }),
      el('h1', { text: 'Dino Expedition' }),
      el('p', { text: 'Explore real dinosaurs, dig up fossils, and become a dino expert!' }),
      el('div', { class: 'hero-actions' }, [
        el('button', { class: 'btn btn-lg', onclick: () => go('explorer') }, ['🔎 Start exploring']),
        el('button', { class: 'btn btn-jungle', onclick: () => go('dig') }, ['⛏️ Dig fossils']),
      ]),
    ]);

    const activities = [
      { go: 'guide', ico: '📖', tag: 'Start here', t: 'How to Play', p: 'New here? See how every game and activity works.' },
      { go: 'explorer', ico: '🔎', tag: 'Field guide', t: 'Dino Explorer', p: 'Meet the dinosaurs and sort them by time, food and home.' },
      { go: 'dig', ico: '⛏️', tag: 'Mini-game', t: 'Fossil Dig', p: 'Brush away the dirt to uncover hidden fossils.' },
      { go: 'quiz', ico: '🕵️', tag: 'Challenge', t: 'Dino Detective', p: 'Answer fun questions and test what you know.' },
      { go: 'habitat', ico: '🗺️', tag: 'Activity', t: 'Build a Habitat', p: 'Send each dinosaur to the home that suits it best.' },
      { go: 'collection', ico: '⭐', tag: 'Progress', t: 'My Badges', p: 'See the creatures you found and badges you earned.' },
      { go: 'grownups', ico: '👋', tag: 'For adults', t: 'Grown-ups', p: 'Learning goals, safety and where our facts come from.' },
    ];
    const menu = el('div', { class: 'menu-grid' }, activities.map((a) =>
      el('button', { class: 'menu-card', onclick: () => go(a.go) }, [
        el('span', { class: 'mc-ico', 'aria-hidden': 'true', text: a.ico }),
        el('h3', { text: a.t }),
        el('p', { text: a.p }),
        el('span', { class: 'mc-tag', text: a.tag }),
      ])
    ));

    const fact = BIG_FACTS[(Math.random() * BIG_FACTS.length) | 0];
    const strip = el('div', { class: 'fact-strip' }, [
      el('span', { class: 'fs-ico', 'aria-hidden': 'true', text: '💡' }),
      el('p', { html: '<strong>Did you know?</strong> ' + escapeHtml(fact) }),
    ]);

    if (hi) s.appendChild(hi);
    s.appendChild(hero);
    s.appendChild(el('h2', { class: 'screen-title', style: 'margin:18px 0 12px', text: 'Choose your adventure' }));
    s.appendChild(menu);
    s.appendChild(strip);
    stage.appendChild(s);
  }

  /* ── Screen: Explorer ───────────────────────────────────────────────── */
  const filterState = { period: 'all', diet: 'all', habitat: 'all' };

  function renderExplorer() {
    const s = el('div', { class: 'screen' });
    s.appendChild(el('div', { class: 'screen-head' }, [
      el('h1', { class: 'screen-title', text: '🔎 Dino Explorer' }),
      el('p', { class: 'screen-sub', text: 'Tap a card to open its field guide. Sort them below!' }),
    ]));

    const grid = el('div', { class: 'dino-grid' });

    function chip(group, value, label, emoji) {
      return el('button', {
        class: 'chip', 'aria-pressed': String(filterState[group] === value),
        onclick: (e) => {
          filterState[group] = value;
          s.querySelectorAll('[data-group="' + group + '"]').forEach((c) =>
            c.setAttribute('aria-pressed', String(c === e.currentTarget)));
          paint();
        },
        'data-group': group,
      }, [emoji ? emoji + ' ' : '', label]);
    }

    const filters = el('div', { class: 'filters' }, [
      el('div', { class: 'filter-group' }, [
        el('div', { class: 'filter-label', text: 'When they lived' }),
        el('div', { class: 'chips' }, [
          chip('period', 'all', 'All'),
          ...Object.values(PERIODS).map((p) => chip('period', p.id, p.name, p.emoji)),
        ]),
      ]),
      el('div', { class: 'filter-group' }, [
        el('div', { class: 'filter-label', text: 'What they ate' }),
        el('div', { class: 'chips' }, [
          chip('diet', 'all', 'All'),
          chip('diet', 'herbivore', 'Plant-eaters', '🌿'),
          chip('diet', 'carnivore', 'Meat-eaters', '🍖'),
        ]),
      ]),
      el('div', { class: 'filter-group' }, [
        el('div', { class: 'filter-label', text: 'Where they lived' }),
        el('div', { class: 'chips' }, [
          chip('habitat', 'all', 'All'),
          ...Object.values(HABITATS).map((h) => chip('habitat', h.id, h.name.split(' ')[0], h.emoji)),
        ]),
      ]),
    ]);

    function paint() {
      grid.innerHTML = '';
      const list = ALL_CREATURES.filter((d) =>
        (filterState.period === 'all' || d.period === filterState.period) &&
        (filterState.diet === 'all' || d.diet === filterState.diet) &&
        (filterState.habitat === 'all' || (d.habitat || []).includes(filterState.habitat)));
      if (!list.length) {
        grid.appendChild(el('p', { class: 'empty', text: 'No creatures match those choices. Try different buttons! 🦕' }));
        return;
      }
      list.forEach((d) => grid.appendChild(dinoCard(d)));
    }

    s.appendChild(filters);
    s.appendChild(grid);
    stage.appendChild(s);
    paint();
  }

  /* ── Screen: Dino detail / recap ────────────────────────────────────── */
  function renderDetail(id) {
    const d = byId(id);
    if (!d) { go('explorer'); return; }
    discover(d.id, true); // opening the guide counts as a discovery

    const s = el('div', { class: 'screen detail' });
    s.appendChild(backButton('Back to explorer', 'explorer'));

    s.appendChild(el('div', { class: 'detail-art' }, [
      el('span', { class: 'da-emoji', 'aria-hidden': 'true', text: d.emoji }),
    ]));

    if (d.notADino) {
      s.appendChild(el('div', { class: 'notdino-banner' }, [
        el('span', { 'aria-hidden': 'true', text: '⚠️' }),
        el('span', { text: 'Surprise! This is a flying reptile, not a dinosaur — but it lived at the same time.' }),
      ]));
    }

    s.appendChild(el('h1', { text: d.name }));
    s.appendChild(el('p', { class: 'say', text: 'Say it: ' + d.say + (d.nick ? '  ·  also called ' + d.nick : '') }));

    // How big is it? — a relatable size comparison for young children
    if (d.compare) {
      s.appendChild(el('div', { class: 'size-compare' }, [
        el('span', { class: 'sc-ico', 'aria-hidden': 'true', text: d.compare.icon }),
        el('span', { class: 'sc-body' }, [
          el('span', { class: 'sc-k', text: '📏 How big is it?' }),
          el('span', { class: 'sc-v', text: d.compare.text }),
          el('span', { class: 'sc-sub', text: d.length }),
        ]),
        el('span', { class: 'sc-kid', 'aria-hidden': 'true', title: 'a child, for size', text: '🧒' }),
      ]));
    }

    const facts = [
      { ico: '⏳', k: 'When', v: d.when },
      { ico: d.diet === 'carnivore' ? '🍖' : '🌿', k: 'Food', v: dietWord(d.diet) },
      { ico: '🌍', k: 'Found in', v: d.region },
      { ico: '🏞️', k: 'Home', v: (d.habitat || []).map((h) => HABITATS[h].name).join(' · ') },
      { ico: '🦴', k: 'Discovery', v: d.discovery },
    ];
    s.appendChild(el('div', { class: 'fact-list' }, facts.map((f) =>
      el('div', { class: 'fact' }, [
        el('span', { class: 'f-ico', 'aria-hidden': 'true', text: f.ico }),
        el('span', {}, [el('span', { class: 'f-k', text: f.k }), el('br'), el('span', { class: 'f-v', text: f.v })]),
      ])
    )));

    s.appendChild(el('div', { class: 'think' }, [
      el('div', { class: 'think-k' }, [el('span', { 'aria-hidden': 'true', text: '🔬' }), 'What scientists think']),
      el('div', { text: d.scientistsThink }),
    ]));

    s.appendChild(el('div', { class: 'fact' }, [
      el('span', { class: 'f-ico', 'aria-hidden': 'true', text: '✨' }),
      el('span', {}, [el('span', { class: 'f-k', text: 'Fun fact' }), el('br'), el('span', { class: 'f-v', text: d.funFact })]),
    ]));

    s.appendChild(el('p', { class: 'source-note', text: 'Fact sources: ' + d.source + '.' }));

    // next / prev style quick actions
    s.appendChild(el('div', { class: 'hero-actions', style: 'margin-top:16px' }, [
      el('button', { class: 'btn btn-jungle', onclick: () => go('quiz') }, ['🕵️ Test me on this']),
      el('button', { class: 'btn btn-ghost', onclick: () => go('explorer') }, ['🔎 More dinosaurs']),
    ]));

    stage.appendChild(s);
  }

  /* ── Screen: Fossil Dig ─────────────────────────────────────────────── */
  function renderDig() {
    const s = el('div', { class: 'screen dig-wrap' });
    s.appendChild(el('div', { class: 'screen-head' }, [
      el('h1', { class: 'screen-title', text: '⛏️ Fossil Dig' }),
      el('p', { class: 'screen-sub', text: 'Tap the dirt to brush it away and uncover the buried fossil!' }),
    ]));

    const target = ALL_CREATURES[(Math.random() * ALL_CREATURES.length) | 0];
    const TOTAL = 16, BONES = 6;
    const boneCells = new Set(shuffle([...Array(TOTAL).keys()]).slice(0, BONES));
    let found = 0, revealed = false;

    const meterFill = el('i');
    const meter = el('div', { class: 'dig-meter' }, [meterFill]);
    const status = el('p', { class: 'screen-sub', style: 'margin-top:8px', text: 'Fossils found: 0 of ' + BONES });
    const grid = el('div', { class: 'dig-grid', role: 'grid', 'aria-label': 'Dig site' });
    const revealHost = el('div');

    for (let i = 0; i < TOTAL; i++) {
      const cell = el('button', {
        class: 'dig-cell', 'aria-label': 'Dig here', role: 'gridcell',
        onclick: () => digCell(i, cell),
      });
      grid.appendChild(cell);
    }

    function digCell(i, cell) {
      if (cell.classList.contains('dug') || revealed) return;
      cell.classList.add('dug');
      cell.disabled = true;
      if (boneCells.has(i)) {
        cell.textContent = '🦴';
        cell.setAttribute('aria-label', 'Fossil bone found');
        found++;
        meterFill.style.width = Math.round((found / BONES) * 100) + '%';
        status.textContent = 'Fossils found: ' + found + ' of ' + BONES;
        if (found < BONES) toast('Nice digging! 🦴');
        if (found >= BONES) finish();
      } else {
        cell.textContent = '·';
        cell.classList.add('empty-cell');
        cell.setAttribute('aria-label', 'Just dirt here');
      }
    }

    function finish() {
      revealed = true;
      state.digsDone++;
      grantBadge('digger');
      discover(target.id);
      const panel = el('div', { class: 'dig-reveal' }, [
        el('div', { class: 'dr-emoji', 'aria-hidden': 'true', text: target.emoji }),
        el('h2', { text: 'You uncovered ' + target.name + '!' }),
        el('p', { class: 'say', text: 'Say it: ' + target.say }),
        el('p', { style: 'font-weight:700;margin:8px 0', text: target.funFact }),
        el('div', { class: 'hero-actions', style: 'justify-content:center' }, [
          el('button', { class: 'btn btn-jungle', onclick: () => go('dino/' + target.id) }, ['📖 Read its field guide']),
          el('button', { class: 'btn btn-ghost', onclick: () => go('dig') }, ['⛏️ Dig again']),
        ]),
      ]);
      revealHost.appendChild(panel);
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    s.appendChild(grid);
    s.appendChild(meter);
    s.appendChild(status);
    s.appendChild(revealHost);
    stage.appendChild(s);
  }

  /* ── Screen: Quiz / Dino Detective ──────────────────────────────────── */
  function buildQuiz() {
    const dinos = DINOS.slice();
    const qs = [];

    // Diet questions
    shuffle(dinos).slice(0, 2).forEach((d) => {
      qs.push({
        emoji: d.emoji,
        q: 'What did ' + d.name + ' eat?',
        options: ['Plants 🌿', 'Meat 🍖', 'Both 🍽️'],
        correct: d.diet === 'herbivore' ? 0 : d.diet === 'carnivore' ? 1 : 2,
        yay: d.name + ' was a ' + dietWord(d.diet).toLowerCase() + '.',
      });
    });

    // Period questions
    shuffle(dinos).slice(0, 2).forEach((d) => {
      const opts = Object.values(PERIODS);
      qs.push({
        emoji: d.emoji,
        q: 'When did ' + d.name + ' live?',
        options: opts.map((p) => p.name),
        correct: opts.findIndex((p) => p.id === d.period),
        yay: d.name + ' lived in the ' + PERIODS[d.period].name + ' period.',
      });
    });

    // Size / scale myth-buster question
    qs.push({
      emoji: '📏',
      q: 'Real Velociraptor was about the size of a...?',
      options: ['Large turkey 🦃', 'Bus 🚌', 'House 🏠'],
      correct: 0,
      yay: 'Yes! Real Velociraptor was only about turkey-sized — much smaller than in films.',
    });

    // Not-a-dino question
    const realOnes = shuffle(DINOS).slice(0, 2).map((d) => d.name);
    const ndOpts = shuffle([...realOnes, 'Pteranodon']);
    qs.push({
      emoji: '🦅',
      q: 'Which of these is NOT a dinosaur?',
      options: ndOpts,
      correct: ndOpts.indexOf('Pteranodon'),
      yay: 'Right! Pteranodon was a flying reptile (a pterosaur), not a dinosaur.',
    });

    return shuffle(qs);
  }

  function renderQuiz() {
    const s = el('div', { class: 'screen' });
    s.appendChild(el('div', { class: 'screen-head' }, [
      el('h1', { class: 'screen-title', text: '🕵️ Dino Detective' }),
      el('p', { class: 'screen-sub', text: 'Answer the questions. There is no rush — take your time!' }),
    ]));

    const questions = buildQuiz();
    let idx = 0, score = 0;
    const host = el('div');
    s.appendChild(host);
    stage.appendChild(s);
    paintQuestion();

    function paintQuestion() {
      host.innerHTML = '';
      if (idx >= questions.length) return paintResult();
      const q = questions[idx];

      const prog = el('div', { class: 'quiz-progress' },
        questions.map((_, i) => el('i', { class: i < idx ? 'done' : i === idx ? 'current' : '' })));

      const feedback = el('p', { class: 'quiz-feedback', 'aria-live': 'polite' });
      const answers = el('div', { class: 'answers' });

      q.options.forEach((opt, i) => {
        const b = el('button', { class: 'answer', onclick: () => choose(i, b) }, [
          el('span', { text: opt }),
        ]);
        answers.appendChild(b);
      });

      function choose(i, btn) {
        Array.from(answers.children).forEach((c) => { c.disabled = true; });
        const correct = i === q.correct;
        if (correct) {
          btn.classList.add('correct');
          btn.appendChild(el('span', { class: 'a-mark', 'aria-hidden': 'true', text: '✅' }));
          feedback.className = 'quiz-feedback good';
          feedback.textContent = '🎉 ' + q.yay;
          score++;
        } else {
          btn.classList.add('wrong');
          btn.appendChild(el('span', { class: 'a-mark', 'aria-hidden': 'true', text: '🤔' }));
          const right = answers.children[q.correct];
          right.classList.add('correct');
          feedback.className = 'quiz-feedback tryagain';
          feedback.textContent = 'Good try! ' + q.yay;
        }
        host.appendChild(el('div', { style: 'margin-top:16px' }, [
          el('button', { class: 'btn btn-jungle btn-block', onclick: () => { idx++; paintQuestion(); } },
            [idx + 1 < questions.length ? 'Next question →' : 'See my score →']),
        ]));
      }

      const card = el('div', { class: 'quiz-card' }, [
        prog,
        el('div', { class: 'quiz-q' }, [
          el('span', { class: 'q-emoji', 'aria-hidden': 'true', text: q.emoji }),
          q.q,
        ]),
        answers,
        feedback,
      ]);
      host.appendChild(card);
    }

    function paintResult() {
      const total = questions.length;
      if (score > state.quizBest) { state.quizBest = score; save(); }
      if (score === total) grantBadge('detective');
      const perfect = score === total;
      const emoji = perfect ? '🏆' : score >= total / 2 ? '🌟' : '🦕';
      const msg = perfect ? 'Amazing! A perfect score!' :
        score >= total / 2 ? 'Great detective work!' : 'Good effort — every expert keeps practising!';
      host.appendChild(el('div', { class: 'quiz-card quiz-result' }, [
        el('div', { class: 'qr-emoji', 'aria-hidden': 'true', text: emoji }),
        el('div', { class: 'score-ring', text: score + ' / ' + total }),
        el('p', { style: 'font-weight:800;margin:6px 0 16px', text: msg }),
        el('div', { class: 'hero-actions', style: 'justify-content:center' }, [
          el('button', { class: 'btn btn-jungle', onclick: () => go('quiz') }, ['🔁 Play again']),
          el('button', { class: 'btn btn-ghost', onclick: () => go('explorer') }, ['🔎 Explore dinos']),
        ]),
      ]));
    }
  }

  /* ── Screen: Build a Habitat ────────────────────────────────────────── */
  function renderHabitat() {
    const s = el('div', { class: 'screen' });
    s.appendChild(el('div', { class: 'screen-head' }, [
      el('h1', { class: 'screen-title', text: '🗺️ Build a Habitat' }),
      el('p', { class: 'screen-sub', text: 'Pick a dinosaur, then tap the home where it belongs.' }),
    ]));

    // pick 6 creatures, each matched to its first habitat zone
    const picks = shuffle(DINOS).slice(0, 6);
    const usedZones = [...new Set(picks.map((d) => d.habitat[0]))];
    // make sure we show zones that are actually needed (+ keep order tidy)
    const zoneIds = Object.keys(HABITATS).filter((z) => usedZones.includes(z));

    let selected = null;
    let placedCount = 0;
    const total = picks.length;

    const tray = el('div', { class: 'tray' });
    const tokens = {};
    picks.forEach((d) => {
      const tk = el('button', {
        class: 'token', 'aria-pressed': 'false',
        'aria-label': 'Choose ' + d.name,
        onclick: () => selectToken(d.id),
      }, [
        el('span', { class: 'tk-emoji', 'aria-hidden': 'true', text: d.emoji }),
        el('span', { class: 'tk-name', text: d.name }),
      ]);
      tokens[d.id] = tk;
      tray.appendChild(tk);
    });

    function selectToken(id) {
      if (tokens[id].getAttribute('aria-disabled') === 'true') return;
      selected = selected === id ? null : id;
      Object.entries(tokens).forEach(([tid, t]) =>
        t.setAttribute('aria-pressed', String(tid === selected)));
      hint.textContent = selected
        ? 'Now tap the home for ' + byId(selected).name + '!'
        : 'Pick a dinosaur to begin.';
    }

    const board = el('div', { class: 'habitat-board' });
    zoneIds.forEach((zid) => {
      const h = HABITATS[zid];
      const drop = el('div', { class: 'hz-drop' });
      const zone = el('div', {
        class: 'habitat-zone zone-' + zid, role: 'button', tabindex: '0',
        'aria-label': 'Place dinosaur in ' + h.name,
        onclick: () => placeIn(zid, zone, drop),
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); placeIn(zid, zone, drop); } },
      }, [
        el('h3', {}, [el('span', { 'aria-hidden': 'true', text: h.emoji }), ' ' + h.name]),
        el('p', { class: 'hz-blurb', text: h.blurb }),
        drop,
      ]);
      board.appendChild(zone);
    });

    function placeIn(zid, zone, drop) {
      if (!selected) { toast('Pick a dinosaur first! 👆'); return; }
      const d = byId(selected);
      if (d.habitat.includes(zid)) {
        const tk = tokens[d.id];
        tk.classList.add('placed-ok');
        tk.setAttribute('aria-disabled', 'true');
        tk.setAttribute('aria-pressed', 'false');
        tk.disabled = true;
        drop.appendChild(tk);
        placedCount++;
        selected = null;
        hint.textContent = 'Great match! ' + (total - placedCount) + ' to go.';
        toast('Perfect home for ' + d.name + '! ✅');
        if (placedCount >= total) win();
      } else {
        zone.classList.add('over');
        setTimeout(() => zone.classList.remove('over'), 500);
        toast(d.name + ' would not be happy there — try another home!');
      }
    }

    function win() {
      state.habitatDone = true;
      grantBadge('ranger');
      hint.innerHTML = '🎉 You built a complete habitat! Every dinosaur is home.';
      const again = el('div', { class: 'hero-actions', style: 'justify-content:center;margin-top:14px' }, [
        el('button', { class: 'btn btn-jungle', onclick: () => go('habitat') }, ['🔁 Play again']),
        el('button', { class: 'btn btn-ghost', onclick: () => go('collection') }, ['⭐ See my badges']),
      ]);
      s.appendChild(again);
      again.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const hint = el('p', { class: 'greeting', style: 'text-align:center;margin:4px 0 12px', text: 'Pick a dinosaur to begin.' });

    s.appendChild(hint);
    s.appendChild(tray);
    s.appendChild(el('p', { class: 'filter-label', style: 'margin:16px 0 8px', text: 'Habitats' }));
    s.appendChild(board);
    stage.appendChild(s);
  }

  /* ── Screen: Collection / Badges ────────────────────────────────────── */
  function renderCollection() {
    const s = el('div', { class: 'screen' });
    const found = discoveredCount();
    const total = ALL_CREATURES.length;
    const pct = Math.round((found / total) * 100);

    s.appendChild(el('div', { class: 'progress-banner' }, [
      el('h2', { text: (state.name ? 'Explorer ' + state.name + "'s" : 'My') + ' expedition' }),
      el('p', { style: 'font-weight:700', text: 'You have discovered ' + found + ' of ' + total + ' creatures.' }),
      el('div', { class: 'bigbar' }, [el('i', { style: 'width:' + pct + '%' })]),
    ]));

    s.appendChild(el('h2', { class: 'screen-title', style: 'font-size:1.4rem;margin:6px 0 10px', text: '🏅 Badges' }));
    s.appendChild(el('div', { class: 'badge-grid' }, BADGES.map((b) => {
      const earned = !!state.badges[b.id];
      return el('div', { class: 'mini-badge ' + (earned ? 'earned' : 'locked') }, [
        el('div', { class: 'mb-emoji', 'aria-hidden': 'true', text: b.emoji }),
        el('div', { class: 'mb-name', text: b.name }),
        el('div', { class: 'mb-state', text: earned ? '✓ Earned' : b.desc }),
      ]);
    })));

    s.appendChild(el('h2', { class: 'screen-title', style: 'font-size:1.4rem;margin:20px 0 10px', text: '🦕 My discoveries' }));
    const grid = el('div', { class: 'dino-grid' });
    ALL_CREATURES.forEach((d) => grid.appendChild(dinoCard(d)));
    s.appendChild(grid);

    s.appendChild(el('div', { style: 'text-align:center;margin-top:22px' }, [
      el('button', {
        class: 'btn btn-ghost', onclick: resetProgress,
      }, ['🧹 Start a fresh expedition']),
    ]));

    stage.appendChild(s);
  }

  function resetProgress() {
    if (!confirm('This will clear your badges and discoveries on this device. Start fresh?')) return;
    state = defaultState();
    save();
    refreshChrome();
    toast('All cleared — ready for a new adventure! 🌱');
    go('home');
  }

  /* ── Screen: How to Play guide ──────────────────────────────────────── */
  function renderGuide() {
    const s = el('div', { class: 'screen' });
    s.appendChild(backButton('Back to camp', 'home'));
    s.appendChild(el('div', { class: 'screen-head' }, [
      el('h1', { class: 'screen-title', text: '📖 How to Play' }),
      el('p', { class: 'screen-sub', text: 'Here is everything you can do on your expedition. Tap any one to jump straight in!' }),
    ]));

    const steps = [
      { go: 'explorer', ico: '🔎', t: 'Dino Explorer', p: 'Tap a dinosaur card to open its field guide. Use the buttons at the top to sort them by when they lived, what they ate, or where they lived — and see how big each one really was!' },
      { go: 'dig', ico: '⛏️', t: 'Fossil Dig', p: 'Tap the squares of dirt to brush them away. Find all the hidden fossil bones to uncover a mystery dinosaur.' },
      { go: 'quiz', ico: '🕵️', t: 'Dino Detective', p: 'Read each question and tap your answer. Green means correct! There is no timer, so take your time and learn as you go.' },
      { go: 'habitat', ico: '🗺️', t: 'Build a Habitat', p: 'Tap a dinosaur to pick it up, then tap the home where it belongs. Match them all to win!' },
      { go: 'collection', ico: '⭐', t: 'My Badges', p: 'See every creature you have discovered and the badges you have earned. The more you explore, the more you collect!' },
    ];

    s.appendChild(el('div', { class: 'guide-list' }, steps.map((st) =>
      el('button', { class: 'guide-step', onclick: () => go(st.go), 'aria-label': st.t + '. ' + st.p }, [
        el('span', { class: 'gs-ico', 'aria-hidden': 'true', text: st.ico }),
        el('span', { class: 'gs-body' }, [el('h3', { text: st.t }), el('p', { text: st.p })]),
        el('span', { class: 'gs-go', 'aria-hidden': 'true', text: '→' }),
      ])
    )));

    s.appendChild(el('div', { class: 'fact-strip' }, [
      el('span', { class: 'fs-ico', 'aria-hidden': 'true', text: '⭐' }),
      el('p', { html: '<strong>Collect badges!</strong> Discover dinosaurs, dig up fossils, win the quiz and build a habitat to earn special explorer badges. Your progress is saved on this device.' }),
    ]));

    s.appendChild(el('div', { class: 'hero-actions', style: 'margin-top:16px' }, [
      el('button', { class: 'btn btn-jungle', onclick: () => runOnboarding() }, ['👋 Watch the welcome again']),
      el('button', { class: 'btn btn-ghost', onclick: () => go('grownups') }, ['🧑‍🏫 For grown-ups']),
    ]));

    stage.appendChild(s);
  }

  /* ── Screen: Grown-ups ──────────────────────────────────────────────── */
  function renderGrownups() {
    const s = el('div', { class: 'screen' });
    s.appendChild(backButton('Back to camp', 'home'));
    s.appendChild(el('h1', { class: 'screen-title', text: '👋 For grown-ups' }));

    s.appendChild(el('div', { class: 'prose' }, [
      el('h2', { text: 'What children learn' }),
      el('p', { text: 'Dino Expedition helps children aged 5–10 explore dinosaurs through play. Along the way they meet real species and pick up ideas that palaeontologists actually use.' }),
      el('ul', {}, [
        el('li', { text: 'Sorting dinosaurs by time period, diet and habitat.' }),
        el('li', { text: 'Understanding that we learn about dinosaurs from fossils.' }),
        el('li', { text: 'Matching animals to the environments that suit them.' }),
        el('li', { text: 'Telling confirmed facts apart from things scientists are still studying.' }),
      ]),
    ]));

    s.appendChild(el('div', { class: 'prose' }, [
      el('h2', { text: 'Our approach to facts' }),
      el('p', { text: 'We try hard to be scientifically responsible:' }),
      el('ul', {}, [
        el('li', { text: 'People and non-bird dinosaurs never lived at the same time. The last big dinosaurs died out about 66 million years ago.' }),
        el('li', { text: 'Birds are living dinosaurs — a real, mainstream scientific idea.' }),
        el('li', { text: 'Where knowledge is uncertain, we say “Scientists think…” or “Evidence suggests…”.' }),
        el('li', { text: 'We gently correct common mix-ups, like Pteranodon being a flying reptile rather than a dinosaur.' }),
        el('li', { text: 'Content avoids gore and scary detail, and the app works fully without sound.' }),
      ]),
    ]));

    s.appendChild(el('div', { class: 'prose' }, [
      el('h2', { text: 'Privacy' }),
      el('p', { text: 'This app is completely private and safe. There are no accounts, no ads, no tracking and no analytics. Nothing is sent anywhere — your child’s name and progress are stored only in this browser (localStorage) and can be cleared any time from the Badges screen.' }),
    ]));

    s.appendChild(el('div', { class: 'prose' }, [
      el('h2', { text: 'Where our facts come from' }),
      el('ul', { class: 'source-list' }, SOURCES.map((src) =>
        el('li', {}, [el('a', { href: src.url, target: '_blank', rel: 'noopener', text: src.name })]))),
      el('p', { class: 'source-note', text: 'Dates follow the geologic time scale used by these museums and are rounded for young readers.' }),
    ]));

    stage.appendChild(s);
  }

  /* ── Onboarding ─────────────────────────────────────────────────────── */
  function runOnboarding() {
    const steps = [
      { emoji: '🦕', title: 'Welcome, Explorer!', body: 'Get ready for a dinosaur expedition full of real facts and fun.', cta: 'Let’s go!' },
      { emoji: '🦴', title: 'We learn from fossils', body: 'Dinosaurs lived millions of years before people. We discover them from fossils — bones and footprints turned to stone.', cta: 'Cool!' },
      { emoji: '🐦', title: 'Birds are dinosaurs!', body: 'Some dinosaurs are still alive today — they are the birds you see outside. Tweet tweet!', cta: 'Amazing!' },
      { emoji: '🎒', title: 'What shall we call you?', body: 'Type your explorer name (or leave it blank).', cta: 'Start exploring!', ask: true },
    ];
    let i = 0;
    const overlay = el('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Welcome' });
    document.body.appendChild(overlay);
    paint();

    function paint() {
      const step = steps[i];
      overlay.innerHTML = '';
      const input = step.ask
        ? el('input', { type: 'text', maxlength: '16', placeholder: 'Your name', 'aria-label': 'Your explorer name', value: state.name || '' })
        : null;
      const sheet = el('div', { class: 'sheet' }, [
        el('div', { class: 'sheet-emoji', 'aria-hidden': 'true', text: step.emoji }),
        el('h2', { text: step.title }),
        el('p', { text: step.body }),
        input,
        el('button', { class: 'btn btn-lg btn-block', onclick: next }, [step.cta]),
        el('div', { class: 'dots' }, steps.map((_, k) => el('i', { class: k === i ? 'on' : '' }))),
      ]);
      overlay.appendChild(sheet);
      if (input) input.focus(); else sheet.querySelector('button').focus();

      function next() {
        if (step.ask && input) state.name = input.value.trim().slice(0, 16);
        i++;
        if (i >= steps.length) {
          state.onboarded = true;
          save();
          overlay.remove();
          router();
          if (state.name) toast('Welcome aboard, Explorer ' + state.name + '! 🎉');
        } else { paint(); }
      }
    }
  }

  /* ── Utilities ──────────────────────────────────────────────────────── */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ── Wire up ────────────────────────────────────────────────────────── */
  document.querySelectorAll('[data-go]').forEach((b) =>
    b.addEventListener('click', () => go(b.getAttribute('data-go'))));

  window.addEventListener('hashchange', router);

  refreshChrome();
  if (!state.onboarded) {
    if (!location.hash) location.hash = '#/home';
    runOnboarding();
  } else {
    router();
  }
})();
