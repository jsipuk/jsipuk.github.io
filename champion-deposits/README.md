# Champion Deposits Agent — MVP Design

A "champion deposit" is a small, low-effort value-add sent to a customer or
prospect contact — no ask attached. This document designs the **manual/
semi-automated MVP** for an agent that will eventually: scan cyber security
sources → match relevant articles to contacts → draft (never send) short
Gmail emails for review.

The spreadsheet doesn't exist yet. **This doc is the operating model the
spreadsheet, source list, and drafting rules get built from** — not a
description of software to build.

---

## 1. Recommended MVP workflow

Keep the MVP entirely human-in-the-loop. Automation only replaces steps once
the rules below have been proven manually on a handful of real emails.

**Cadence:** once a week, ~45–60 minutes, same day/time (e.g. Friday
morning) so it becomes a habit rather than a one-off.

**MVP steps (manual, 5–10 contacts):**

1. **Scan sources** (15 min) — read the Trusted + Preferred sources from
   the Source Framework (§2) for the past 7 days. Skip Cautious/Excluded at
   this stage.
2. **Shortlist articles** (10 min) — pull out 3–6 articles that look
   genuinely relevant to *at least one* contact, note the topic tag(s) from
   §3 for each.
3. **Match to contacts** (10 min) — for each shortlisted article, check it
   against the spreadsheet (§4) and apply the scoring rules (§5). Only
   High or Medium confidence matches proceed.
4. **Draft in Gmail** (15 min) — write the draft directly in Gmail (not a
   separate doc) using the rules and templates in §6, save as a **draft**,
   do not send.
5. **Self-review** (5–10 min) — run every draft through the checklist in
   §7 before leaving it for later send.
6. **Log the outcome** — one row per draft in a simple run-log (date,
   contact, article, confidence, sent y/n, notes) so patterns emerge across
   weeks.

**What the MVP deliberately does *not* do yet:**
- No auto-fetching of sources (read them yourself, in a browser or RSS
  reader).
- No auto-matching (you apply the scoring rules by eye).
- No auto-sending, ever — drafts only, always human-reviewed.
- No attempt to cover every contact every week — a contact with nothing
  relevant gets skipped that week. Silence is fine; a forced, weak match is
  not.

**Definition of MVP success:** across the first 3–4 runs, at least 60–70%
of created drafts get sent as-is or with light edits, and no draft is ever
sent that feels sales-led, wrong, or poorly timed. Tune the rules in §2–§5
until that's true before considering any automation (§10).

---

## 2. Source framework

### Categories

| Category | Description | Examples (fill in your own list) |
| --- | --- | --- |
| **Netskope-owned** | Content you can point to with full confidence and that indirectly supports commercial conversations without being salesy | Netskope Threat Labs blog, Netskope company blog, release notes / product updates, Netskope-sponsored research (e.g. Cloud & Threat Report) |
| **Third-party trusted** | Established, editorially independent outlets your contacts already respect | Major security trade press, well-known analyst commentary, respected independent researchers |
| **Third-party preferred** | Good content, slightly narrower reach or reputation, still safe to reference | Niche security newsletters, vendor-neutral podcasts/blogs with a track record |
| **Cautious** | Usable only with extra scrutiny — check date, author, and independence before using | PR-driven "vendor news" sites, single-author blogs without a track record, anything behind clickbait framing |
| **Excluded** | Never use as a source for a champion deposit | Competitor-owned blogs/marketing content, unverified social media posts, anonymous forums, anything paywalled you can't verify the full content of |

### Classification rules of thumb

- **Trusted** = you'd be comfortable if the contact asked "where did you see
  this?" and forwarded your answer to their boss.
- **Preferred** = good and usable, but check for a second corroborating
  source before treating it as fact (especially for breach/incident claims).
- **Cautious** = usable only for framing/context, never as the sole basis
  for a factual claim in a draft.
- **Excluded** = do not use, full stop — even if the content is accurate,
  the source itself creates risk (competitor branding, unverifiable
  authorship, or reputational risk if referenced).

### Lookback window

- **Default:** last 7 days (i.e. since the previous run) — keeps content
  timely and avoids "did you see this?" emails about month-old news.
- **Exception:** a genuinely major, still-unfolding story (large breach,
  major CVE, regulatory action) can be referenced up to **14 days** back if
  it's still actively developing or the contact's sector is newly affected.
- **Netskope release notes:** look back to the last run date regardless of
  gap, since these are lower-frequency and contact-specific relevance
  matters more than recency.

---

## 3. Topic taxonomy

Use a small, flat set of tags — one article can carry 1–3 tags. Resist
growing this list past ~25 entries in the MVP; a tag that's only ever used
once should probably be folded into a broader one.

**AI & emerging risk**
- `ai-security` — securing AI use (shadow AI, GenAI data leakage, AI browser agents)
- `mcp` — Model Context Protocol / agentic AI tooling risk
- `shadow-it` — unsanctioned app/tool usage generally

**Access & network architecture**
- `vpn-risk` — VPN vulnerabilities, exploitation, CVEs
- `vpn-replacement` — modernization narratives away from VPN
- `sase` — Secure Access Service Edge (converged narrative)
- `sse` — Security Service Edge
- `ztna` — Zero Trust Network Access
- `sd-wan` — SD-WAN

**Data & content security**
- `dlp` — Data Loss Prevention
- `casb` — Cloud Access Security Broker
- `swg` — Secure Web Gateway
- `data-governance` — data classification, data lifecycle, data sprawl
- `browser-security` — enterprise/managed browser risk

**Cloud & infrastructure**
- `cloud-security` — general cloud posture, misconfig, CSPM-adjacent

**Threats**
- `ransomware`
- `phishing`
- `threat-intel` — broader threat actor / campaign reporting
- `insider-risk`

**Governance & business risk**
- `compliance` — regulatory frameworks (GDPR, DORA, NIS2, etc.)
- `board-risk` — cyber risk framed for executives/board reporting

**Company/product**
- `netskope-release` — Netskope product/release note update
- `netskope-research` — Netskope-authored research or report

**Tagging rule:** every article needs at least one tag before it can be
matched — if you can't tag it cleanly in under 10 seconds, it's probably
not a clean enough match to send anyway.

---

## 4. Spreadsheet schema

One row per contact. Keep the MVP sheet lean — every extra required column
is friction that delays getting the spreadsheet finished.

### MVP — required columns

| Column | Purpose |
| --- | --- |
| `Contact name` | Display name for the email |
| `Email` | Gmail draft recipient |
| `Company` | For context and dedupe |
| `Role/title` | Drives tone and topic relevance (e.g. CISO vs. security engineer) |
| `Relationship type` | Champion / prospect / customer / analyst / other — affects tone and commercial sensitivity |
| `Primary topics` | 2–4 tags from §3 this contact genuinely cares about |
| `Last contacted date` | Manually updated after each send — core input to frequency rules |
| `Do-not-contact / paused` | Y/N flag — hard stop, checked before every draft |
| `Notes` | Free text — anything a human needs to know before writing to this person (recent event, sensitive deal stage, personal note like "just changed jobs") |

### Future — optional columns (for the permanent agent, not MVP)

| Column | Purpose |
| --- | --- |
| `Secondary topics` | Broader set of tags for lower-confidence matches |
| `Sector/vertical` | Enables sector-specific stories (finance, healthcare, etc.) |
| `Seniority level` | Refines tone (peer-to-peer vs. up-to-exec) |
| `Preferred contact frequency` | Overrides the default frequency rule per-contact |
| `Deal stage / commercial context` | Read-only flag pulled from CRM — used to raise commercial-sensitivity checks, not to change article selection |
| `Champion score` | How active/valuable this relationship is — could prioritize matching effort |
| `Last article sent (link)` | Rolling history for dedupe automation |
| `Timezone` | For future send-time optimization (still draft-only) |
| `Source of contact` | How they entered your network — helps judge appropriate tone |

**Fields that matter most for matching:** `Primary topics`, `Role/title`,
and `Relationship type` do almost all the work — a clean topic match on a
contact whose role/title makes it plausible is a High-confidence match
before you've even read the notes column. Everything else is refinement or
safety-checking, not matching.

---

## 5. Matching and scoring rules

### Confidence levels

**High confidence** — create the draft:
- Article tag(s) directly overlap the contact's `Primary topics`, **and**
- The angle is plausible for their `Role/title` (e.g. a board-risk article
  to a CISO, not to a security engineer), **and**
- Source is Trusted or Preferred, **and**
- No do-not-contact flag, and frequency rule (below) is satisfied.

**Medium confidence** — create the draft, but flag it for extra scrutiny at
review (§7):
- Tag overlap exists but is partial/adjacent (e.g. article tagged
  `ztna`+`sase`, contact's primary topic is `vpn-replacement` only), **or**
- Source is Trusted/Preferred but the contact hasn't shown explicit
  interest in this exact sub-topic before, **or**
- Article is Netskope-owned and could be read as promotional — needs a
  careful non-salesy framing.

**Low confidence — do not create a draft:**
- No real tag overlap ("this is broadly cyber security" is not a match).
- Source is Cautious or Excluded.
- Contact is flagged do-not-contact/paused.
- The only justification is "haven't emailed them in a while" — that's a
  frequency prompt, not a content match. Never force an article to fit a
  contact just to have a reason to reach out.

### When *not* to create a draft (hard stops)

- Do-not-contact flag is set.
- The article concerns an active incident/breach at the contact's own
  company or a close competitor — too sensitive for an unsolicited email
  from a vendor-adjacent contact; skip and consider a private note-to-self
  instead.
- The article's core fact hasn't been corroborated (only one Cautious-tier
  source reporting it).
- You already sent this contact something on this exact story via another
  channel this week.
- The only available angle requires stretching the topic tags to make it
  relevant.

### Dedupe rules

- Never send the same contact the same article twice — check
  `Last article sent` / run-log before drafting.
- If two contacts would get the *same* article in the same week, that's
  fine (different people), but vary the framing/opening line per contact —
  never copy-paste the same draft body to two people.
- If a Netskope release note and a third-party article both suit the same
  contact in one week, pick **one** — never send two champion-deposit
  drafts to the same person in the same run.

### Frequency rules

- **Default cap:** no more than **one** champion-deposit email per contact
  per **2 weeks**, even if multiple High-confidence matches appear.
- Check `Last contacted date` before drafting — if inside the 2-week
  window, skip this contact this run regardless of match quality, unless
  the article is a genuinely time-critical High-confidence story (e.g. a
  CVE actively affecting their stack).
- If a contact has had **zero** champion deposits in 6+ weeks, that's a
  prompt to look harder for a match next run — but per the rule above,
  never force a low-confidence one just to close the gap.

---

## 6. Email drafting rules

### Tone
- Peer-to-peer, not vendor-to-prospect. Write like you're forwarding
  something to a friend in the industry, not like marketing copy.
- No sales language: no "we can help," no CTAs, no product pitch, no
  meeting asks. If a Netskope product/release note is the content, let the
  news speak for itself — don't add a pitch on top of it.
- Confident but not preachy — you're sharing something interesting, not
  teaching them their job.

### Length
- **60–120 words.** Short enough to read on a phone in 15 seconds.
- One link, one short paragraph of "why I thought of you," done. No bullet
  lists, no multi-paragraph analysis.

### Structure
1. **Personal opener** (1 line) — why this reminded you of them
   specifically, not a generic greeting.
2. **The nugget** (1–2 lines) — what's genuinely interesting or useful
   about it, in your own words, not a copy of the headline.
3. **The link.**
4. **Soft close** (1 line, optional) — a light, no-pressure sign-off. No
   "let me know if you want to discuss" unless it's genuinely warranted —
   default to no ask at all.

### Wording guidance
- Use the contact's name once, naturally, not "Hi [Name]," formality.
- Avoid superlatives ("huge," "massive," "game-changing") — sound like a
  person, not a press release.
- Never claim something is "the first" or "the biggest" unless the source
  itself makes that claim and you trust it.
- If referencing Netskope content, be transparent about the source (e.g.
  "our Threat Labs team found...") rather than presenting it as
  independent third-party research.

---

## 7. Example emails

### A. AI security

> Subject: thought of you — shadow AI usage data
>
> Hi Priya,
>
> Saw this and thought of our chat about your GenAI usage policy rollout —
> some interesting numbers here on how much AI tool usage is happening
> outside sanctioned channels even at security-mature orgs.
>
> https://example.com/shadow-ai-report
>
> Curious if it matches what you're seeing internally.

### B. VPN risk

> Subject: another VPN CVE worth a look
>
> Hi Marcus,
>
> Given the VPN concentrator conversation we had last quarter — another
> actively-exploited vuln disclosed this week, third one in this product
> line in under a year. Worth a glance if you're still running it.
>
> https://example.com/vpn-cve-writeup
>
> Hope the migration planning is going well.

### C. Threat intelligence

> Subject: campaign targeting your sector
>
> Hi Elena,
>
> This threat intel writeup on a phishing campaign specifically targeting
> healthcare payroll systems crossed my desk — given your sector, figured
> it was worth a flag even if your team's already on top of it.
>
> https://example.com/healthcare-phishing-campaign
>
> No action needed, just thought it was relevant.

### D. Executive / board-level risk

> Subject: board-level framing you might find useful
>
> Hi James,
>
> Came across this piece on how boards are starting to ask about cyber risk
> in M&A due diligence specifically — thought it might be a useful
> reference next time that comes up in your board reporting.
>
> https://example.com/board-cyber-risk-ma
>
> Hope things are going well at [Company].

### E. Product / release note update

> Subject: might be relevant to your setup
>
> Hi Tom,
>
> Netskope shipped an update this week that adds finer-grained controls for
> the exact browser-isolation use case we talked about back in March —
> figured you'd want to know even though it's not something I'm actively
> pitching.
>
> https://example.com/netskope-release-note
>
> Let me know if it's useful, no pressure either way.

---

## 8. Review checklist

Run every draft through this before it's left for send. Any single "no"
means fix it or delete the draft — don't send on a partial pass.

**Accuracy**
- [ ] I've read the full article myself, not just the headline.
- [ ] Any factual claim in the draft matches the source exactly (no
      exaggeration, no rounding up).
- [ ] If the claim is significant (breach, CVE severity, stat), it's
      corroborated by a second source or came from a Trusted-tier source.

**Relevance**
- [ ] This is a genuine High or Medium confidence match per §5, not a
      stretch.
- [ ] The angle makes sense for this contact's actual role and known
      interests — not just "cyber security in general."

**Tone**
- [ ] Reads like a person, not marketing copy.
- [ ] No sales language, no CTA, no meeting ask (unless deliberately and
      lightly included).
- [ ] Under 120 words.
- [ ] The personal opener is actually personal to this contact, not
      boilerplate.

**Commercial sensitivity**
- [ ] Nothing in here could be read as opportunistic (e.g. referencing a
      competitor's breach, or their own company's incident).
- [ ] If it's Netskope-owned content, the framing is transparent and not
      disguised as independent research.
- [ ] Nothing here would look bad if forwarded internally at their company.

**Contact frequency**
- [ ] `Last contacted date` checked — outside the 2-week window (or a
      justified exception).
- [ ] This exact article hasn't been sent to this contact before.
- [ ] No other champion-deposit draft is going to this same contact this
      run.

---

## 9. First test run plan

**Setup**
1. Pick **5–10 real contacts** you know well enough to judge "would this
   actually land well" — bias toward people you'd genuinely enjoy hearing
   from, since your own judgment is the QA mechanism for this test.
2. Fill in only the **required MVP columns** (§4) for these contacts — this
   also stress-tests whether the schema is actually sufficient.
3. Pick 3–5 sources total from §2 (mix of Netskope-owned + third-party
   trusted) — don't try to cover the whole eventual source list yet.

**Run it**
4. Follow the workflow in §1 exactly, timing each step.
5. Aim for **3–6 drafts total** across all contacts, not one per contact —
   it's fine, expected even, for some contacts to get nothing this week.
6. Run every draft through the §8 checklist before stopping.

**What to review afterward**
- Did the topic tags in §3 actually cover the articles you found, or did
  you keep reaching for a tag that didn't exist?
- Did the scoring rules in §5 give a clear High/Medium/Low answer, or did
  you find yourself unsure and guessing?
- Did any required spreadsheet column feel unnecessary, and did you wish
  for a column that isn't there yet?
- Re-read each draft 24 hours later (not immediately after writing it) —
  does it still sound right, or does it read as forced/salesy on a second
  look?
- Time check: did the whole run fit in ~45–60 minutes? If not, which step
  ballooned?

**Feedback to capture (write it down, don't rely on memory)**
- For each draft: sent as-is / sent with edits / discarded, and why.
- Any article you *wanted* to send but couldn't justify under the scoring
  rules — was the rule too strict, or was your instinct wrong?
- Any tag from §3 that never got used, or any article that needed a tag
  that doesn't exist yet.
- One sentence per contact on whether the match felt genuinely valuable to
  them or just "technically relevant."

Only after 3–4 clean runs like this (per the success bar in §1) is it worth
considering the automation notes below.

---

## 10. Future Claude Code automation notes

These are deliberately **out of scope for the MVP** — noted here so the
manual process is designed with them in mind, not built in a way that
blocks them later.

- **Source fetching:** once the source list (§2) is stable, a scheduled
  job could pull new items (RSS/API where available) and pre-filter by
  keyword/tag before a human ever looks — but matching and drafting stay
  human-reviewed for the foreseeable future given the "never auto-send"
  constraint.
- **Matching assist:** an LLM step could pre-tag articles (§3) and propose
  a confidence score (§5) as a *suggestion*, with the human making the
  final High/Medium/Low call — not replacing judgment, just speeding up
  the read.
- **Gmail draft creation:** once matching is trusted, draft creation itself
  (populating subject/body per §6 templates, saving as a Gmail draft via
  the Gmail API) is the safest first automation step, since sending still
  requires a human click — this is the natural first slice to build in
  code.
- **Spreadsheet as source of truth:** keep the contact spreadsheet (§4) as
  a plain Google Sheet even after automation — it's the audit trail for
  who got contacted when, and needs to stay human-editable (do-not-contact
  flags especially) regardless of how much else is automated.
- **Frequency/dedupe enforcement:** this is the first rule worth
  hard-coding once automated, since it's mechanical (date math against the
  spreadsheet) rather than judgment-based — good early candidate even
  before matching is automated.
- **What never gets automated:** final send action. The workflow should
  always end at "draft ready for your review in Gmail," never
  "email sent" — this is a constraint on the eventual system design, not
  just the MVP.
