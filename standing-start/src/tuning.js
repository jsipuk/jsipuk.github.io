/* Standing Start — the live tuning panel.
 *
 * The panel builds itself from the parameter definitions in config.js, so a
 * new tunable needs one line there and nothing here.
 *
 * Tuned values persist to local storage and can be exported as JSON. Without
 * the export the panel produces a feeling and no artefact: you would tune for
 * twenty minutes on a phone and have nothing to paste back into the defaults.
 */

import { GROUPS, defaults, DRIFT_MODELS } from './config.js';

const KEY = 'standing-start.tuning.v1';

export function loadSaved() {
  const cfg = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      for (const k of Object.keys(cfg)) {
        if (typeof saved[k] === 'number' && Number.isFinite(saved[k])) cfg[k] = saved[k];
      }
    }
  } catch { /* corrupt or unavailable storage just means defaults */ }
  return cfg;
}

function save(cfg) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* private mode */ }
}

export function createPanel(root, cfg, hooks) {
  const rows = new Map();

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('aria-label', 'Tuning');

  const head = document.createElement('div');
  head.className = 'panel-head';
  head.innerHTML = '<strong>Tuning</strong>';

  const actions = document.createElement('div');
  actions.className = 'panel-actions';
  for (const [label, fn] of [
    ['Reset car', () => hooks.resetCar()],
    ['Defaults', () => restore()],
    ['Export', () => exportJson()],
    ['Close', () => toggle(false)],
  ]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', fn);
    actions.appendChild(b);
  }
  head.appendChild(actions);
  panel.appendChild(head);

  const body = document.createElement('div');
  body.className = 'panel-body';
  panel.appendChild(body);

  for (const group of GROUPS) {
    const sec = document.createElement('section');
    const h = document.createElement('h2');
    h.textContent = group.label;
    sec.appendChild(h);

    for (const [name, def] of Object.entries(group.params)) {
      const row = document.createElement('label');
      row.className = 'row';

      const top = document.createElement('span');
      top.className = 'row-head';
      const nameEl = document.createElement('span');
      nameEl.textContent = def.label;
      const valEl = document.createElement('output');
      top.appendChild(nameEl);
      top.appendChild(valEl);
      row.appendChild(top);

      let control;
      if (def.choices) {
        control = document.createElement('select');
        def.choices.forEach((c, i) => {
          const o = document.createElement('option');
          o.value = String(i);
          o.textContent = c;
          control.appendChild(o);
        });
        control.value = String(cfg[name]);
        control.addEventListener('change', () => {
          cfg[name] = Number(control.value);
          paint(name);
          save(cfg);
        });
      } else {
        control = document.createElement('input');
        control.type = 'range';
        control.min = String(def.min);
        control.max = String(def.max);
        control.step = String(def.step);
        control.value = String(cfg[name]);
        control.addEventListener('input', () => {
          cfg[name] = Number(control.value);
          paint(name);
          save(cfg);
          if (hooks.onChange) hooks.onChange(name);
        });
      }
      row.appendChild(control);
      sec.appendChild(row);
      rows.set(name, { control, valEl, def });
    }
    body.appendChild(sec);
  }

  const out = document.createElement('textarea');
  out.className = 'export';
  out.readOnly = true;
  out.hidden = true;
  body.appendChild(out);

  root.appendChild(panel);

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'fab';
  fab.textContent = 'TUNE';
  fab.addEventListener('click', () => toggle(!panel.classList.contains('open')));
  root.appendChild(fab);

  function paint(name) {
    const r = rows.get(name);
    if (!r) return;
    const v = cfg[name];
    if (r.def.choices) {
      r.control.value = String(v);
      r.valEl.textContent = '';
    } else {
      r.control.value = String(v);
      const dp = r.def.step < 1 ? String(r.def.step).split('.')[1].length : 0;
      r.valEl.textContent = v.toFixed(dp) + (r.def.unit ? ' ' + r.def.unit : '');
    }
  }

  function paintAll() { for (const name of rows.keys()) paint(name); }

  function restore() {
    const d = defaults();
    for (const k of Object.keys(d)) cfg[k] = d[k];
    paintAll();
    save(cfg);
    if (hooks.onChange) hooks.onChange(null);
  }

  function exportJson() {
    const ordered = {};
    for (const g of GROUPS) for (const k of Object.keys(g.params)) ordered[k] = cfg[k];
    out.hidden = false;
    out.value = JSON.stringify(ordered, null, 2);
    out.scrollIntoView({ block: 'nearest' });
    out.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(out.value).catch(() => { /* selection is the fallback */ });
    }
  }

  function toggle(open) {
    panel.classList.toggle('open', open);
    fab.textContent = open ? 'HIDE' : 'TUNE';
  }

  paintAll();
  toggle(false);

  return { panel, paintAll, toggle, modelName: () => DRIFT_MODELS[cfg.driftModel] };
}
