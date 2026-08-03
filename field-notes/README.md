# Field Notes

The topic-indexed library of what you know, at
[jsip.uk/field-notes](https://jsip.uk/field-notes/).

## Why it exists alongside the other two

This was the third app built, and the honest question before building it was
whether it still had a job once Account Brain existed. It does, but a narrower
one than the original prototype claimed, and the scope was cut to match:

| | Shape | Holds |
| --- | --- | --- |
| Account Brain | Account shaped | Everything that hangs off one customer |
| The Dojo | Skill shaped | Everything that hangs off one question |
| **Field Notes** | **Topic shaped** | **Everything that belongs to no account at all** |

The things with no home in the other two: a limitation you found in a lab, a
proof point you can reuse anywhere, a competitor line heard at a conference, an
answer that worked across three deals, something you learned about the job
itself.

Two consequences of drawing that line:

- **There is no "person" note type.** Who someone is and where they stand is
  Account Brain's job. Duplicating it would leave two half-right copies of the
  same stakeholder. Notes of that kind from the prototype are migrated to
  "lesson" rather than dropped.
- **Topics is the view neither other app has.** What do I actually know about
  DLP, regardless of which customer it came from.

## It starts full, not empty

A capture tool is worth nothing on day one, which is the single biggest reason
they get abandoned. So Field Notes can be filled from Account Brain: every
*I learned* line and every open objection arrives as a note, tagged with its
account. Run it again whenever you like, it only adds what is new.

Two mappings only, both unambiguous:

| Account Brain | becomes |
| --- | --- |
| `entry.learned` | a **lesson** |
| open `objection` threads | an **objection** |

Quotes and promises are deliberately **not** imported. A quote is as often a
proof point as an objection, so importing it under either label would be wrong
half the time, and a wrong label is worse than no note. Promises belong to the
account and stay there.

Notes flow the other way too: any objection, gotcha or competitor note can be
exported as practice cards for The Dojo. So the full loop is:

```
customer conversation
      -> Account Brain   (the record, per account)
      -> Field Notes     (the library, per topic)
      -> The Dojo        (the gym, per question)
```

## Capture

One box, one keystroke. Type-ahead classification via the chip row, and inline
syntax so capture never leaves the text field:

```
#tag            a topic
@Account        a customer
@"Two Words"    a customer whose name has spaces
```

Both markers stay in the body text, so nothing is lost if the parse rules ever
change. A known limit, covered by a test rather than hidden: a bare email
address in a note reads its domain as an account.

**Resurface** shows three notes each session, least-seen first, deterministically
rather than at random, so the same few do not keep reappearing while others are
never seen. A library you never meet again is a graveyard.

## Privacy

**The page is public. The data is not.** `localStorage` is scoped to one origin,
one browser, one device. Nothing is sent anywhere, nothing is committed to this
repository, and there is no account, analytics, CDN, font fetch or runtime
request of any kind.

- **AES-GCM 256**, key derived by **PBKDF2-HMAC-SHA256** at **600,000
  iterations**. Around 350ms to unlock.
- Fresh random salt and IV per save; key held in memory for the session only.
- Auto-lock on idle, plus a manual Lock button.
- Verified: the stored blob contains no readable note text or account name.

There is **no recovery**. Forget the passphrase and the data is gone. The
context pack and plain export are deliberately readable because that is their
job, and both warn that they may name real customers.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Shell: lock, notes, topics, dialogs |
| `style.css` | Design system, shared tokens with the rest of the site |
| `store.js` | Envelope format and cryptography. No DOM, runs under Node |
| `model.js` | Parsing, filtering, topics, resurfacing, packs, app-to-app mapping, sanitising. No DOM, no clock of its own |
| `app.js` | Persistence, the lock, rendering. No business logic |
| `sw.js` | Precache and serve cache-first |
| `manifest.webmanifest`, `icons/` | Add to Home Screen |
| `test/run.js` | Test suite. `node field-notes/test/run.js` |

`store.js` is byte-identical to `dojo/store.js` and `account-brain/store.js`
apart from the app name; the test suite diffs all three and fails if they drift.
The differing app names also stop any of the three opening another's backup,
which is checked.

## Migration from the prototype

The throwaway prototype at `/whats-missing/v1-field-notes/` wrote to the same
origin, so its data is still there. It is recognised on first load and lifted
across rather than silently discarded.

## Releasing changes

Bump `CACHE` in `sw.js` whenever any file in `ASSETS` changes. Run
`node field-notes/test/run.js` before pushing.

## Verified

`node field-notes/test/run.js` — **93 checks**: inline parsing including
non-ASCII tags and the documented email limitation, pluralisation, every filter
combination, topic and account indexing, deterministic resurfacing, context
packs matching the on-screen filter exactly, the Account Brain import including
what it must *not* import and idempotency on re-run, Dojo card generation,
prototype migration, malformed-input sanitising, encryption round trip, wrong
passphrases, bit-flip tamper detection, and cross-app envelope rejection.

Browser harness confirms capture, tag and topic filtering, storage opacity,
lock and unlock, the Account Brain import round trip, full offline operation,
and no horizontal overflow at 390px. A DOM sweep also checks every class used in
the markup has a matching CSS rule, which is how an entirely unstyled control
was caught before shipping.
