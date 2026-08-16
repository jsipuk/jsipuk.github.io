# Invent Together - production static bundle

Live at <https://jsip.uk/invent-together/>.

## Privacy model
- No LLM or AI integration.
- No API calls.
- No database.
- No cookies, analytics, trackers or third-party scripts.
- No localStorage/sessionStorage.
- Form answers remain in the page memory on the current device.
- Generate formats the entered text locally.
- Copy uses the device clipboard.
- Save as text creates a local file.
- Share sends only the page URL and fixed page description, not form answers.

## How this is deployed here
This is a static bundle served from a subdirectory of the GitHub Pages site
`jsipuk/jsipuk.github.io`, so a few things differ from the original root-level bundle:

- Asset paths (`styles.css`, `app.js`, `inventor-icon.png`, `site.webmanifest`) are
  relative rather than root-absolute, so they resolve inside `/invent-together/`.
- Open Graph and Twitter image URLs are absolute (`https://jsip.uk/invent-together/...`),
  which is what Messages/WhatsApp previews need.
- `site.webmanifest` has `start_url` and `scope` set to `/invent-together/`.
- The bundle's `robots.txt` was dropped. `robots.txt` is only honoured at the site
  root, so shipping it here would do nothing, and putting it at the root would
  de-index the whole of jsip.uk. `<meta name="robots" content="noindex, nofollow">`
  in `index.html` does the per-page job instead.

## Security headers
GitHub Pages does not support custom response headers, so `_headers`
(Cloudflare Pages / Netlify) and `vercel.json` are **inert here**. They are kept so
the bundle stays portable to a host that honours them.

What is actually enforced on this deployment is the `Content-Security-Policy`
`<meta>` tag in `index.html`, which covers the same policy apart from the
directives a meta tag cannot express — `frame-ancestors` (clickjacking) and
`X-Frame-Options` — plus `Referrer-Policy` and `Permissions-Policy`.

If those matter, host this bundle on Cloudflare Pages, Netlify or Vercel at its own
root, for example `https://invent.example.com/`, where `_headers` / `vercel.json`
apply unchanged.

## Main site warning
If you insert this page into an existing website framework that automatically injects
analytics, pixels, tag managers, chat widgets or session-recording scripts, the privacy
claim may no longer be accurate. jsip.uk itself loads no third-party scripts, so the
claim holds for this deployment.
