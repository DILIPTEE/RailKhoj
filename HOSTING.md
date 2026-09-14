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