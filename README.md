# রেলখোঁজ — RailKhoj 🚆

**Live Bangladesh Railway train tracking, open for everyone.** RailKhoj estimates
any train's live position from Bangladesh Railway's timetable, draws it on a real
map, and gets sharper in real time as passengers tap **"I'm on this train"** —
no account, no cost, no app install.

> A community project in the spirit of trainkothai.com, built to go further:
> accurate schedule-interpolated positions, crowd-verified corrections, and a
> Bengali-first experience.

## Features

- **Live position engine** — interpolates each train's position along its real
  route corridor (rail-km polyline) from the timetable, in Asia/Dhaka time,
  including overnight runs and weekly off-days.
- **Community corrections (hybrid)** — passengers share one-tap GPS reports;
  the server validates them against the corridor geometry (rejects points
  >6 km off-route) and blends them into the train's delay offset with an EMA.
  Reports expire after 45 minutes and the engine falls back to the schedule.
- **Delay + ETA for every station** — scheduled vs live arrival/departure,
  journey progress %, current speed, next-stop ETA.
- **Safety alerts with community verification** — passengers report robbery,
  snatching, harassment, line problems, blockades and more; other passengers
  vote **true/false** and alerts earn verdicts (verified / doubtful /
  matches-news / unverified). High-severity alerts blink on train cards and
  the train page, and every panel carries the **999** emergency call button.
- **Rail news & forecast** — the server pulls Bangladesh rail headlines from
  Google News RSS every 15 minutes, classifies them (accident, blockade,
  line problem, crime, delay, crowding), maps them to rail corridors and
  shows the *possible impact on your journey*; matching headlines are
  attached to matching community alerts as evidence.
- **Route search** — "Dhaka → Chattogram today" style queries across all trains.
- **Station boards** — today's arrivals/departures for any station.
- **Beautiful, fast UX** — Bengali-first (বাংলা/EN toggle), dark mode, animated
  live map (Leaflet), mobile-first, installable PWA manifest.

## Project layout

```
bd-train-tracker/
├─ package.json            # root scripts (dev, install:all, build)
├─ server/                 # Node.js + Express REST API (ESM)
│  ├─ src/engine/geo.js       # corridor polyline builder, point-at-km, projection
│  ├─ src/engine/schedule.js  # timetable loader + live position engine
│  ├─ src/engine/reports.js   # crowd GPS report fusion (EMA offsets)
│  ├─ src/engine/alerts.js    # safety alerts + confirm/deny verification
│  ├─ src/engine/news.js      # Google News RSS → classified rail-risk feed
│  ├─ src/index.js            # REST API
│  └─ src/data/               # stations.json, corridors.json, trains.json
└─ web/                    # React + Vite + Tailwind + Leaflet frontend
```

## Quick start

```bash
npm install            # root (installs concurrently)
npm run install:all    # server + web dependencies
npm run dev            # API on :4000, web on :5173 (proxy /api → :4000)
```

Production build: `npm run build` (outputs to `web/dist`). Since v0.2 the API
server serves `web/dist` itself on the same origin, so production is **one
Node.js process**: `SITE_URL=https://your.domain NODE_ENV=production npm start`.
Full step-by-step hosting guide (VPS / cPanel / Render / Railway), security
checklist and SEO notes: **[HOSTING.md](HOSTING.md)**.

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Service + dataset stats |
| `GET /api/meta` | Stations, corridors, counts |
| `GET /api/trains` | All services with live status (sorted running→arrived) |
| `GET /api/trains/:id` | Full detail: stop-by-stop live times + route polyline |
| `GET /api/trains/:id/position` | Lightweight live position (poll-friendly) |
| `POST /api/trains/:id/reports` | `{lat,lng}` crowd GPS report → validated + fused |
| `GET /api/search?from=DHA&to=CHA` | Trains connecting two stations today |
| `GET /api/stations/:code/board` | Station arrival/departure board |

## How the engine works

1. **Corridors** — ordered station lists; straight legs become "rail km"
   (×1.15 winding factor) and a gentle sine curve for map rendering.
2. **Timetable** — each service stores origin departure + destination arrival;
   intermediate times are km-proportional, so `elapsed → km → lat/lng`.
3. **Live state** — `getLiveState()` finds the active run (today's or an
   overnight one), subtracts the current delay offset, and returns position,
   speed, progress, next stop and per-station ETAs.
4. **Delay fusion** — `delay = crowdOffset ?? simulatedDelay`. The simulated
   delay is a deterministic hash per train+day (0–31 min) so demos feel real;
   set `SIMULATE_DELAYS=false` for pure-schedule mode. Real crowd reports
   always take priority while fresh.

## ⚠️ Data disclaimer

`server/src/data/*.json` is a **seed dataset**: real train names/numbers and
realistic corridors, but times and stops are **approximate** and do not yet
cover the full BR network. Before any production use, replace it with the
official Bangladesh Railway timetable and OpenStreetMap rail geometry — the
schema is intentionally tiny (see comments in `schedule.js`).

## Roadmap

- Import official BR timetable + OSM rail line geometry for true accuracy
- Delay history per train (last 14 days) + journey alarms (web push)
- SMS fallback (16318-style), offline timetable cache (service worker)
- Moderation heuristics for crowd reports (speed sanity, duplicate filtering)

*Not affiliated with Bangladesh Railway. Times shown are estimates — always
confirm with official BR sources before travelling.*
