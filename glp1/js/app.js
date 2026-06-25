/* =============================================================================
 * MY MOUNJARO EXPERIENCE — app.js
 * -----------------------------------------------------------------------------
 * Renders the booklet from js/content.js. You normally only edit content.js.
 *
 * Responsibilities:
 *   - build the top navigation from the sections
 *   - render each section and its blocks into <main>
 *   - wire up: print button, pocket-mode toggle, scroll-spy nav, smooth jump
 *
 * To support a NEW block type: add a case to renderBlock().
 * ========================================================================== */

(function () {
  'use strict';

  const data = window.BOOKLET;

  /* ---- tiny DOM helpers --------------------------------------------------- */
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  /* ---- block renderers ---------------------------------------------------- */
  const BOX_META = {
    tip:     { icon: '💡', label: 'Tip' },
    ask:     { icon: '🩺', label: 'Ask your prescriber' },
    track:   { icon: '📋', label: 'Track this' },
    calm:    { icon: '🌿', label: "Don't panic" },
    redflag: { icon: '🚩', label: 'Red flag — seek help' }
  };

  function renderBox(b) {
    const meta = BOX_META[b.variant] || BOX_META.tip;
    const kids = [
      el('div', { class: 'box-head' }, [
        el('span', { class: 'box-icon', 'aria-hidden': 'true' }, [meta.icon]),
        el('span', { class: 'box-label' }, [b.title || meta.label])
      ])
    ];
    if (b.text) kids.push(el('p', null, [b.text]));
    if (b.items) {
      kids.push(el('ul', null, b.items.map(function (it) { return el('li', null, [it]); })));
    }
    return el('div', { class: 'box box-' + b.variant, role: 'note' }, kids);
  }

  function renderTable(b) {
    const thead = el('thead', null, [
      el('tr', null, b.headers.map(function (h) { return el('th', null, [h]); }))
    ]);
    const tbody = el('tbody', null, b.rows.map(function (row) {
      return el('tr', null, row.map(function (cell) {
        // empty cells in template tables get a writable underline
        return el('td', cell === '' ? { class: 'fill' } : null, [cell]);
      }));
    }));
    return el('div', { class: 'table-wrap' }, [el('table', null, [thead, tbody])]);
  }

  function renderChecklist(b) {
    return el('ul', { class: 'checklist' }, b.items.map(function (it) {
      return el('li', null, [el('span', { class: 'tick', 'aria-hidden': 'true' }, []), it]);
    }));
  }

  function renderDefinitions(b) {
    const dl = el('dl', { class: 'defs' });
    b.items.forEach(function (d) {
      dl.appendChild(el('dt', null, [d.term]));
      dl.appendChild(el('dd', null, [d.def]));
    });
    return dl;
  }

  function renderTracker(b) {
    return el('div', { class: 'tracker' }, b.fields.map(function (f) {
      return el('div', { class: 'tracker-row' }, [
        el('span', { class: 'tracker-label' }, [f]),
        el('span', { class: 'tracker-line', 'aria-hidden': 'true' }, [])
      ]);
    }));
  }

  function renderPlaceholder(b) {
    return el('figure', { class: 'placeholder' }, [
      el('div', { class: 'placeholder-art', 'aria-hidden': 'true' }, ['🖼️']),
      el('figcaption', null, [
        el('strong', null, [b.title]),
        el('span', null, [b.caption])
      ])
    ]);
  }

  function renderSources() {
    const list = (data.meta.sources || []).map(function (s) {
      return el('li', null, [
        el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, [s.label])
      ]);
    });
    return el('ul', { class: 'sources' }, list);
  }

  function renderBlock(b) {
    switch (b.type) {
      case 'para':        return el('p', null, [b.text]);
      case 'subhead':     return el('h3', null, [b.text]);
      case 'list':        return el('ul', null, b.items.map(function (i) { return el('li', null, [i]); }));
      case 'checklist':   return renderChecklist(b);
      case 'box':         return renderBox(b);
      case 'table':       return renderTable(b);
      case 'placeholder': return renderPlaceholder(b);
      case 'definitions': return renderDefinitions(b);
      case 'tracker':     return renderTracker(b);
      case 'sources':     return renderSources();
      default:
        console.warn('Unknown block type:', b.type);
        return el('p', { class: 'unknown' }, ['[unknown block: ' + b.type + ']']);
    }
  }

  /* ---- section + page assembly ------------------------------------------- */
  function renderSection(section, index) {
    const header = el('header', { class: 'section-head' }, [
      el('span', { class: 'section-num', 'aria-hidden': 'true' }, [String(index + 1)]),
      el('span', { class: 'section-icon', 'aria-hidden': 'true' }, [section.icon || '•']),
      el('h2', null, [section.title])
    ]);
    const body = el('div', { class: 'section-body' },
      section.blocks.map(renderBlock));
    return el('section', { class: 'section', id: section.id, 'aria-labelledby': section.id + '-h' }, [header, body]);
  }

  function buildNav() {
    const nav = document.getElementById('section-nav');
    data.sections.forEach(function (s, i) {
      const link = el('a', { href: '#' + s.id, 'data-target': s.id }, [
        el('span', { class: 'nav-icon', 'aria-hidden': 'true' }, [s.icon || '•']),
        el('span', { class: 'nav-text' }, [s.title])
      ]);
      nav.appendChild(link);
    });
  }

  /* ---- interactions ------------------------------------------------------ */
  function wireControls() {
    const printBtn = document.getElementById('print-btn');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });

    const pocketBtn = document.getElementById('pocket-btn');
    if (pocketBtn) {
      pocketBtn.addEventListener('click', function () {
        const on = document.body.classList.toggle('pocket-mode');
        pocketBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    const menuBtn = document.getElementById('menu-btn');
    const nav = document.getElementById('section-nav');
    if (menuBtn && nav) {
      menuBtn.addEventListener('click', function () {
        const open = nav.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      nav.addEventListener('click', function (e) {
        if (e.target.closest('a')) nav.classList.remove('open');
      });
    }
  }

  // Highlight the nav link for whichever section is on screen.
  function wireScrollSpy() {
    const links = {};
    document.querySelectorAll('#section-nav a').forEach(function (a) {
      links[a.getAttribute('data-target')] = a;
    });
    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          Object.values(links).forEach(function (a) { a.classList.remove('active'); });
          const a = links[entry.target.id];
          if (a) a.classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

    document.querySelectorAll('main .section').forEach(function (s) { obs.observe(s); });
  }

  /* ---- boot -------------------------------------------------------------- */
  function init() {
    // titles / meta
    document.title = data.meta.title;
    setText('booklet-title', data.meta.title);
    setText('booklet-subtitle', data.meta.subtitle);
    setText('booklet-edition', data.meta.edition);
    setText('safety-banner-text', data.meta.safety);
    setText('print-cover-title', data.meta.title);
    setText('print-cover-subtitle', data.meta.subtitle);
    setText('print-cover-safety', data.meta.safety);

    buildNav();

    const main = document.getElementById('content');
    data.sections.forEach(function (s, i) { main.appendChild(renderSection(s, i)); });

    wireControls();
    wireScrollSpy();
  }

  function setText(id, text) {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
