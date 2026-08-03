# Account Brain

One living page per account, and a brief you can read in a car park, at
[jsip.uk/account-brain](https://jsip.uk/account-brain/).

The product is the **pre-call brief**. Everything else exists to make that
screen worth opening: who is in the room and where they stand, what is still
open against you, their words verbatim, and above all **what you promised and
have not sent**. That last one is the expensive one.

## It speaks the five lines

Logging a meeting asks for exactly the five lines from the note system, because
the note is the input to this and this is what makes writing the note pay back:

```
SO WHAT     What actually changed. "Nothing changed" is a valid answer.
THEY SAID   One quote. Verbatim, in their words.
I LEARNED   One thing you know now that you did not at 9am.
STILL OPEN  What is unresolved or still against you.
I OWE       What you promised, to whom, by when.
```

The conversion is the point:

- **I owe** becomes a tracked promise with a due date, so it can go overdue and
  find you on the Today screen. A promise with no date cannot remind you, and
  the form says so.
- **Still open** becomes a tracked objection, risk or question, so it appears on
  the next brief.
- **They said** is kept verbatim for executive summaries and business cases.
- **I learned** is lifted out of the account into the **Learned** view, and can
  be exported straight into The Dojo as practice cards.

That last path closes the loop: an objection heard in a real meeting becomes a
card you rehearse until it stops catching you out.

## Today

One list, across every account, of what will cost something if ignored. Four
rules only, all computed from what you entered, so every line can be explained:

| Rule | Threshold |
| --- | --- |
| A promise is overdue | Its due date has passed |
| A promise is due soon | Within 3 days |
| An account is cooling | No contact for 21 days |
| An account is cold | No contact for 35 days |
| An account has drifted | No open next step, and not dormant or a customer |

No scoring, no weighting, no hidden model. The thresholds live in one place in
`model.js` so they are arguable rather than scattered.

## Privacy

**The page is public. The data is not.** `localStorage` is scoped to one origin,
one browser, one device. Nothing is sent anywhere, nothing is committed to this
repository, and there is no account, analytics, CDN, font fetch or runtime
request of any kind.

This app is a step up in sensitivity from The Dojo: it holds real customer
names, roles, and things people told you in confidence. Encryption is therefore
the default path rather than an afterthought.

- **AES-GCM 256**, key derived by **PBKDF2-HMAC-SHA256** at **600,000
  iterations**. Around 240ms to unlock.
- Fresh random salt and IV per save. The iteration count travels in the envelope
  so the work factor can be raised later without locking out older data.
- The derived key is held in memory for the session only, never written.
- Auto-lock on idle, plus a manual Lock button.
- Verified: with the example account loaded, the stored blob contains no
  readable account name, person name or quote.

What it does not do: it cannot protect you from someone holding both the device
and the passphrase, and **there is no recovery**. Forget the passphrase and the
data is gone. Both are said in the UI before you set one.

The **context pack** and **plain export** are deliberately readable, because
that is their job. Both warn you, in those words, that they contain real names.

## Offline and backup

Installable PWA, precached, cache-first. Verified with the network fully
disabled: the app loads, unlocks and renders.

*Encrypted backup* in Settings is safe to keep in Google Drive precisely because
it is ciphertext. Import merges by id, so restoring an older backup cannot
discard newer work.

## Where the CRM line is

*Copy CRM lines* gives you three lines only: the summary, the next step with its
date, and the open items. The verbatim quote and the learning stay here. The CRM
is for the deal; this is for your judgement.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Shell: lock, today, accounts, detail, brief, learned, dialogs |
| `style.css` | Design system, shared tokens with the rest of the site |
| `store.js` | Envelope format and cryptography. No DOM, runs under Node |
| `model.js` | Every rule worth arguing about: attention, warmth, briefs, packs, import sanitising. No DOM, no clock of its own |
| `app.js` | Persistence, the lock, rendering. Deliberately contains no business logic |
| `sw.js` | Precache and serve cache-first |
| `manifest.webmanifest`, `icons/` | Add to Home Screen |
| `test/run.js` | Test suite. `node account-brain/test/run.js` |

`model.js` takes `now` as an argument everywhere rather than reading the clock,
which is why the date and attention logic can be tested at all.

### On the duplicated `store.js`

`account-brain/store.js` is byte-identical to `dojo/store.js` apart from the app
name and the exported global. That is deliberate: each app precaches its own
files, and a service worker only intercepts requests inside its own scope, so a
shared `/lib/` copy would silently break offline for both. `test/run.js` diffs
the two files and **fails if they drift apart**, so the duplication cannot rot.

The differing app name also means the two apps cannot accidentally open each
other's backups, which is checked by a test.

## Releasing changes

Bump `CACHE` in `sw.js` whenever any file in `ASSETS` changes, or returning
visitors keep the old cached version. Run `node account-brain/test/run.js`
before pushing.

## Verified

`node account-brain/test/run.js` — **104 checks**: date and pluralisation edge
cases, warmth thresholds, every attention rule including the ones that must
*not* fire (archived accounts, dormant accounts, promises with no due date),
brief ordering, the CRM subset excluding the quote and the learning, craft
extraction, Dojo card generation, context packs, search, import sanitising of
malformed and orphaned records, encryption round trip, wrong passphrases,
bit-flip tamper detection, and cross-app envelope rejection.

Browser harness confirms: the five lines auto-create the right threads, the
brief leads with the overdue promise, storage is opaque, a reload locks, search
works, the app runs fully offline, and a Learned export imports into The Dojo as
working practice cards.
