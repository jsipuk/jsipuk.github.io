# Prototype baseline — 7 October 2026

Before feature implementation, Chromium QA attempted https://jsip.uk/tcg/ at
1440 × 900 and 390 × 900. Both failed with ERR_TUNNEL_CONNECTION_FAILED because
jsip.uk is denied by the environment network policy. **Live QA remains blocked.**

Fallback: tested the exact repository prototype at localhost. SHA-256
`7ef82e853947fe5928aedc9154a1bd564538e86a24fe6ff9b4a290aa82ef5de0`
matches both the checked-out file and fetched origin/main:tcg/index.html.
This proves the source baseline, not the currently served site's bytes.

Screenshots and machine results are in this directory. At both sizes:

- Nine cover tiles, ringless side-loading binder page, nine pockets; no page overflow.
- Expanded card view, quantity editing and undo work.
- Undo text rgb(16,30,73), yellow background rgb(255,218,34), white border.
  Preserve normal, hover and keyboard-focus readability.
- **Fix:** saving an already-needed card after “Mark as needed” changes quantity
  from zero to one. Explicit zero must remain zero.

Preserve the cobalt/yellow/navy palette, stitched premium covers, animations,
missing-card slots, fixed folder-tab navigation, list/grid choice and page order
under filtering. Cover artwork is decorative; card artwork in the alpha must be
real reference artwork or a clearly labelled unavailable state.
