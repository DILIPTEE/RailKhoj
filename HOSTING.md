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


## Deploy to Render (works on the FREE plan)

One web service serves the API + the built frontend — **no disk needed**, so the Free plan works:

1. Push this repo to GitHub (root = the folder containing `package.json`, `server/`, `web/`).
2. Render → **New → Web Service** → pick the repo:
   - **Runtime:** `Node`
   - **Build Command:** `npm run build` (self-installing — it installs
     `server/` + `web/` dependencies first, including vite)
   - **Start Command:** `node server/src/index.js`
   - **Plan:** `Free` (upgrade to Starter for 24/7 — free sleeps after ~15 min idle)
3. Environment variables:
   - `NODE_ENV` = `production`
   - `SITE_URL` = `https://your-app.onrender.com` (used for canonical/OG links)
4. Health Check Path: `/api/health` → **Create Web Service**.

> ⚠️ **`sh: 1: vite: not found` (exit 127)?** The build didn't install `web/`
> dependencies. `npm run build` at the repo root is now self-installing, so
> this is fixed — as long as the LATEST commits are pushed to GitHub and the
> service's Build Command is `npm run build`. Note: never upload
> `node_modules/` to GitHub — Render installs it fresh (it is gitignored, and
> Windows-built binaries don't run on Render's Linux).

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