# The Dojo

Deliberate practice for the conversations that decide deals, at
[jsip.uk/dojo](https://jsip.uk/dojo/).

One rep is ninety seconds: a real question under a clock, answered out loud or
typed. Then the *shape* of a good answer rather than a model answer, a rubric you
mark yourself against, and spaced repetition so the ones you fumble come back
sooner. Answers you keep build an answer bank, which is the point of the whole
thing: it is the part that outlives the job.

## Privacy, stated plainly

**The page is public. The data is not.**

`localStorage` is scoped to one origin, in one browser, on one device. Nobody
loading jsip.uk can read yours, nothing is ever sent over the network, and no
version of it is committed to this repository. There is no account, no
analytics, no CDN, no font fetch, and no runtime request of any kind.

The realistic risks are narrower than "it is on a public site", so the app is
built for the ones that are real:

| Risk | What is done about it |
| --- | --- |
| Someone opens the page on your unlocked laptop | Encrypted at rest with a passphrase, plus auto-lock |
| Browser clears storage, or the device is replaced | Encrypted backup file you can keep anywhere |
| Backup file leaks | The backup is ciphertext, useless without the passphrase |
| Someone finds the URL | They get an empty app. Your store is not theirs |

### The crypto

- **AES-GCM 256** for the data, key derived by **PBKDF2-HMAC-SHA256** at
  **600,000 iterations** (the current OWASP floor). Roughly 200ms to unlock.
- Fresh random 16-byte salt and 12-byte IV per seal. The iteration count travels
  in the envelope, so the work factor can be raised later without locking out
  data written by an older version.
- AES-GCM is authenticated, so a wrong passphrase and a tampered file both fail
  the same way. There is no separate verifier to drift out of sync.
- The derived key lives in memory for the session only. It is never written to
  storage.

### What it does not do

- It **cannot** protect you from someone who has both the device and the
  passphrase.
- **There is no recovery.** Forget the passphrase and the data is gone. That is
  what makes it work, and the app says so before you set one.
- It does not protect against a compromised browser or a malicious extension,
  which can read the page while it is unlocked.
- Encryption is optional. Skipping it stores readable text, and Settings says so
  in those words.

## Using it

- **Install it.** Add to Home Screen on iPhone or iPad and it opens without a
  browser bar and runs with no signal at all. Verified with the network fully
  off: the app loads, unlocks and runs a rep.
- **Back it up.** Settings, then *Encrypted backup*. Safe to keep in Google
  Drive precisely because it is ciphertext. Import merges rather than
  overwrites, so restoring an old backup will not throw away newer reps.
- **Add your own cards.** The built-in deck is vendor neutral on purpose. Your
  own cards are where the real objections go, with your product, your
  competitors and your accounts in them. They are encrypted with everything else
  and travel with your backup.
- **Feed it to Claude.** *Answers*, then *Build context pack* produces markdown
  designed to be pasted in as grounding context so drafts argue from positions
  you have already tested.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell: lock screen, home, rep, review, answer bank, cards, dialogs |
| `style.css` | Design system, shared tokens with the rest of the site |
| `store.js` | Envelope format and all cryptography. No DOM, runs under Node |
| `deck.js` | The 44 built-in cards and the seven categories. No DOM, runs under Node |
| `app.js` | State, persistence, the lock, scheduling, rendering |
| `sw.js` | Precache and serve cache-first so it works offline |
| `manifest.webmanifest`, `icons/` | Add to Home Screen |
| `test/run.js` | Test suite. `node dojo/test/run.js` |

## The deck

44 cards across Discovery, Objection, Executive, Technical, Competitive,
Evaluation and Deal craft.

Deliberately vendor neutral: **no card asserts a product capability, a
competitor gap or a statistic.** Those go stale, and a practice tool that drills
an unverified claim is worse than no practice tool. `test/run.js` enforces this
with a check that fails the build if a vendor name or a percentage appears in
the built-in deck.

Each card carries a `shape` (the structure of a good answer, not the answer) and
a `watch` (the failure mode the card exists to train out of you).

## Scheduling

SM-2, simplified. Fumbled resets to tomorrow; *got there* grows the interval by
about 1.7x; *nailed it* by about 2.4x. Capped at 120 days so nothing silently
disappears for good.

## Releasing changes

Bump `CACHE` in `sw.js` whenever any file in `ASSETS` changes, or returning
visitors keep the old cached version. Run `node dojo/test/run.js` before pushing.

## Verified

`node dojo/test/run.js` — 33 checks covering the round trip, wrong passphrases,
bit-flip tamper detection, salt and IV freshness, and deck integrity.

Browser harness confirms: the stored blob contains no readable answer text, a
reload locks, a wrong passphrase is rejected, the app runs fully offline with the
network disabled, and an encrypted backup restores onto a clean browser.
