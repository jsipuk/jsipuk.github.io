# What is missing

A research note and three working prototypes, at [jsip.uk/whats-missing](https://jsip.uk/whats-missing/).

## The finding

Sixteen things live on this site. Every one is self contained and stateless, and
none of them accumulates anything. Meanwhile the reports in this same repository
specify, in detail, systems that were never built:

- **The Future SE Stack** ranks 22 systems by leverage and names five as
  buildable now. None exists.
- **Champion Deposits** is a complete operating model, and its README says
  `The spreadsheet doesn't exist yet.`
- **inbox-sweep** exists in five hand-maintained versions because the sender map
  lives in prompt text rather than in data.
- **test-plan-tracker** deliberately gives each POV its own `storageKey`, so
  nothing carries from one evaluation to the next.
- **netskope-ai-positioning** re-researches from zero on every run.

They all depend on the same absent thing: a durable, private, portable store of
John's own professional judgement, designed from the start to be handed to an AI
as context. The commercial equivalents (Vivun, Tribble, SiftHub, AutoRFP,
Consensus) are all employer-owned cloud SaaS, so the expertise accrues to the
employer rather than to the person who built it.

## The three versions

Three different daily rituals, not three skins of one idea.

| | Ritual | Cost | Useful on day one |
| --- | --- | --- | --- |
| `v1-field-notes/` | After the call | 3 to 5 min | No |
| `v2-dojo/` | Dead time | 90 sec | Yes |
| `v3-account-brain/` | Before the call | 2 min | Partly |

**V1 Field Notes** is the library: fast capture of objections, answers, proof
points and gotchas, tagged inline with `#topic` and `@Account`, searchable, and
exportable as a markdown context pack.

**V2 The Dojo** is the gym: 44 seeded cards across seven categories, a clock, a
self-scoring rubric (clarity, evidence, control) and SM-2 style spaced
repetition. Kept answers become the library as a by-product.

**V3 Account Brain** is the field: one living page per account, with people,
open threads, and a one-button pre-call brief that leads with what you promised
and have not sent.

Recommendation is in section 04 of `index.html`: start with V2, add V3.

## Technical notes

Each version is a single self-contained `index.html`. No build step, no
dependencies, no network call of any kind, including fonts. Verified with a
browser harness: zero external requests, zero console errors, no horizontal
overflow at 390px, and every form field labelled.

State lives in `localStorage` under one key each (`fieldnotes:v1`, `dojo:v1`,
`acctbrain:v1`). All three export and import JSON, and all three generate a
markdown context pack designed to be pasted into Claude as grounding context.

The Dojo's deck is deliberately vendor neutral. No card asserts a product
capability, a competitor gap or a statistic, because those go stale and because
a practice tool that trains you to repeat an unverified claim is worse than no
practice tool.

## If one gets adopted

1. Move the folder to its own path, for example `/dojo/`, and add a card to the
   Tools section of the homepage.
2. Add `manifest.webmanifest` and a service worker so it installs to a home
   screen and runs offline, as `departures/` and `medos/` already do.
3. Delete the other two and this folder.
