# Standing Start — pre-production brief

An original mobile kart racer. Everything that needs deciding **before a line of game code is written**, plus the kickoff prompt to start the design work in a fresh session.

Status: pre-production. No code exists. No name chosen. No commitment made.

Context: Mario Kart Tour ends service 29 September 2026. That is the window, not the target — the goal is a good kart racer that stands on its own, not a memorial.

---

## 1. The kickoff prompt

Paste this verbatim into a fresh Claude session to begin design work.

```
PROJECT: An original mobile kart racer, working title "Standing Start".

CONTEXT
Mario Kart Tour shuts down on 29 September 2026 after seven years, leaving a
large audience with no equivalent game. I want to build an original kart racer
that delivers the same *experience* — the drift-boost rhythm, the item chaos,
the short-session pull — with none of Nintendo's intellectual property.

THIS SESSION'S JOB
Pre-production design only. Produce NO game code. If you find yourself writing
a game loop, stop — that is the next phase. The output of this session is a set
of design documents precise enough that implementation becomes transcription.

FIXED CONSTRAINTS — design within these, do not relitigate them
- Mobile web / PWA first. Portrait orientation. One-thumb play.
- Static hosting on GitHub Pages. No backend, no accounts, no server at launch.
- Fully offline-capable after first load. All state in local storage.
- 60fps on a mid-range Android phone that is three years old. This is a hard
  budget, not an aspiration — it constrains the renderer choice.
- Single developer (me, with you). No art team, no audio team, no budget.
- Zero Nintendo IP: no characters, names, likenesses, silhouettes, track
  layouts, music, item names, iconography, fonts, or UI trade dress. Mechanics
  and systems are fair game and should be copied freely and precisely.

DELIVERABLES, IN THIS ORDER
1.  Design pillars. Exactly five sentences, each one a decision that can reject
    a feature. Anything that fails a pillar is out of scope permanently.
2.  UX teardown of Mario Kart Tour. What specifically made it work as a mobile
    game rather than a console game — session length, control scheme, reward
    cadence, failure handling, the moment-to-moment loop. Separate what is
    genuinely good design from what exists to drive monetisation.
3.  Core loop spec. Second-by-second, what the player does in a 90-second race,
    and what pulls them into the next one.
4.  Feel spec. The single most important document. Drift entry and exit, boost
    charge tiers and their thresholds, acceleration and top-speed curves,
    steering assist strength, collision response, air time, camera behaviour.
    Give concrete starting numbers with units, marked as tunable, and explain
    what each number does to the feel when raised or lowered.
5.  Control spec. Exactly what the thumb does, and what happens on ambiguous
    input. Cover: auto-accelerate, steering, drift initiation, item use, and
    how a player using one thumb does two things at once.
6.  Item design. An original set of 8-10 items with original names. For each:
    what it does, who it helps, what it feels like to receive and to be hit by,
    and its probability curve by race position. Explain the catch-up philosophy
    and argue for a position on it.
7.  Track design language. What makes a corner good. The vocabulary of track
    features available, and the data format a track is authored in — a track
    must be a data file I can hand-write or generate, never hand-coded geometry.
8.  Progression and economy. Currencies, unlocks, session rewards, daily and
    weekly structure. Assume no real-money purchases at launch and design an
    economy that stays honest without them.
9.  Art and audio direction. A style that a single developer with no artist can
    execute at consistent quality, and that will still look deliberate in two
    years. Justify the choice against the performance budget.
10. Technical architecture. Compare at minimum: 2D canvas with pseudo-3D
    projection; WebGL via Three.js; and a full engine such as Godot exported to
    web. Give a recommendation with reasoning against the constraints above,
    not a neutral comparison table.
11. IP clearance checklist. A concrete pre-launch checklist covering names,
    art, audio, UI, store listing copy, and marketing language.
12. Scope guardrails. What is explicitly NOT in v1, and the trigger condition
    that would let each excluded thing back in.

WORKING METHOD
- Ask me questions in batches before assuming. Do not invent my preferences.
- Challenge my assumptions where you think I am wrong, including the fixed
  constraints if one of them is genuinely fatal to the design.
- Give recommendations, not menus. Where you present options, name the one you
  would pick and say why.
- Every mechanic must state the player emotion it is intended to create and how
  I would know whether it worked.
- Where a number is arbitrary, say so and say how to find the right one.
- Keep the language plain. No pitch-deck voice.

START BY
Reading back the five design pillars you would propose, and the three questions
whose answers would most change the rest of the design. Then stop and wait.
```

---

## 2. What must be decided before any code

Four clusters. The feel cluster is the one that decides whether the game is any good; everything else is recoverable.

### A. Product definition

| Item | Done looks like | Why it blocks code |
| --- | --- | --- |
| Design pillars | Five sentences that can reject a feature | Without them, scope grows until the project dies |
| Audience and session | A named player and a target session length in minutes | Session length drives race length, which drives track length, which drives everything |
| Scope guardrails | An explicit "not in v1" list with re-entry triggers | Prevents multiplayer and monetisation from creeping in during build |

### B. Feel — the part that matters

| Item | Done looks like | Why it blocks code |
| --- | --- | --- |
| Core loop | Second-by-second breakdown of one race and the hook into the next | Determines what the UI must show and when |
| Drift and boost model | Charge tiers, thresholds, durations, exit behaviour, all numbered | This is the game. Retro-fitting it is a rewrite |
| Handling model | Acceleration curve, top speed, grip, steering assist, off-track penalty | Physics decides the renderer's requirements |
| Control scheme | Exactly what one thumb does, and every ambiguous-input resolution | Portrait one-thumb is a hard design problem; solve it on paper |
| Camera | Follow distance, lag, field-of-view changes under boost | Camera is 50% of perceived speed |

The honest test for this cluster: a grey-box prototype with no art, no items and no opponents should already be fun to drive around one corner. If it isn't, no amount of content fixes it.

### C. Content systems

| Item | Done looks like | Why it blocks code |
| --- | --- | --- |
| Item set | 8-10 original items, named, with position-based probability curves | Item logic touches physics, AI, UI and audio simultaneously |
| Catch-up philosophy | A stated position on rubber-banding, and how it is implemented | Deciding late means rebuilding the AI |
| Track data format | A schema a track can be authored in as data | Hand-coded tracks cap the game at three tracks forever |
| Racer roster | How many, how they differ, what the stat axes are | Stats feed directly into the handling model |
| Progression and economy | Currencies, unlock costs, session and daily rewards | Save-state schema must exist before the first save is written |

### D. Craft and constraints

| Item | Done looks like | Why it blocks code |
| --- | --- | --- |
| Art direction | A style bible a non-artist can execute repeatedly | Style determines renderer and asset pipeline |
| Audio direction | Music approach, engine sound approach, source of both | Audio is the most commonly abandoned workstream; commit early |
| Renderer choice | One picked approach with reasoning, plus a measured spike | The single most expensive decision to reverse |
| Performance budget | Frame budget in ms, split by system, on a named test device | Optimising later is much harder than designing within a budget |
| IP clearance | A pre-launch checklist covering assets, copy and marketing | A late clearance failure can kill a finished game |

---

## 3. Phased plan

Each phase has a gate. Failing a gate means stopping or rescoping, not pushing on.

**Phase 0 — Design.** The twelve deliverables above.
*Gate:* Could a competent stranger build the drift model from your notes without asking you a question?

**Phase 1 — Feel prototype.** Grey boxes on one oval. No art, no items, no opponents, no UI. Only: drive, drift, boost, and an on-screen readout of every tunable so they can be adjusted live on the phone.
*Gate:* Is it fun for two minutes with nothing else in it? Test on a real phone, held in one hand, standing up. If no, tune. If it cannot be made fun, stop here — you have lost days, not months.

**Phase 2 — Vertical slice.** One complete track with final-quality art, one full race against AI, the full item set, the result screen, and the reward moment.
*Gate:* Does someone who has never seen it play a second race unprompted?

**Phase 3 — Content build.** Tracks two through eight, the racer roster, progression, cups, daily structure, audio, settings, and the install/offline experience.
*Gate:* Does it survive a week of daily play by someone who is not you?

**Phase 4 — Public launch.** Ship as a PWA on jsipuk.github.io. Installable, offline, no store, no approval, no cost.
*Gate:* Are people actually returning? This is the only honest signal you will get.

**Phase 5 — Native, optional.** Only if Phase 4 produces real retention. Capacitor wrapper or an engine rebuild, developer accounts, store review, and everything that comes with being a legal entity shipping an app.
*Gate:* Is there a reason to be in a store other than wanting to be in a store?

Phases 0-2 are where the risk lives. Phases 3-4 are grind. Phase 5 is a business decision, not a technical one.

---

## 4. Decisions only you can make

| Decision | Options | My recommendation |
| --- | --- | --- |
| Renderer | 2D canvas pseudo-3D / Three.js / Godot web export | Start with pseudo-3D canvas. It matches the rest of your site, it hits the performance budget trivially, and it is the fastest route to answering the only question that matters in Phase 1 |
| Art style | Geometric-flat / low-poly 3D / illustrated 2D | Geometric-flat. It is the one style that stays consistent when produced procedurally, and it ages well |
| Racers | Original characters / vehicles only, no drivers | Vehicles only for v1. Characters are the most expensive art and the highest IP risk, for the least gameplay return |
| Monetisation | None / cosmetic / gacha | None at launch. Adding it later is easy; removing it destroys trust |
| Multiplayer | None / async ghosts / live | Async ghosts. Most of the social feel, none of the servers |
| Audio | Compose / license / procedural | License a small pack. It is the one area where money genuinely saves months |
| Name | — | Needed before any public artefact exists. Check trademark availability before committing |

---

## 5. Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| The driving is not fun and cannot be tuned into fun | Medium | Phase 1 gate exists specifically to find this out in days |
| Art scope collapses the project | High | Pick a style a non-artist can execute; vehicles not characters |
| Renderer choice is wrong and found out late | Medium | Timeboxed spike before Phase 1 commits |
| Audio never gets done | High | Budget for a licensed pack up front |
| IP challenge after launch | Low if the checklist is followed | Clearance checklist; never reference the shutdown in marketing copy |
| Interest fades as the launch window passes | High | Do not build for the window. Build a game that is good in a year |

---

## 6. What to bring back

When you return to start Phase 0, have a view on:

- Answers to the seven decisions in section 4, even provisional ones
- A target session length in minutes
- Whether async ghost racing is in or out of v1
- Three existing games whose *feel* you want, and one sentence each on why
- How many hours a week this realistically gets

Everything else can be worked out in the session.
