# Champion Deposits — Quickstart

The whole system is: **one spreadsheet + one weekly Claude session + Gmail.**
Nothing else. Full design rationale lives in [README.md](./README.md) —
you don't need to re-read it to run a week.

## One-time setup (~30 min, do once)

1. Create a Google Sheet with exactly these columns:

   ```
   Name, Email, Company, Role/title, Relationship type, Primary topics, Last contacted, Do-not-contact, Notes
   ```

2. Add 5–10 contacts you know well. For `Primary topics`, pick 2–4 tags
   from the taxonomy in the README (e.g. `ai-security, dlp, vpn-replacement`).
3. That's it. No sources list to prepare, no tooling — Claude handles the
   scanning.

## Weekly run (~20 min, same day each week)

1. Open a Claude Code session on this repo.
2. Say: **"Run the weekly champion deposits cycle"** and paste your
   spreadsheet rows (or just the ones that changed).
3. Claude searches the week's sources, matches articles to contacts, and
   returns ready-to-send drafts — each with To / Subject / Body, a
   confidence rating, and the source link.
4. For each draft, do a 60-second gut check:
   - Have I (or Claude, verifiably) actually read the article?
   - Would this land as genuinely useful, not salesy?
   - Have I emailed this person in the last 2 weeks?
5. Paste the survivors into Gmail and send. Discard the rest guilt-free.
6. Update `Last contacted` in the sheet for anyone you emailed.

## The three rules that matter

- **Zero drafts is a fine week.** Never force a weak match.
- **Max one email per contact per 2 weeks.**
- **Never send anything you haven't read the source of.**

Everything else in the README is tuning detail — these three keep it safe.
