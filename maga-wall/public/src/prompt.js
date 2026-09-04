/* The one place the game uses real DOM.
 *
 * Everything else is drawn on canvas, but a licence key is 16 characters typed
 * on a phone. A canvas keypad would mean no autofill, no paste, no password
 * manager and no native keyboard — so this is a real <input>, styled to look
 * like it belongs to the game.
 */

let el = null;
let input = null;
let titleEl = null;
let noteEl = null;
let resolveFn = null;

function build() {
  if (el) return;
  el = document.createElement('div');
  el.className = 'mw-prompt';
  el.hidden = true;
  el.innerHTML = `
    <div class="mw-prompt-box" role="dialog" aria-modal="true" aria-labelledby="mw-prompt-title">
      <h2 id="mw-prompt-title"></h2>
      <p class="mw-prompt-note"></p>
      <input type="text" autocomplete="off" autocapitalize="characters"
             autocorrect="off" spellcheck="false" enterkeyhint="go"
             aria-label="Licence key">
      <div class="mw-prompt-row">
        <button type="button" data-act="cancel">CANCEL</button>
        <button type="button" data-act="ok">UNLOCK</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  input = el.querySelector('input');
  titleEl = el.querySelector('h2');
  noteEl = el.querySelector('.mw-prompt-note');

  el.addEventListener('click', (e) => {
    const act = e.target && e.target.dataset ? e.target.dataset.act : null;
    if (act === 'ok') finish(input.value);
    else if (act === 'cancel' || e.target === el) finish(null);
  });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();                       // never let the game see these
    if (e.key === 'Enter') finish(input.value);
    if (e.key === 'Escape') finish(null);
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());
}

function finish(value) {
  if (!resolveFn) return;
  const done = resolveFn;
  resolveFn = null;
  el.hidden = true;
  input.blur();
  done(value === null ? null : String(value).trim());
}

/**
 * @returns {Promise<string|null>} what they typed, or null if they backed out.
 */
export function askForText({ title, note, placeholder = '', value = '' }) {
  build();
  titleEl.textContent = title;
  noteEl.textContent = note || '';
  input.placeholder = placeholder;
  input.value = value;
  el.hidden = false;
  // iOS will not focus without a tick after the element becomes visible.
  setTimeout(() => { input.focus(); input.select(); }, 30);
  return new Promise((resolve) => { resolveFn = resolve; });
}

export const promptOpen = () => !!resolveFn;
