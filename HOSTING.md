# 🚀 RailKhoj — Production Hosting Guide

This app is **two things in one**:
- a **Node.js + Express API** (live train engine, port 4000)
- a **React (Vite) frontend** — built to static files in `web/dist`

Since v0.2 the API server **also serves the built frontend** (same origin), which
means you only need *one* always-on Node.js process in production. No CORS
setup, no separate static host, no `/api` URL config.

---

## 1. Build once on the server

```bash
npm install --prefix server --no-audit --no-fund
npm install --prefix web --no-audit --no-fund
npm run build            # creates web/dist
npm run sitemap -- --domain https://YOUR-DOMAIN   # optional, SEO
```

Then start:

```bash
SITE_URL=https://YOUR-DOMAIN NODE_ENV=production PORT=4000 npm start
```

- `SITE_URL` → used for SEO canonical / og:url links (default is a placeholder,
  always set it in production).
- `NODE_ENV=production` → enables HSTS security header over HTTPS.
- `SIMULATE_DELAYS=false` → optional; disables the demo's fake delay so trains
  run exactly on schedule until real crowd reports arrive.

> `web/dist` is **ignored by git** (see `.gitignore`), so always run
> `npm run build` on the server, or in CI before deploy.

---

## 2. Where to host — compare your options

| Host type | Works? | Effort | Best for | Notes |
| --- | --- | --- | --- | --- |
| **VPS** (DigitalOcean, Linode, Hetzner, Vultr, Hostinger VPS) | ✅ Yes | Medium | Full control, Nginx + SSL, growth | Recommended |
| **cPanel shared hosting with Node.js app support** (Hostinger, Namecheap, A2, GreenGeeks) | ✅ Yes | Low-Medium | Cheap, cPanel-managed | Only works if the plan includes the Node.js app manager |
| **PaaS** — Render / Railway / Fly.io / Koyeb | ✅ Yes | Low | Auto-deploy from Git, auto-SSL, auto-restart | Easiest to run |
| **cPanel/PHP-only shared hosting** | ❌ API won't run | — | Static HTML only | Do NOT buy this |
| **Vercel / Netlify** | ⚠️ Partial | Medium | Frontend only | API needs a separate host or a rewrite; not recommended here |

**Recommendation:** If you already have (or can buy cheaply) cPanel hosting that
ships a **Node.js app manager** (cPanel's "Setup Node.js app" / Application
Manager), that is the lowest-cost path. Otherwise pick a small **VPS
($4–6/month: 1 GB RAM is plenty)** or **Render/Railway** if you want the least
ops.

---

### Option A — VPS (recommended, full control)

1. Provision a $5 server (Ubuntu 22.04/24.04 LTS, 1 GB RAM).
2. Install Node 20+ (LTS), Nginx, and a process manager:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs nginx
sudo npm install -g pm2
```

3. Upload/copy the project to `/opt/railkhoj` (git clone works great).
4. Build + start as a service:

```bash
cd /opt/railkhoj
npm install --prefix server --no-audit --no-fund
npm install --prefix web --no-audit --no-fund
npm run build
SITE_URL=https://YOUR-DOMAIN NODE_ENV=production pm2 start server/src/index.js --name railkhoj
pm2 save && pm2 startup
```

5. Reverse-proxy Nginx (`/etc/nginx/sites-available/railkhoj`):

```nginx
server {
    listen 80;
    server_name YOUR-DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

6. Enable SSL in seconds with Let's Encrypt:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR-DOMAIN
```

### Option B — cPanel shared hosting (with Node.js app manager)

1. Sign up for a cPanel host that offers **Node.js apps** (not PHP-only).
   Hostinger *shared + Node* or Namecheap *cPanel + Node* are common cheap picks.
2. cPanel → **Setup Node.js App** / **Application Manager**:
   - Path: the folder you uploaded the project to (e.g. `railkhoj`)
   - Application root: `/` , Run from: the project root
   - Startup file / entry point: `server/src/index.js`
   - Environment variables: `PORT` (cPanel assigns it), `SITE_URL=https://YOUR-DOMAIN`,
     `NODE_ENV=production`
3. Enable **HTTPS** in cPanel (AutoSSL / Let's Encrypt) so the browser
   geolocation button works (`navigator.geolocation` requires HTTPS).
4. cPanel will route your domain to the Node app automatically. Restart the app
   after **every** `npm run build` change.

### Option C — Render / Railway (least ops)

- **Render**: create a **Web Service** → root dir = repo → Start command
  `npm start` (which runs `node server/src/index.js`) → build command
  `npm run build`. Add env vars `SITE_URL`, `NODE_ENV=production`. Turn on the
  free auto-SSL. Render's disk is read-only except `/tmp`/`/var/data` — fine,
  since `web/dist` is built during deploy.
- **Railway**: similar — deploy the repo, set `NODE_ENV=production`,
  `SITE_URL`, and let Railway pick a public domain.
---

## 3. 🔒 Security — what's already done (v0.2)

- **Security headers** on every response: `Content-Security-Policy`,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
  `Referrer-Policy`, `Permissions-Policy` (geolocation allowed for the
  "I'm on this train" button only), and `Strict-Transport-Security` when
  `NODE_ENV=production`. (Equivalent to `helmet` with zero extra packages.)
- **HTTPS required for the GPS button** — the app already degrades gracefully
  (shows "Report not accepted") on plain HTTP, so always serve over HTTPS.
- **Rate limiting** on `POST /api/trains/:id/reports` (12 posts / 10 min per
  IP+train) → prevents report spam. Returns HTTP 429.
- **Input validation**: report lat/lng bounds-checked, body size capped at 32 KB.
- `x-powered-by` header disabled; generic 404/500 JSON (no stack traces leaked).
- **CSP** is tuned to allow only: self, CARTO/OSM map tiles, Google Fonts.
- **No credentials stored**, **no cookies**, **no database** — the in-memory
  report store restarts empty. There is nothing to steal or leak.

### Things to do on your host too

- Keep packages updated: `npm audit` after `npm install`.
- VPS only: enable **UFW** (`ufw allow 22,80,443`), and consider fail2ban for SSH.
- cPanel: enable **AutoSSL/Let's Encrypt** and keep the Node app on the newest
  Node LTS the host offers.
- Put **Cloudflare in front** (free) for DDoS protection + faster static
  caching — but do **not** cache `/api/*` (server responses are live data).

---

## 4. 🔎 SEO — status and how to go further

**Honest answer:** this is a **React single-page app**, so out of the box deep
pages are JS-rendered. Search engines *can* index the home page, but train
detail pages need help. v0.2 ships the following SEO groundwork:

| Item | Status |
| --- | --- |
| `title` / `description` per page | ✅ Home + per-train via server-side injection |
| Open Graph + Twitter cards (link previews on FB/X/WhatsApp) | ✅ |
| `canonical` URL per page | ✅ (train pages point to `/train/:id`) |
| JSON-LD `WebSite` structured data | ✅ (in `index.html`) |
| `robots.txt` | ✅ (in `web/public/robots.txt`) |
| `sitemap.xml` (129 URLs) | ✅ generated by `npm run sitemap -- --domain ...` |
| `og:image` | ⚠️ uses `/icon.svg` — replace with a real 1200×630 PNG banner |
| Real per-train description text (e.g. stops list) | 🟡 current is short auto-text |

**To get real SEO traction:**
1. Set a real `SITE_URL` and regenerate the sitemap before each deploy:
   `npm run sitemap -- --domain https://YOUR-DOMAIN && npm run build`.
2. Submit the sitemap in **Google Search Console** + **Bing Webmaster Tools**.
3. Replace `icon.svg` with a real social share image for `og:image`.
4. If you want full SSR-grade SEO later, options are: add `prerender.io`, or
   generate a static snapshot of the key pages (`/train/:id`) at build time —
   the engine data is static JSON, so this is very feasible.

**Remember:** live position content is inherently transient, so most of your
organic traffic will come from landing pages (train names, routes, station
names) — which is exactly what the sitemap + injected titles cover.

---

## 5. ✅ Checklist before going live

- [ ] `npm run build` succeeded and `web/dist/index.html` exists in the repo folder
- [ ] Node app run from project root: `node server/src/index.js`
- [ ] `PORT`, `SITE_URL=https://YOUR-DOMAIN`, `NODE_ENV=production` are set
- [ ] HTTPS is active (cPanel AutoSSL, certbot, or PaaS auto-SSL)
- [ ] `https://YOUR-DOMAIN/api/health` returns `{"ok":true,...}`
- [ ] `https://YOUR-DOMAIN/` loads the map with running trains
- [ ] `https://YOUR-DOMAIN/train/704` shows injected SEO title
- [ ] `https://YOUR-DOMAIN/robots.txt` and `/sitemap.xml` return 200
- [ ] Security headers visible (DevTools → Network → response headers)
- [ ] Backup plan: git repo + `server/src/data/*.json` are your whole dataset —
    push to a private GitHub repo and your "database" is backed up

---

## Common problems

| Symptom | Fix |
| --- | --- |
| `npm start` says "listening (API only)" | `web/dist` is missing — run `npm run build` |
| 502 from Nginx/cPanel | Node app crashed — check `pm2 logs` or cPanel error log; likely a port/env issue |
| Map shows no tiles | Browser has no internet or CSP blocks tiles — check console |
| "I'm on this train" never works | Site is on **HTTP** — the Geolocation API requires HTTPS |
| Trains all say "arrived" | Server clock vs Dhaka time — everything runs on Asia/Dhaka; check `GET /api/health` time |
| Reports disappear after restart | By design — reports are in-memory; cleared on restart |

*Not affiliated with Bangladesh Railway. Times shown are estimates.*