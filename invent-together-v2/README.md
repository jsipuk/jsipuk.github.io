# Invent Together — V2 beta

A separate, unlisted rebuild of `/invent-together/`, built from the review findings.
**It does not replace or modify V1.** Both run side by side until a decision is made.

| | |
|---|---|
| A — current | <https://jsip.uk/invent-together/> |
| B — V2 beta | <https://jsip.uk/invent-together-v2/> |
| Side-by-side | <https://jsip.uk/invent-together-v2/compare.html> |

V2 is `noindex, nofollow` and is not linked from the homepage. The only way in is a
direct link.

## The one change that matters

V1 produced a single output: a monospace brief addressed to a code assistant. The child
supplied every idea and received nothing they could read.

V2 produces **two** outputs from the same answers, and shows the child's first:

- **For them** — a poster with the invention's name set large, their own words quoted,
  the facts they invented laid out as cards, and a **Read it back** button that speaks it
  aloud using the browser's on-device `speechSynthesis`. It prints on one page.
- **For the grown-up** — the brief, now opening with an explicit instruction so it works
  as a paste-in prompt rather than a document someone has to write a prompt around.

## Everything else that changed

| # | Finding | V2 |
|---|---|---|
| 01 | No protection against losing the answers | `beforeunload` guard when the form is dirty, plus an **opt-in** draft toggle (default off) with a visible delete control |
| 02 | Output was adult-only | Poster + read aloud + print |
| 03 | Keyboard focus invisible on 10 controls | `:focus-visible` ring on the visible chip — the WCAG 2.4.7 fix |
| 04 | Empty form produced a confident empty brief | Refuses, and says what to do instead |
| 05 | Copy assumed one specific boy (7 instances) | Neutral throughout |
| 06 | Five different names for the page | One: **Invent Together** |
| 07 | 15 of 16 prompts vanished on first keystroke | Persistent hint text under every label |
| 08 | The result was announced to nobody | `role="status" aria-live="polite"` + scroll into view |
| 09 | 6.3 phone screens, 19 fields | **Quick** mode: 5 questions, 3,681px. **Full** reveals the rest |
| 10 | Every download overwrote the last | `spagbot-2026-08-16.txt` |
| 11 | Five browser alerts | Inline status lines, which double as the live regions |
| 12 | Clear sat beside the reward button | Moved to the foot, worded "Start a new invention" |
| 13 | Brief had no instruction for the assistant | Opens with the task |
| 14 | `buildSummary` mutated the DOM and returned a value | Pure `buildSummary(data)`; rendering is separate |
| 15 | Five unguarded `getElementById` listeners | One delegated `[data-action]` handler |
| 16 | Two conic-gradient animations ran forever | Stop after the first interaction |
| 17 | Manifest with no service worker, non-maskable icon | `sw.js` caches 7 files; maskable icon entry added |

New in V2, not from the findings: **tappable answer chips** under the harder questions, so
the child can operate part of the screen themselves instead of only talking.

## Privacy

Unchanged in substance, and now more honest because it says what the draft does:

- No LLM, no API calls, no database, no cookies, no analytics, no third-party scripts.
- **Nothing is stored unless you switch the draft on.** Verified: zero storage keys after
  filling the whole form with the toggle off.
- The draft, when on, is one `localStorage` key on that device, deletable from the page.
- Share sends only the URL and a fixed description — never the answers.
- Read-aloud uses the browser's built-in speech engine. No audio leaves the device.

The service worker is the one genuinely new capability: it caches the page's own seven
files so it opens without a connection. It makes no network requests of its own.

## Deploying elsewhere

Same as V1: GitHub Pages cannot set response headers, so the enforced policy is the CSP
`<meta>` tag in `index.html`. Note it differs from V1 in one place — `worker-src 'self'`
rather than `'none'`, which the service worker needs.

## Verified

Headless Chromium against the deployed files, at 390×844 and 1400×1000:

- Quick mode shows 5 questions; page is 3,681px against V1's 5,334px.
- Empty Generate refuses and explains; no results panel appears.
- Chips append cleanly: `rainbow, six legs, one big eye`.
- Focus ring resolves to `3px solid rgb(36,92,70)` on the visible chip.
- Draft: 0 storage keys with the toggle off, 1 key on, restored after reload, 0 after delete.
- `beforeunload` fires when dirty, and correctly stays quiet when a draft is being kept.
- Service worker registers; empty brief sections are suppressed.
- No console errors, no CSP violations, on either page or the compare harness.
