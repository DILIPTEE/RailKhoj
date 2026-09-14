// RailKhoj REST API + production static hosting.
import express from "express";
import cors from "cors";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  STATIONS,
  CORRIDORS,
  TRAINS,
  trainById,
  stationByCode,
  dhakaNow,
  seededDelay,
  getLiveState,
  fmtHM,
} from "./engine/schedule.js";
import { getCrowdOffset, addReport, reportStats } from "./engine/reports.js";
import {
  ALERT_TYPES,
  listActive,
  addAlert,
  voteAlert,
  alertsForTrain,
  attachNewsMatches,
} from "./engine/alerts.js";
import { getNews } from "./engine/news.js";
import { projectToPolyline } from "./engine/geo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(__dirname, "..", "..", "web", "dist");
const HAS_WEB = fileExistsSync(path.join(WEB_DIST, "index.html"));
// Set SITE_URL https://your-domain.example in production for canonical links.
const SITE_URL = (process.env.SITE_URL || "https://railkhoj.example.com").replace(/\/+$/, "");

function fileExistsSync(p) {
  try {
    readFileSync(p);
    return true;
  } catch {
    return false;
  }
}

let INDEX_HTML = null;
if (HAS_WEB) {
  try {
    INDEX_HTML = readFileSync(path.join(WEB_DIST, "index.html"), "utf8");
  } catch {
    INDEX_HTML = null;
  }
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // behind nginx / cPanel proxy: honour X-Forwarded-For
app.use(cors());
app.use(express.json({ limit: "32kb" }));

// --- Security headers (dependency-free) -------------------------------------
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(self), camera=(), microphone=()");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: https://*.basemaps.cartocdn.com https://tile.openstreetmap.org",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.basemaps.cartocdn.com https://tile.openstreetmap.org",
      "script-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; ")
  );
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// --- Lightweight in-memory abuse protection ---------------------------------
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 12;
const rate = new Map(); // "ip|trainId" -> { n, start }
function rateOk(key, max = RATE_MAX) {
  const now = Date.now();
  const cur = rate.get(key);
  if (!cur || now - cur.start > RATE_WINDOW_MS) {
    rate.set(key, { n: 1, start: now });
    return true;
  }
  cur.n += 1;
  return cur.n <= max;
}
function reqKey(req) {
  return (req.ip || "?").replace(/[^0-9a-f.:]/g, "") + "|" + (req.params?.id ?? "-");
}
// Bucketed per-IP keys for the alert/vote endpoints.
function ipKey(req, bucket) {
  return (req.ip || "?").replace(/[^0-9a-f.:]/g, "") + "|" + bucket;
}
// Small stable per-IP hash for one-vote-per-visitor enforcement.
function ipHash(req) {
  const s = req.ip || "?";
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// "Position looks wrong" flags from passengers (auto-expire after 6h).
const flags = new Map(); // trainId -> { n, lastTs }
function flagOf(id) {
  const f = flags.get(id);
  if (!f) return null;
  if (Date.now() - f.lastTs > 6 * 3600 * 1000) {
    flags.delete(id);
    return null;
  }
  return { count: f.n, lastTs: f.lastTs };
}

const stationView = (code) => {
  const s = stationByCode.get(code);
  return { code, nameEn: s ? s.nameEn : code, nameBn: s ? s.nameBn : code };
};
const clock = (min) => fmtHM(min).time;

function liveOf(t, now) {
  const crowd = getCrowdOffset(t.id, now.ts);
  const delay = crowd == null ? seededDelay(t.id, now.dateStr) : crowd;
  const st = getLiveState(t, now, delay);
  return { crowd, delay, st };
}

function summary(t, now) {
  const { crowd, delay, st } = liveOf(t, now);
  const al = alertsForTrain(t);
  const top = al[0] || null;
  return {
    id: t.id,
    number: t.number,
    nameEn: t.nameEn,
    nameBn: t.nameBn,
    status: st.status,
    delayMin: st.delayMin,
    delaySource: crowd != null ? "crowd" : "schedule",
    progressPct: st.progressPct,
    origin: stationView(t.originCode),
    dest: stationView(t.destCode),
    originDep: clock(t.depClock),
    destArr: clock(t.destArrClock),
    nextStop: st.nextStop,
    prevStop: st.prevStop,
    nearStop: st.nearStop,
    atStation: st.atStation,
    positionSource: crowd != null ? "crowd" : "schedule",
    segment: st.segment,
    flags: flagOf(t.id),
    reports: reportStats(t.id),
    alertCount: al.length,
    alertSeverity: top ? top.severity : 0,
    topAlert: top
      ? {
          type: top.type,
          emoji: top.emoji,
          typeBn: top.typeBn,
          typeEn: top.typeEn,
          noteBn: top.noteBn || top.note,
          noteEn: top.noteEn || top.note,
        }
      : null,
    position:
      st.lat != null
        ? { lat: st.lat, lng: st.lng, speedKmh: st.speedKmh }
        : null,
    offDays: t.offDays,
  };
}

app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    trains: TRAINS.length,
    stations: STATIONS.length,
    corridors: CORRIDORS.size,
    time: new Date().toISOString(),
  })
);

app.get("/api/meta", (_req, res) => {
  res.json({
    stations: STATIONS,
    corridors: [...CORRIDORS.values()].map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameBn: c.nameBn,
      stationCodes: c.stations.map((s) => s.code),
    })),
    trainCount: TRAINS.length,
  });
});

app.get("/api/trains", (_req, res) => {
  const now = dhakaNow();
  const list = TRAINS.map((t) => summary(t, now));
  const rank = { running: 0, delayed: 1, upcoming: 2, arrived: 3 };
  list.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] || b.progressPct - a.progressPct
  );
  res.json({
    serverTime: new Date(now.ts).toISOString(),
    dhakaTime: now,
    trains: list,
  });
});

app.get("/api/trains/:id", async (req, res) => {
  const t = trainById.get(req.params.id);
  if (!t) return res.status(404).json({ error: "Train not found" });
  const now = dhakaNow();
  const news = await getNews().catch(() => ({ items: [], ok: false }));
  const { crowd, delay, st } = liveOf(t, now);
  const corridor = CORRIDORS.get(t.corridorId);
  const polyline = (t.reverse
    ? [...corridor.points].reverse()
    : corridor.points
  ).map((p) => [p.lat, p.lng]);

  const stops = t.stops.map((s) => {
    const passed =
      st.status === "arrived" ||
      (st.elapsedMin != null && st.elapsedMin > (s.elapsedDep ?? s.elapsedArr));
    return {
      ...stationView(s.code),
      km: Math.round(s.km),
      scheduled: {
        arr: clock(s.arrClock),
        dep: s.depClock == null ? null : clock(s.depClock),
      },
      live: {
        arr: clock(s.arrClock + delay),
        dep: s.depClock == null ? null : clock(s.depClock + delay),
      },
      state:
        st.status === "arrived"
          ? "passed"
          : passed
            ? "passed"
            : st.nextStop && st.nextStop.code === s.code
              ? "next"
              : "future",
    };
  });

  res.json({
    train: {
      id: t.id,
      number: t.number,
      nameEn: t.nameEn,
      nameBn: t.nameBn,
      offDays: t.offDays,
    },
    origin: stationView(t.originCode),
    dest: stationView(t.destCode),
    originDep: clock(t.depClock),
    destArr: clock(t.destArrClock),
    journeyMin: t.journeyMin,
    totalKm: Math.round(t.totalKm),
    avgSpeedKmh: Math.round(t.avgSpeed),
    live: {
      status: st.status,
      delayMin: delay,
      delaySource: crowd != null ? "crowd" : "schedule",
      progressPct: st.progressPct,
      position:
        st.lat != null
          ? { lat: st.lat, lng: st.lng, speedKmh: st.speedKmh }
          : null,
      nextStop: st.nextStop,
      prevStop: st.prevStop,
      nearStop: st.nearStop,
      atStation: st.atStation,
      positionSource: crowd != null ? "crowd" : "schedule",
      segment: st.segment,
      flags: flagOf(t.id),
      elapsedMin: st.elapsedMin ?? null,
      departsInMin: st.departsInMin ?? null,
      reports: reportStats(t.id),
    },
    alerts: attachNewsMatches(alertsForTrain(t), news.items),
    stops,
    polyline,
    dhakaTime: now,
  });
});

app.get("/api/trains/:id/position", (req, res) => {
  const t = trainById.get(req.params.id);
  if (!t) return res.status(404).json({ error: "Train not found" });
  const now = dhakaNow();
  const { crowd, delay, st } = liveOf(t, now);
  res.json({
    id: t.id,
    status: st.status,
    delayMin: delay,
    delaySource: crowd != null ? "crowd" : "schedule",
    progressPct: st.progressPct,
    position:
      st.lat != null
        ? { lat: st.lat, lng: st.lng, speedKmh: st.speedKmh }
        : null,
    nextStop: st.nextStop,
    prevStop: st.prevStop,
    atStation: st.atStation,
    positionSource: crowd != null ? "crowd" : "schedule",
    segment: st.segment,
    flags: flagOf(t.id),
    nearStop: st.nearStop,
    serverTime: new Date(now.ts).toISOString(),
  });
});

app.post("/api/trains/:id/reports", (req, res) => {
  const t = trainById.get(req.params.id);
  if (!t) return res.status(404).json({ error: "Train not found" });
  if (!rateOk(reqKey(req)))
    return res
      .status(429)
      .json({ accepted: false, reason: "Too many reports — try again later" });
  const { lat, lng } = req.body || {};
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return res
      .status(400)
      .json({ accepted: false, reason: "Invalid coordinates" });
  }
  const now = dhakaNow();
  const { st } = liveOf(t, now);
  if (st.status !== "running" && st.status !== "delayed") {
    return res.json({
      accepted: false,
      reason: "Train is not running right now",
    });
  }
  const corridor = CORRIDORS.get(t.corridorId);
  const proj = projectToPolyline(corridor.points, lat, lng);
  if (proj.dist > 6) {
    return res.json({
      accepted: false,
      reason: "Location is too far from the rail route",
      distanceKm: Math.round(proj.dist * 10) / 10,
    });
  }
  let travelKm = proj.km;
  if (t.reverse) travelKm = t.totalKm - travelKm;

  // Predict against the pure schedule (no crowd offset) so each report is an
  // independent estimate of (actual - schedule).
  const predicted = getLiveState(t, now, 0);
  const predictedKm = predicted.km ?? 0;
  const entry = addReport(
    t.id,
    predictedKm,
    travelKm,
    t.totalKm / t.journeyMin,
    now.ts
  );
  res.json({
    accepted: true,
    offsetMin: entry.offsetMin,
    reports: { count: entry.count, lastTs: entry.lastTs },
  });
});

// --- Safety alerts + rail news ----------------------------------------------
app.post("/api/trains/:id/flag", (req, res) => {
  const t = trainById.get(req.params.id);
  if (!t) return res.status(404).json({ error: "Train not found" });
  if (!rateOk(ipKey(req, "flags"), 5))
    return res
      .status(429)
      .json({ accepted: false, reason: "Too many flags — try again later" });
  const now = Date.now();
  const cur = flags.get(t.id);
  const entry =
    cur && now - cur.lastTs < 6 * 3600 * 1000
      ? { n: cur.n + 1, lastTs: now }
      : { n: 1, lastTs: now };
  flags.set(t.id, entry);
  res.json({ accepted: true, flags: { count: entry.n } });
});

app.get("/api/alerts", async (req, res) => {
  const news = await getNews().catch(() => ({ items: [], ok: false }));
  let list = listActive();
  const trainId = req.query.trainId ? String(req.query.trainId) : null;
  const corridorId = req.query.corridorId ? String(req.query.corridorId) : null;
  if (trainId) {
    const t = trainById.get(trainId);
    const cid = t ? t.corridorId : corridorId;
    list = list.filter(
      (a) =>
        a.trainId === trainId ||
        (cid && a.corridorId && a.corridorId === cid)
    );
  } else if (corridorId) {
    list = list.filter((a) => a.corridorId === corridorId);
  }
  res.json({
    alerts: attachNewsMatches(list, news.items),
    newsOk: news.ok,
    serverTime: new Date().toISOString(),
  });
});

app.post("/api/alerts", (req, res) => {
  if (!rateOk(ipKey(req, "alerts"), 8))
    return res
      .status(429)
      .json({ accepted: false, reason: "Too many reports — try again later" });
  const b = req.body || {};
  const type = String(b.type || "");
  if (!ALERT_TYPES[type])
    return res.status(400).json({ accepted: false, reason: "Unknown alert type" });
  const note = String(b.note || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (note.length < 10 || note.length > 400)
    return res.status(400).json({
      accepted: false,
      reason: "Note must be 10-400 characters",
    });
  let trainId = null;
  let corridorId = null;
  let stationCode = null;
  if (b.trainId) {
    const t = trainById.get(String(b.trainId));
    if (!t)
      return res.status(400).json({ accepted: false, reason: "Unknown train" });
    trainId = t.id;
    corridorId = t.corridorId;
  }
  if (!corridorId && b.corridorId && CORRIDORS.has(String(b.corridorId)))
    corridorId = String(b.corridorId);
  if (b.stationCode) {
    const s = stationByCode.get(String(b.stationCode).toUpperCase());
    if (!s)
      return res
        .status(400)
        .json({ accepted: false, reason: "Unknown station" });
    stationCode = s.code;
  }
  if (!trainId && !corridorId && !stationCode)
    return res.status(400).json({
      accepted: false,
      reason: "Attach the alert to a train, route or station",
    });
  const alert = addAlert({ type, note, trainId, corridorId, stationCode });
  res.json({ accepted: true, alert });
});

app.post("/api/alerts/:id/vote", (req, res) => {
  if (!rateOk(ipKey(req, "votes"), 40))
    return res
      .status(429)
      .json({ accepted: false, reason: "Too many votes — slow down" });
  const vote = String((req.body || {}).vote || "");
  if (vote !== "confirm" && vote !== "deny")
    return res
      .status(400)
      .json({ accepted: false, reason: "vote must be confirm|deny" });
  const r = voteAlert(req.params.id, vote, ipHash(req));
  if (!r)
    return res.status(404).json({
      accepted: false,
      reason: "Alert not found or not votable",
    });
  res.json({ accepted: true, alreadyVoted: r.alreadyVoted, alert: r.alert });
});

app.get("/api/news", async (_req, res) => {
  const news = await getNews().catch(() => ({ items: [], ok: false }));
  res.json({ ok: news.ok, items: news.items, serverTime: new Date().toISOString() });
});

app.get("/api/search", (req, res) => {
  const from = String(req.query.from || "").toUpperCase();
  const to = String(req.query.to || "").toUpperCase();
  if (!from || !to)
    return res.status(400).json({ error: "from & to are required" });
  if (from === to)
    return res.status(400).json({ error: "from & to must differ" });
  const now = dhakaNow();
  const results = [];
  for (const t of TRAINS) {
    const i = t.stops.findIndex((s) => s.code === from);
    if (i < 0) continue;
    const j = t.stops.findIndex((s, idx) => idx > i && s.code === to);
    if (j < 0) continue;
    const { delay, st } = liveOf(t, now);
    results.push({
      id: t.id,
      number: t.number,
      nameEn: t.nameEn,
      nameBn: t.nameBn,
      from: stationView(from),
      to: stationView(to),
      dep: clock(t.stops[i].depClock ?? t.stops[i].arrClock),
      arr: clock(t.stops[j].arrClock),
      depLive: clock((t.stops[i].depClock ?? t.stops[i].arrClock) + delay),
      arrLive: clock(t.stops[j].arrClock + delay),
      durationMin: t.stops[j].elapsedArr - (t.stops[i].elapsedDep ?? 0),
      status: st.status,
      delayMin: delay,
      offDays: t.offDays,
    });
  }
  results.sort((a, b) => a.dep.localeCompare(b.dep));
  res.json({ from: stationView(from), to: stationView(to), results });
});

app.get("/api/stations/:code/board", (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  const s = stationByCode.get(code);
  if (!s) return res.status(404).json({ error: "Station not found" });
  const now = dhakaNow();
  const rows = [];
  for (const t of TRAINS) {
    const idx = t.stops.findIndex((x) => x.code === code);
    if (idx < 0) continue;
    const { delay, st } = liveOf(t, now);
    const stop = t.stops[idx];
    rows.push({
      trainId: t.id,
      number: t.number,
      nameEn: t.nameEn,
      nameBn: t.nameBn,
      scheduledArr: clock(stop.arrClock),
      scheduledDep: stop.depClock == null ? null : clock(stop.depClock),
      liveArr: clock(stop.arrClock + delay),
      liveDep: stop.depClock == null ? null : clock(stop.depClock + delay),
      status: st.status,
      delayMin: delay,
      from: stationView(t.originCode),
      to: stationView(t.destCode),
    });
  }
  rows.sort((a, b) =>
    (a.scheduledDep ?? a.scheduledArr).localeCompare(
      b.scheduledDep ?? b.scheduledArr
    )
  );
  res.json({ station: s, rows });
});

// --- Production static hosting (serve the built web app, single origin) -----
// Requires `npm run build` first (creates web/dist). With the SPA served by the
// API itself there is no CORS config, no separate static host, and /api keeps
// working on the same origin. Safe to run in dev too — /api is never touched.
if (HAS_WEB && INDEX_HTML) {
  app.use(express.static(WEB_DIST, { maxAge: "1h", index: "index.html" }));

  // SPA fallback with light SEO meta injection for train detail pages.
  const SPA_RE = /^\/train\/([A-Za-z0-9_-]+)\/?$/;

  // Swap the content= of a <meta ...> tag identified by `name=` or
  // `property=` regardless of how the attributes wrap across lines.
  const swapMeta = (html, attr, value) => {
    const re = new RegExp(`<meta[^>]*?${attr}[^>]*?content="[^"]*"[^>]*>`);
    return html.replace(
      re,
      (tag) => tag.replace(/content="[^"]*"/, `content="${value}"`)
    );
  };

  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if ((req.url ?? req.path ?? "").startsWith("/api")) return next();

    const p = (req.url ?? req.path ?? "").split("?")[0];
    const m = p.match(SPA_RE);
    let html = INDEX_HTML;
    if (m && m[1]) {
      const t = trainById.get(m[1]);
      if (t) {
        const s1 = stationByCode.get(t.originCode);
        const s2 = stationByCode.get(t.destCode);
        const title = `${t.number} ${t.nameEn} — RailKhoj`;
        const desc = `Live position, delay & ETA for ${t.number} ${t.nameEn} (${s1?.nameEn ?? t.originCode} → ${s2?.nameEn ?? t.destCode}).`;
        const url = `${SITE_URL}/train/${t.id}`;
        html = swapMeta(INDEX_HTML, 'name="description"', desc);
        html = swapMeta(html, 'property="og:title"', title).replace(
          /\<title\>.*?\<\/title\>/,
          `<title>${title}</title>`
        );
        html = swapMeta(html, 'property="og:description"', desc);
        html = swapMeta(html, 'property="og:url"', url);
        html = html.replace(
          /(rel="canonical"[\s\S]*?href=")[^"]*"/,
          `$1${url}"`
        );
      }
    }
    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "no-cache");
    res.send(html);
  });
}

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(
    `RailKhoj listening on http://localhost:${PORT}${
      HAS_WEB ? " (API + web)" : " (API only)"
    }`
  )
);


