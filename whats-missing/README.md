# /whats-missing/

The page that explains [Ground](../ground/), at
[jsip.uk/whats-missing](https://jsip.uk/whats-missing/). Unlisted and `noindex`,
linked only from Ground's own footer.

The path is a historical name. It began as a research note proposing three
prototypes, and the URL was kept when the note became a product page so an
existing bookmark would not break.

## What the page covers

1. **Why it exists** — the audit finding that motivated the work
2. **What it is** — the three faces, and the Today screen
3. **How it holds together** — the five lines, and the two rules everything rests on
4. **The loop** — conversation to account to notes to practice
5. **What it will not do** — the honest limits

## The finding, for the record

An audit of this site, the installed skills, and the reports written about the
job itself turned up the same shape everywhere:

- **The Future SE Stack** ranks 22 systems by leverage and names five as
  buildable now. None existed.
- **Champion Deposits** is a complete operating model whose README said
  `The spreadsheet doesn't exist yet.`
- **inbox-sweep** existed in five hand-maintained versions, because the sender
  map lived in prompt text rather than in data.
- The **POV tracker** gives each plan a unique `storageKey`, so nothing carried
  from one evaluation to the next.
- The **positioning skill** re-researched from zero on every run.

Sixteen good things, none of which held anything up for the next one. All of the
systems above depended on the same absent thing: a durable, private store of
professional judgement. That store is now `/ground/`.

Two further reasons it was worth building rather than merely noting: every
commercial equivalent is cloud software bought by an employer, so the expertise
accrues to their tenant rather than to you; and there were already two piano
practice apps on this site and nothing at all for the skill that pays.

## History

Three prototypes were built here first, at `v1-field-notes/`, `v2-dojo/` and
`v3-account-brain/`. Each was promoted to a full app, then all three were merged
into Ground when it became clear that three passphrases and three backups was a
worse problem than any duplication between them.

Those three paths, and the `/field-notes/`, `/dojo/` and `/account-brain/` paths
that followed them, are now one-hop redirects.

Each retired app keeps two files. `index.html` is the landing page. `sw.js` is
load-bearing rather than leftover: the retired apps were installable, and their
cache-first service workers would otherwise keep serving the old shell from disk
forever. Each has been replaced by a worker that clears its own caches,
unregisters itself and reloads any open tab. Do not delete them.

## Maintenance

The page is a single self-contained `index.html` with inline styles, no
dependencies and no network requests. If Ground's design changes, sections 3 and
5 are the ones that go stale first: they describe the two rules and the limits,
which are the parts most likely to move.
