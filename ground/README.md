# Ground

Accounts, notes and practice in one private, offline store, at
[jsip.uk/ground](https://jsip.uk/ground/).

Replaces `field-notes/`, `account-brain/` and `dojo/`, which were three apps
doing three halves of one job.

The name is meant literally in two senses: the **ground truth** of what was
actually said and promised, and the thing that keeps you **grounded** before a
call. It is also what the context packs tell Claude they are.

## Why merging was the right call

The three separate apps looked clean and were not. They shared an origin, so
they could always have read each other directly; exporting a file from one and
importing it into another was an artefact of the split, not a necessity.

Worse, three apps meant **three passphrases and three backups**. Forget one and
you lose a third of the system. That fragility was the strongest argument for
merging, ahead of any convenience.

Now: one store, one lock, one backup file, one icon, and the flows between the
three faces are a single click.

## The two decisions the design rests on

### 1. Learnings are derived, not copied

An *I learned* line written against an account is **not** duplicated into notes.
`allNotes` unions the real notes with synthetic ones projected from log entries,
so there is exactly one copy of the text.

Edit it on the account and the note changes with it. There is no sync step, no
dedupe, and nothing that can drift. Synthetic notes carry an `e:` id prefix, are
shown with a *from a log entry* badge, offer **Open account** instead of
**Delete**, and are refused if anything ever tries to write them back to storage.

### 2. A note is not a thread

- A **note** records something observed. It is true forever and never needs
  closing.
- A **thread** is something open that must be closed, and drives the overdue
  logic that makes the brief trustworthy.

So notes that mention an account surface on it **read-only**, under *Also
known*. Promoting one into a tracked thread is a deliberate click.

Auto-converting would have created two sources of truth for "is this still
open", and slowly filled the brief with stale items nobody ever closed. A
promoted note also drops out of *Also known*, so the brief never says the same
thing twice.

## The three faces

| Face | Shape | Ritual |
| --- | --- | --- |
| **Accounts** | Account shaped | Before the call. The pre-call brief is the product |
| **Notes** | Topic shaped | After the call, or any time. Fast capture, topic recall |
| **Practice** | Skill shaped | Dead time. Ninety-second reps on 44 vendor-neutral cards |

**Today** is the only screen you have to open to know whether anything is
waiting: attention across accounts, plus one line each for cards due and notes
worth revisiting. Search from there covers accounts, people, threads, log
entries, notes and kept answers in one box.

## What the merge made possible

- **Practise this.** Any objection, on a thread or a note, becomes a practice
  card in one click. No export, no import, no file.
- **Track this.** A note that mentions an account becomes a tracked thread when
  you decide it should be.
- **One context pack per question.** Account, portfolio, filtered notes, or the
  answer bank, all from one store.
- **One backup.** One encrypted file holds everything.

## Privacy

**The page is public. The data is not.** `localStorage` is scoped to one origin,
one browser, one device. Nothing is sent anywhere, nothing is committed to this
repository, and there is no account, analytics, CDN, font fetch or runtime
request of any kind.

- **AES-GCM 256**, key derived by **PBKDF2-HMAC-SHA256** at **600,000
  iterations**. Around 340ms to unlock.
- Fresh random salt and IV per save; key in memory for the session only.
- Auto-lock on idle, plus a manual Lock button.
- Verified: with the example loaded, the stored blob contains no readable
  account name, person name, quote or note.

It cannot protect you from someone holding both the device and the passphrase,
and **there is no recovery**. The context pack and plain export are deliberately
readable because that is their job, and both warn that they name real people.

## Migrating from the three old apps

Settings, then **Look for old data**. It reads the three predecessor storage
keys in this browser, asks for a passphrase only for the ones that are actually
encrypted, skips any you cancel, and merges by id, so running it twice changes
nothing. Backup files from the old apps import the same way.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Shell: lock, today, accounts, detail, brief, notes, topics, practice, answers |
| `style.css` | Design system, shared tokens with the rest of the site |
| `store.js` | Envelope format and cryptography. No DOM, runs under Node |
| `deck.js` | The 44 built-in practice cards. No DOM, runs under Node |
| `model.js` | Every rule worth arguing about, across all three faces. No DOM, no clock of its own |
| `app.js` | Persistence, the lock, rendering. Deliberately no business logic |
| `sw.js` | Precache and serve cache-first |
| `test/run.js` | Test suite. `node ground/test/run.js` |

`model.js` takes `now` as an argument everywhere rather than reading the clock,
which is the only reason the date, attention and scheduling logic is testable.

## Releasing changes

Bump `CACHE` in `sw.js` whenever any file in `ASSETS` changes. Run
`node ground/test/run.js` before pushing.

## Verified

`node ground/test/run.js` — **156 checks**, including the parts that must *not*
happen: derived notes never persisted, archived and dormant accounts never
raising attention, promises without a due date never going overdue, the CRM
subset never leaking the quote or the learning, reading notes never creating
threads, and a promoted note never appearing twice in a brief.

Browser harness confirms: the five lines create the right threads, editing a
learning at source changes the note, Track this and Practise this both work with
no files, the brief leads with the overdue promise, one search reaches notes and
kept answers, storage is opaque, reload locks, and the app runs fully offline.

A DOM sweep also checks that every class used in the markup has a matching CSS
rule. It has now caught two real defects that functional tests missed, both
caused by assembling a stylesheet from slices of another.
