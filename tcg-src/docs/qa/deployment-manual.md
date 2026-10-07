# Deployment and additional manual QA — 7 October 2026

The five alpha commits were applied to a clean worktree based on the latest main
and pushed without changing any unrelated paths. Published alpha commit:
`ac1f3ff3aef86a0e7be34d148b9ecc8db4cb22b4`.

GitHub Pages [run 37623356120](https://github.com/jsipuk/jsipuk.github.io/actions/runs/37623356120)
completed successfully. Build, report-build-status and deploy jobs all succeeded.
Deploy logs confirm that exact commit's deployment and report success.
Production URL: https://jsip.uk/tcg/.

## Direct live checks remain blocked

Both desktop and mobile Chromium navigation attempts to the production URL
returned `ERR_TUNNEL_CONNECTION_FAILED`. curl returned `403 CONNECT` and the
web tool could not access the site. The managed environment's enforced network
policy does not allow jsip.uk, api.tcgdex.net or assets.tcgdex.net.

Deployment success is verified independently through GitHub. Served live bytes,
real image availability and end-to-end production browser behaviour are **not**
verified. No proxy bypass, host rewriting or simulated live origin was used.

## Additional hands-on browser exploration

Tested the **exact pushed production files** from a loopback server at 1440 × 900
and 390 × 900. This is local QA, distinct from live QA. Screenshots were visually
inspected and interactions were explored outside the existing regression suite.

- Edit then Escape cancels the staged quantity and restores pocket focus.
- Expanded artwork zoom fits within the dialog width at both sizes.
- Base Set's last page (12 of 12) preserves nine pocket positions with three real
  cards and six empty pockets. Next is disabled at the boundary.
- A touch swipe returns to page 11 while preserving page order.
- Team Up input `196/181` matches Pokémon Communication and `175/181` matches
  Evelyn. `004/102` is rejected in that release, and malformed `129/10?` stays
  unresolved. The owned list contains exactly the two accepted real cards.
- A second browser tab adds an English Base Set card; the first tab receives the
  storage update and refreshes the collection.
- No JavaScript page errors were observed.

## Confirmed regression and fix

A simulated storage failure during Save left quantities unchanged, but the error
message appeared in the page toast **behind** the native expanded-card dialog.
Screenshots and `elementFromPoint` prove the message was occluded at both widths.

Feedback while a dialog is open now appears inside that dialog and scrolls into
view. Quantity operations and the approved UI layout are unchanged. Normal
successful saves close the dialog and retain the existing readable Undo toast.

A targeted visual recheck confirms the failure message is exposed at both widths.
The browser regression test now checks visibility and whether the message is
actually unobstructed, as well as verifying that storage remains unchanged.
All 12 unit/data tests and all six desktop/mobile browser flows pass after the fix.

Evidence: `manual-results.json`, `manual-feedback-results.json`, and the
`manual-*.png` screenshots in this directory. Live manual QA must resume once
outbound access to the three required hosts is enabled.
