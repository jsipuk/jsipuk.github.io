# GitHub Pages site manual (for AI assistants)
Version 1.0, 2026-10-23. For Claude (Claude Code) and ChatGPT (Codex).
Independent guide; not affiliated with GitHub, Anthropic, OpenAI or Cloudflare. Licence: CC BY 4.0.
Follow this manual. If it conflicts with your general habits, the manual wins.
If it conflicts with the user's latest message, the user wins.
Setup step numbers match the human Guide (Steps 1 to 5).

## 0. Site values (the user fills these in)
SITE_OWNER:      [GitHub username]
REPO:            [username/username.github.io]
DOMAIN:          [yourname.co.uk | none]
DNS_HOST:        [registrar name | Cloudflare | none]
EMAIL_ON_DOMAIN: [yes, with provider name | no | no domain]
SHIP_ROUTE:      [main | pull-request]
MODE:            [SETUP | FIRST RUN | OPERATE]
If any value is blank or still in brackets, ask for it before acting.
In SETUP mode, SITE_OWNER and REPO may not exist yet: help the user choose them in Step 1.

## 1. Your job in each mode
- SETUP: coach the user through section 4, one step at a time. You can't click for them.
  Give the exact clicks, then wait for "done", a paste or a screenshot.
  Confirm the step's CHECK passed before the next step.
  Screens change. If the user's screen doesn't match, ask what they see and adapt.
- FIRST RUN: you are in a session with REPO open. Do section 6 once, then switch to OPERATE.
- OPERATE: do what the user asks, following AGENTS.md in the repo
  (or this manual, if AGENTS.md is missing). Report as in section 9.

## 2. How the site works
User asks -> AI edits a copy of REPO -> ships by SHIP_ROUTE
(push to main, or push a branch and open a pull request the user merges)
-> GitHub Pages publishes main, usually within a minute or two
-> live at https://DOMAIN, or https://SITE_OWNER.github.io if DOMAIN is none.
Pages serves branch main, folder / (root). No build step.
Folders become addresses: piano/index.html is served at /piano/.
Website DNS records for DOMAIN (set by the user at DNS_HOST):
  A     @    185.199.108.153
  A     @    185.199.109.153
  A     @    185.199.110.153
  A     @    185.199.111.153
  CNAME www  SITE_OWNER.github.io
  Optional IPv6, as well as the A records:
  AAAA  @    2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153
  Never wildcard (*) records.

## 3. Who can do what
| Task | Who |
| --- | --- |
| GitHub sign-up, repo creation, GitHub settings | User only |
| Buying a domain, DNS records, Cloudflare dashboard | User only |
| Email accounts, mailboxes, aliases and forwarding | User only |
| Connecting GitHub to Claude or ChatGPT, paid plans | User only |
| Creating, editing and deleting files in REPO | AI |
| Commits, pushes, branches, pull requests | AI |
| Merging a pull request | User, unless they tell you to |
For "User only" tasks, give the user clear steps. Never claim you did them.

## 4. Setup steps (SETUP mode)
Each step has DO and CHECK. Don't move on until CHECK passes.
Step 1 Repo and Pages.
  DO: (a) Create a PUBLIC repo named SITE_OWNER.github.io with a README.
          Free GitHub accounts can only publish public repos.
      (b) Add index.html: a simple starter page.
      (c) Repo Settings > Pages > Build and deployment: Source "Deploy from a branch",
          Branch main, folder / (root), Save.
  CHECK: Settings > Pages says the site is live; https://SITE_OWNER.github.io shows the page.
Step 2 Domain (skip if DOMAIN is none). Order matters.
  DO: (a) Recommended: verify the domain. Profile picture > Settings > Pages (under
          "Code, planning, and automation") > Add a domain. Add the TXT record GitHub shows
          (host _github-pages-challenge-SITE_OWNER) at DNS_HOST, then click Verify.
          The TXT record must stay.
      (b) Repo Settings > Pages > Custom domain: enter DOMAIN, Save. This commits a CNAME file.
      (c) At DNS_HOST, have the user screenshot every existing record before changing anything.
      (d) Delete ONLY the records for @ and www that send the website elsewhere:
          A, AAAA, CNAME, ALIAS/ANAME, and URL redirect or forwarding records
          (usually parking-page defaults). Never delete MX or TXT records.
      (e) Add the website DNS records in section 2.
  CHECK: Settings > Pages shows the DNS check passing. Allow up to 24 hours.
         Then tick Enforce HTTPS (it can take up to 24 hours to appear).
         If the domain has CAA records, one must allow letsencrypt.org.
Step 2b Cloudflare (optional). Follow section 8.
Step 3 Connect Claude. Plan: Pro, Max or Team, or an Enterprise seat with Claude Code.
  DO: claude.ai/code (or the Code tab in the Claude app) > connect GitHub > approve.
      Team and Enterprise: an Owner must turn on the GitHub connector first, and the user
      sees a "Create your first cloud environment" form; leave it as it is.
      Optional: install the Claude GitHub App at github.com/apps/claude.
      It's required for private repos and for auto-fixing pull requests.
  CHECK: REPO appears in the repository selector.
Step 4 Connect ChatGPT. Plan: Plus, Pro, Business, Edu or Enterprise.
  DO: ChatGPT on web or desktop > Work in > Cloud > Select environment > Create environment >
      choose REPO > Get started (connect GitHub if asked) > review the setup and test results >
      save > Publish. The phone app can only pick an existing environment.
  CHECK: "Environment published", then REPO is available under Start a new task.
Step 5 Hand-off. Tell the user to start a session in the connected tool with REPO selected,
  then paste this manual with section 0 filled in and MODE: FIRST RUN.

## 5. Repo conventions
- Static files only. No build step, frameworks, package.json or bundlers unless the user asks.
- One project = one top-level folder named after it (/piano/), holding a self-contained
  index.html (inline CSS and JS), unless the user names another path.
  Link every project from /index.html.
- Use relative links (href="piano/"), so pages work on both DOMAIN and github.io.
- Keep CNAME (one line: DOMAIN) and .nojekyll at the root.
  Don't edit or delete them unless the user asks to change the domain.
- Never commit secrets: API keys, passwords or tokens. Never add other people's personal
  details. A contact email or name the user asks you to publish is fine.
  Everything in REPO, AGENTS.md included, is public and served on the live site,
  and git history keeps deleted files.
- Don't invent facts about the user or their business. Use clearly marked placeholders,
  such as [YOUR PHONE NUMBER], and list them in item 4 of your report.
- One commit per request. Commit messages: "Area: what changed", under 72 characters.
  Area is the folder or page changed (for example "piano: add practice log"),
  or "site" for changes across several root files.
- Write in UK English unless the user says otherwise.

## 6. First run (FIRST RUN mode)
1. Inspect REPO. Start your reply with a summary of five lines or fewer: pages and folders,
   the domain in CNAME, and anything broken (no index.html, broken links).
2. Add an empty .nojekyll file at the root if it's missing.
3. Create or update AGENTS.md at the root, in this shape:
     # AGENTS.md: rules for AI assistants on this site
     Made from the GitHub Pages site manual v1.0. Everything in this repo is public.
     If these rules conflict with the user's latest message, the user wins.
     ## Site values
     (the six value lines from section 0, filled in; leave out MODE)
     (then sections 2, 3, 5, 7, 8, 9, 10 and 11 of this manual, word for word, in that
      order, keeping their headings; leave out section 8 if DNS_HOST isn't Cloudflare)
   Keep any rules already in AGENTS.md. If one conflicts with this manual, ask which wins.
   If CLAUDE.md exists, make its first line @AGENTS.md.
   (Codex reads AGENTS.md. Claude Code reads it when there is no CLAUDE.md.)
4. Test: add <footer><p>Last updated: 23 October 2026</p></footer> (with today's date in that
   format) just before </body> in /index.html. If a footer exists, add the line inside it.
   It's a one-off test: don't keep the date updated unless the user asks.
5. Ship all of this as one commit, following section 7. End your reply with the section 9 report.

## 7. Shipping rules
- SHIP_ROUTE main: commit to main and push.
- SHIP_ROUTE pull-request: push a branch named claude/<topic> or codex/<topic> and open a
  pull request. Title: the commit message. Body: a one-paragraph summary and how to test it.
  Don't merge unless told.
- If your tool can't push straight to main, open a pull request instead and say so in item 4.
- Before starting, check for other agents' unmerged work on the same files: open pull requests
  (if your tool can see them) and unmerged branches (git branch -r --no-merged origin/main).
  If you find any, stop and ask.
- Never force-push, rewrite history, or delete branches you didn't create.
- Ask before deleting files or folders the user didn't name, or renaming a published folder
  (that breaks old links).
- Ask before changing any repo file that could affect the domain, DNS or email (such as CNAME).
- For user-only tasks (section 3), make no repo change for that part: give the user clear
  steps instead, and note it in item 4.
- To undo: git revert the bad commit and ship the revert by SHIP_ROUTE. Never reset main.

## 8. Cloudflare (only if DNS_HOST is Cloudflare)
Setup is user-only:
- Free plan; add the domain. (A domain bought from Cloudflare is already there: skip to proxy status.)
- Compare Cloudflare's imported records with the registrar's current list and add anything
  missing. Check the screenshot of DNS records the user took before changing anything:
  every MX and TXT record must be present, or email stops.
- Turn DNSSEC off at the registrar before switching nameservers, or the domain and its email
  can go offline. It can be turned back on from Cloudflare afterwards.
- Switch nameservers at the registrar; wait for the zone to show Active.
- Website records are the ones in section 2.
Proxy status:
- DNS only (grey cloud): the safe default; set it on every website record, because Cloudflare
  often imports them as Proxied. GitHub issues and renews its HTTPS certificate normally.
  Email Routing and Web Analytics (script version) work in this mode.
- Proxied (orange cloud): needed for Redirect Rules and caching. Proxy only the website
  records (the A records and the www CNAME). Set SSL/TLS encryption mode to Full (strict).
  Never Flexible: GitHub redirects HTTP to HTTPS, so Flexible loops (ERR_TOO_MANY_REDIRECTS).
- Switch to Proxied only after GitHub shows Enforce HTTPS ticked. If GitHub later reports a
  certificate problem, set the records to DNS only, wait for renewal, then switch back.
  (Users report renewals failing while proxied. GitHub doesn't document this.)
Features:
- Email Routing: only if EMAIL_ON_DOMAIN is no. Forwards hello@DOMAIN to a verified inbox.
  Free. Adds MX and SPF TXT records, and won't switch on until other MX records are deleted,
  which would cut off an existing mailbox. Receive only: replies come from the destination inbox.
  If EMAIL_ON_DOMAIN is yes, new addresses and forwarding are set up in that provider instead
  (for example an alias or a forwarding rule in Google Workspace or Microsoft 365).
- Web Analytics: free, no cookies. Script beacon in any mode, or automatic when proxied.
- Redirect Rules (proxied): send old paths to new ones. GitHub already redirects www.
- If DOMAIN shows an old version but SITE_OWNER.github.io shows the new one,
  the user should purge the Cloudflare cache (Caching > Purge Everything).
GitHub Pages sites are always public. Never put confidential content in REPO or on the site.
Alternative host: Cloudflare Workers (static assets) deploys from a private repo, which keeps
the source private, and posts a preview link on each pull request. Suggest it only if the
user needs private source or previews.

## 9. How to report back
After every task, including ones where nothing in the repo changed, end your reply with:
1. One line: what changed, or "no repo changes".
2. Where it went: the commit on main, the pull request link, or "nowhere".
3. The live link to check (on the pull-request route, after the merge), plus
   "allow a minute or two, then hard refresh (Ctrl+Shift+R)".
4. What you didn't do and why, any placeholders to fill in, and anything the user must do
   next (merge, a setting, DNS, an email alias). If there's nothing, say "nothing".
No code dumps unless asked.

## 10. Diagnostics
| Symptom | Check | Fix |
| --- | --- | --- |
| 404 on the site | Pages source setting; index.html at root, lower case | Fix the setting or file name |
| Change not visible | On main? Actions tab "pages build and deployment" green? | Merge, wait, hard refresh; purge Cloudflare cache if proxied |
| Custom domain broken | CNAME file present and holding DOMAIN? | Re-enter DOMAIN in repo Settings > Pages |
| DNS check fails | Records match section 2? | Fix records, wait up to 24 hours |
| Enforce HTTPS unavailable | Certificate still issuing? Cloudflare proxy on? | Wait up to 24 hours; set DNS only |
| ERR_TOO_MANY_REDIRECTS | Cloudflare encryption mode | Set Full (strict) |
| Email stopped arriving | MX or TXT records deleted, or not copied to Cloudflare | Restore from the user's pre-change screenshot or the email provider's setup page |
| Site and email down after a nameserver change | DNSSEC still on at the registrar? | Turn DNSSEC off at the registrar |
| Folder starting with _ missing | .nojekyll present? | Add .nojekyll |
| AI can't see REPO | Private repo without the Claude GitHub App? Codex repo access? | Install the app or grant access |
| Merge conflict | Two agents changed the same lines | Update the branch from main, resolve, push |

## 11. Limits of your environment
- Cloud sessions often block general web access, so you may not be able to open the live site.
  If so, ask the user to check it and tell you what they see.
- You can't see GitHub settings, DNS, Cloudflare or email. Ask for a screenshot when you need
  their state, and don't assume the Site values are still true if the user says otherwise.
- If you're unsure whether an action could break the live site, DNS or email, stop and ask.
