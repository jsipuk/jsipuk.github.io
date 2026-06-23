/* ===========================================================================
   NostalgiAI — app logic (vanilla JS, no build step, no tracking)
   ---------------------------------------------------------------------------
   • Hash routing: #/ is the browse view, #/a/<id> is an activity page.
   • Filters (category / difficulty) and a search box narrow the browse list.
   • Last-used filters are remembered in localStorage so a returning parent
     picks up where they left off. Nothing is sent anywhere.
   =========================================================================== */
(function () {
  'use strict';

  const { CATEGORIES, DIFFICULTY, ACTIVITIES } = window.NOSTALGIAI;
  const page = document.getElementById('main');
  const toastEl = document.getElementById('toast');

  const STORE_KEY = 'nostalgiai.filters.v1';
  const byId = (id) => ACTIVITIES.find((a) => a.id === id);
  const catById = (id) => CATEGORIES.find((c) => c.id === id);

  /* ── Filter state (remembered between visits) ───────────────────────── */
  const defaultFilters = () => ({ category: 'all', difficulty: 'all', query: '' });
  function loadFilters() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? Object.assign(defaultFilters(), JSON.parse(raw)) : defaultFilters();
    } catch (e) { return defaultFilters(); }
  }
  function saveFilters() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(filters)); } catch (e) { /* private mode */ }
  }
  let filters = loadFilters();

  /* ── Small helpers ──────────────────────────────────────────────────── */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
  }

  /* ── Filtering ──────────────────────────────────────────────────────── */
  function matches(a) {
    if (filters.category !== 'all' && a.category !== filters.category) return false;
    if (filters.difficulty !== 'all' && a.difficulty !== filters.difficulty) return false;
    const q = filters.query.trim().toLowerCase();
    if (q) {
      const hay = [a.title, a.shortDescription, a.nostalgiaNote, (a.tags || []).join(' ')]
        .join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  /* ── Card markup ────────────────────────────────────────────────────── */
  function cardMarkup(a) {
    const cat = catById(a.category);
    const diff = DIFFICULTY[a.difficulty];
    const tilt = (a.id.charCodeAt(0) % 3) - 1; // -1, 0 or 1, for a subtle scattered look
    return `
      <a class="card" href="#/a/${esc(a.id)}" style="--tilt:${tilt}deg">
        <span class="card-icon" aria-hidden="true">${esc(a.emoji)}</span>
        <span class="card-cat">${esc(cat ? cat.emoji + ' ' + cat.name : '')}</span>
        <h3 class="card-title">${esc(a.title)}</h3>
        <p class="card-desc">${esc(a.shortDescription)}</p>
        <span class="card-meta">
          <span class="chip chip-diff diff-${esc(a.difficulty)}">${esc(diff ? diff.label : a.difficulty)}</span>
          <span class="chip chip-time">⏱ ${esc(a.timeRequired)}</span>
        </span>
      </a>`;
  }

  /* ── Browse view ────────────────────────────────────────────────────── */
  function renderBrowse() {
    document.title = 'NostalgiAI · The little things we drew and made as kids';

    const catChips = [`<button class="tab${filters.category === 'all' ? ' is-on' : ''}" data-cat="all">All</button>`]
      .concat(CATEGORIES.map((c) =>
        `<button class="tab${filters.category === c.id ? ' is-on' : ''}" data-cat="${esc(c.id)}">${esc(c.emoji)} ${esc(c.name)}</button>`
      )).join('');

    const diffOptions = ['all'].concat(Object.keys(DIFFICULTY)).map((k) => {
      const label = k === 'all' ? 'Any difficulty' : DIFFICULTY[k].label;
      return `<option value="${esc(k)}"${filters.difficulty === k ? ' selected' : ''}>${esc(label)}</option>`;
    }).join('');

    page.innerHTML = `
      <section class="hero">
        <p class="hero-eyebrow">Remember these?</p>
        <h1 class="hero-title">The little things we drew &amp; made at school</h1>
        <p class="hero-lede">The Cool S, the folded paper fortune teller, MASH, friendship bracelets — the stuff that filled rainy lunchtimes and the backs of exercise books. Relearn them here, then make them again with your kids.</p>
      </section>

      <section class="controls" aria-label="Browse and filter activities">
        <div class="search">
          <label class="visually-hidden" for="q">Search activities</label>
          <span class="search-ico" aria-hidden="true">🔍</span>
          <input id="q" type="search" placeholder="Search… try &lsquo;paper&rsquo;, &lsquo;S&rsquo; or &lsquo;wool&rsquo;" value="${esc(filters.query)}" autocomplete="off" />
        </div>
        <div class="tabs" role="group" aria-label="Filter by category">${catChips}</div>
        <div class="select-wrap">
          <label class="visually-hidden" for="diff">Filter by difficulty</label>
          <select id="diff">${diffOptions}</select>
        </div>
      </section>

      <p class="result-count" id="count" aria-live="polite"></p>
      <section class="grid" id="grid" aria-label="Activities"></section>
      <div class="empty" id="empty" hidden>
        <p>Nothing matches that just yet.</p>
        <button class="btn" data-reset>Clear filters</button>
      </div>
    `;

    const grid = page.querySelector('#grid');
    const empty = page.querySelector('#empty');
    const count = page.querySelector('#count');

    function paint() {
      const list = ACTIVITIES.filter(matches);
      grid.innerHTML = list.map(cardMarkup).join('');
      const has = list.length > 0;
      grid.hidden = !has;
      empty.hidden = has;
      count.textContent = has
        ? `${list.length} ${list.length === 1 ? 'thing' : 'things'} to make`
        : '';
    }
    paint();

    // Category tabs
    page.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        filters.category = btn.dataset.cat;
        saveFilters();
        page.querySelectorAll('[data-cat]').forEach((b) => {
          b.classList.toggle('is-on', b.dataset.cat === filters.category);
        });
        paint();
      });
    });

    // Difficulty select
    page.querySelector('#diff').addEventListener('change', (e) => {
      filters.difficulty = e.target.value;
      saveFilters();
      paint();
    });

    // Search (debounced lightly)
    let searchTimer = null;
    page.querySelector('#q').addEventListener('input', (e) => {
      filters.query = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { saveFilters(); paint(); }, 120);
    });

    // Reset
    const reset = page.querySelector('[data-reset]');
    if (reset) reset.addEventListener('click', () => {
      filters = defaultFilters();
      saveFilters();
      renderBrowse();
      toast('Filters cleared');
    });
  }

  /* ── Activity view ──────────────────────────────────────────────────── */
  function renderActivity(id) {
    const a = byId(id);
    if (!a) { location.hash = '#/'; return; }

    document.title = `${a.title} · NostalgiAI`;
    const cat = catById(a.category);
    const diff = DIFFICULTY[a.difficulty];

    const materials = (a.materials || []).map((m) => `<li>${esc(m)}</li>`).join('');
    const steps = (a.steps || []).map((s, i) =>
      `<li><span class="step-num" aria-hidden="true">${i + 1}</span><span class="step-text">${esc(s)}</span></li>`
    ).join('');
    const tags = (a.tags || []).map((t) => `<span class="chip chip-tag">#${esc(t)}</span>`).join('');

    const related = (a.related || []).map(byId).filter(Boolean);
    const relatedMarkup = related.length ? `
      <section class="related">
        <h2 class="block-title">While the kettle's on, try…</h2>
        <div class="related-grid">${related.map(cardMarkup).join('')}</div>
      </section>` : '';

    const stepList = (arr) => (arr || []).map((s, i) =>
      `<li><span class="step-num" aria-hidden="true">${i + 1}</span><span class="step-text">${esc(s)}</span></li>`
    ).join('');

    const diagramFigure = (src, alt) => src ? `
      <figure class="diagram">
        <img src="${esc(src)}" alt="${esc(alt || ('Step-by-step diagram for ' + a.title))}" loading="lazy" decoding="async" />
        <figcaption>How it goes, step by step — full instructions below.</figcaption>
      </figure>` : '';

    const materialsPanel = `
      <section class="panel panel-materials">
        <h2 class="block-title">You'll need</h2>
        <ul class="materials">${materials || '<li>Just a pen and some paper.</li>'}</ul>
      </section>`;

    // Activities can either have one set of steps, or several skill "variants"
    // (e.g. the paper aeroplanes: beginner / intermediate / advanced).
    let howTo;
    if (a.variants && a.variants.length) {
      const variantsMarkup = a.variants.map((v) => `
        <section class="variant">
          <div class="variant-head">
            <span class="variant-badge level-${esc(String(v.level).toLowerCase())}">${esc(v.level)}</span>
            <h3 class="variant-name">${esc(v.name)}</h3>
            ${v.time ? `<span class="chip chip-time">⏱ ${esc(v.time)}</span>` : ''}
          </div>
          ${v.blurb ? `<p class="variant-blurb">${esc(v.blurb)}</p>` : ''}
          ${diagramFigure(v.diagram, v.diagramAlt)}
          <ol class="steps">${stepList(v.steps)}</ol>
        </section>`).join('');
      howTo = `
        ${materialsPanel}
        <section class="variants">
          <h2 class="block-title">Pick your level</h2>
          ${variantsMarkup}
        </section>`;
    } else {
      howTo = `
        ${diagramFigure(a.diagram, a.diagramAlt)}
        <div class="activity-body">
          ${materialsPanel}
          <section class="panel panel-steps">
            <h2 class="block-title">How to make it</h2>
            <ol class="steps">${steps}</ol>
          </section>
        </div>`;
    }

    const safety = a.safetyNotes ? `
      <div class="callout callout-safety">
        <h2 class="callout-title">👀 Grown-up note</h2>
        <p>${esc(a.safetyNotes)}</p>
      </div>` : '';

    page.innerHTML = `
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="#/" data-go-home>← Back to all</a>
        ${cat ? `<a href="#/" data-cat-link="${esc(cat.id)}">${esc(cat.emoji)} ${esc(cat.name)}</a>` : ''}
      </nav>

      <article class="activity">
        <header class="activity-head">
          <span class="activity-icon" aria-hidden="true">${esc(a.emoji)}</span>
          <div>
            <h1 class="activity-title">${esc(a.title)}</h1>
            <p class="activity-desc">${esc(a.shortDescription)}</p>
            <div class="activity-meta">
              <span class="chip chip-diff diff-${esc(a.difficulty)}">${esc(diff ? diff.label : a.difficulty)}${diff && diff.note ? ' · ' + esc(diff.note) : ''}</span>
              <span class="chip chip-time">⏱ ${esc(a.timeRequired)}</span>
              <span class="chip chip-era">📼 ${esc(a.era)}</span>
            </div>
          </div>
        </header>

        ${a.nostalgiaNote ? `
        <aside class="callout callout-nostalgia">
          <h2 class="callout-title">Why we remember it</h2>
          <p>${esc(a.nostalgiaNote)}</p>
        </aside>` : ''}

        ${howTo}

        ${safety}

        <section class="relevance">
          <div class="relevance-card">
            <h3>🇬🇧 In the UK</h3>
            <p>${esc(a.ukRelevance)}</p>
          </div>
          ${a.usRelevance ? `
          <div class="relevance-card">
            <h3>🌍 Elsewhere</h3>
            <p>${esc(a.usRelevance)}</p>
          </div>` : ''}
        </section>

        ${tags ? `<div class="tags">${tags}</div>` : ''}
      </article>

      ${relatedMarkup}
    `;

    // Breadcrumb category link applies the filter on the browse view
    const catLink = page.querySelector('[data-cat-link]');
    if (catLink) catLink.addEventListener('click', () => {
      filters.category = catLink.dataset.catLink;
      saveFilters();
    });

    page.focus();
    window.scrollTo({ top: 0 });
  }

  /* ── Router ─────────────────────────────────────────────────────────── */
  function route() {
    const hash = location.hash || '#/';
    const m = hash.match(/^#\/a\/([\w-]+)/);
    if (m) renderActivity(m[1]);
    else renderBrowse();
  }

  window.addEventListener('hashchange', route);
  route();
})();
