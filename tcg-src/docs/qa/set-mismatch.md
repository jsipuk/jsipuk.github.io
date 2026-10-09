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

## Locked-dependency recheck — 9 October 2026

The requested `npm ci` was run with the existing lockfile. It failed with
`E403` fetching the pinned package:

```text
403 Forbidden - GET https://registry.npmjs.org/playwright-core/-/playwright-core-1.56.1.tgz
```

An independent HEAD request to that exact URL returned `HTTP/1.1 403 Forbidden`
and `curl: (56) CONNECT tunnel failed, response 403`. The current enforced
network policy (spec revision 16) allows only `assets.tcgdex.net`, `jsip.uk` and
`www.jsip.uk`; the npm registry is still absent despite the expected allowlist
update. No network policy or certificate stores were changed.

The requested commands were also attempted:

- `npm test`: 31 tests passed; the storage test file could not load because
  `fake-indexeddb` is missing. This is not a complete unit-suite pass.
- `npm run test:browser`: failed before collecting tests with
  `error: unknown command 'test'`; the locked project Playwright test runner is
  unavailable after the failed installation.
- `npm run build`: failed with `ERR_MODULE_NOT_FOUND` for `esbuild`. No new
  production output was generated.

The legacy binder-opening discrepancy remains unresolved. Isolated diagnostic
probes passed against both original and proposed source at both widths, and a
delayed reference-save probe passed against the original source. Those probes
do not establish a cause for the broader-suite failure. The test has not been
skipped or weakened, and no speculative binder fix was added.

Passing domain checks include preservation of quantities during reference
updates, lossless backups, resets and incompatible legacy catalogue upgrades.
Earlier source-browser checks passed explicit mismatch recovery, duplicate
quantities, Undo and refresh persistence at both widths. Storage-suite and
generated-build migration verification remain blocked, so there is no complete
ownership-safety sign-off for this change.

PR #50 remains draft and is not yet cleared to merge. Once the registry is
actually allowed: run `npm ci`, complete both suites, resolve the binder failure,
build and test the generated `/tcg/` output at 1440px and 390px, and verify the
original live acceptance scenarios plus mismatch recovery. Then update the PR
with the tested artifacts and make it ready for review. Published artifacts
remain unchanged; no deployment of this fix is claimed.
