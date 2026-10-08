# Set mismatch recovery — 8 October 2026

Entering `119/182` with Perfect Order selected previously returned a generic
no-match message. The exact live miss was reproduced at 1440px and 390px:
Perfect Order #119 is Mega Clefable ex `119/088`; Destined Rivals #119 is
Team Rocket's Nidoking ex `119/182`.

Rapid Entry now explains the printed-total mismatch and offers exact matches
in other available sets. Ready releases with the supplied printed total can be
loaded on demand, so Destined Rivals need not already be on the shelf. The
explicit **Switch to Destined Rivals and add** action adds one copy, tracks the
destination set and saves its entry context. Cancel preserves the original
input and selected set; Undo restores ownership, tracking and entry context.
Strict matching remains unchanged; the app never drops the supplied denominator
to guess ownership.

Batch review presents the same explanation and candidate. A confirmed card
stays pending until the user commits the review. Malformed numbers, unmatched
numbers and unavailable release data never add quantities. Async results are
discarded after navigation or a newer review request.

## Validation

- 31 unit/data tests passed, including mismatch diagnosis against the actual
  Perfect Order and Destined Rivals packs and preservation of exact matching.
- Eight targeted browser cases passed at 1440×900 and 390×900: explicit
  confirmation, cancel, Undo, duplicate quantity, saved-context reload, mixed
  batch confirmation/commit, malformed/unmatched input, and failed-pack retry.
- Candidate artwork rendered from the genuine TCGdex URL at both widths and
  was visually inspected.
- A broader source-only browser run passed 59/60 cases. The legacy migration
  binder-opening case failed once in that run and on a focused source recheck;
  the identical case passed at both widths against the unchanged existing
  production bundle. The source/bundle discrepancy remains unresolved and must
  be checked against the newly built production output before deployment.

The source browser checks used a temporary loopback server serving ES modules
and the installed Playwright runtime because project dependencies are absent.
They are not validation of a generated or newly deployed production bundle.
The user-authorized HTTPS exception was limited to disposable test contexts;
no certificate stores were changed.

## Build and deployment blocker

`npm run build` fails with `ERR_MODULE_NOT_FOUND`: package `esbuild` is absent.
`npm ci --offline` fails with `ENOTCACHED` for pinned dependencies.
`curl -I https://registry.npmjs.org/esbuild` returns:

```text
HTTP/1.1 403 Forbidden
curl: (56) CONNECT tunnel failed, response 403
```

The enforced environment policy currently allows the live app and image hosts
but excludes `registry.npmjs.org`. Registry access has been requested. No network
policy bypass was attempted. The full npm test suite, generated build, and live
verification of this fix are pending. Published `/tcg/` artifacts remain unchanged.

After registry access is available: install locked dependencies with `npm ci`,
run the full unit and desktop/mobile browser suites, build `/tcg/`, publish the
tested source and generated output, and repeat live acceptance plus the
`119/182` mismatch-recovery flow using the approved isolated browser contexts.
