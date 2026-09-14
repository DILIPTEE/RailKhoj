// RailKhoj schedule + live-position engine.
//
// Core idea: every train service has a stop list (origin dep time, destination
// arrival time). Intermediate stop times are filled by distance-proportional
// interpolation over the corridor's "rail km", and the train's live position
// is interpolated along the corridor polyline from the schedule. A deterministic
// "simulated" delay makes the app feel real until community GPS reports
// replace it (see reports.js). Set SIMULATE_DELAYS=false for pure schedule.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildCorridor, pointAtKm } from "./geo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const load = (f) =>
  JSON.parse(readFileSync(path.join(__dirname, "..", "data", f), "utf8"));

export const STATIONS = load("stations.json");
export const CORRIDORS_RAW = load("corridors.json");
export const TRAINS_RAW = load("trains.json");

export const stationByCode = new Map(STATIONS.map((s) => [s.code, s]));

export const CORRIDORS = new Map(
  CORRIDORS_RAW.map((c) => {
    const stations = c.stations.map((code) => {
      const s = stationByCode.get(code);
      if (!s) throw new Error(`Unknown station "${code}" in corridor ${c.id}`);
      return s;
    });
    return [c.id, { ...c, stations, ...buildCorridor(stations) }];
  })
);

export const parseHM = (hm) => {
  const [h, m] = String(hm).split(":").map(Number);
  return h * 60 + m;
};

export function fmtHM(min) {
  const dayOffset = Math.floor(min / 1440);
  const norm = Math.round(((min % 1440) + 1440) % 1440);
  // Guard against rounding producing exactly 1440 (e.g. 23:59:59.9)
  const clamped = norm === 1440 ? 0 : norm;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return {
    time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    dayOffset: dayOffset + (norm === 1440 ? 1 : 0),
  };
}

// Stop-list compact format: "DHK*07:45|NSD|BMB|CTG#13:35"
//   * = origin departure, # = destination arrival, plain = intermediate stop.
function decodeStops(spec) {
  return String(spec)
    .split("|")
    .map((raw) => {
      const kind = raw.includes("*") ? "dep" : raw.includes("#") ? "arr" : "mid";
      const body = raw.replace(/[*#]/g, "");
      const m = body.match(/^([A-Z]+?)(\d{2}:\d{2})?$/);
      if (!m) throw new Error(`Bad stop token "${raw}"`);
      return { code: m[1], kind, time: m[2] ?? null };
    });
}

const DWELL_MIN = 2;
const DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const dayBefore = (d) => DAYS[(DAYS.indexOf(d) + 6) % 7];
const runsOnDay = (t, dayName) => !(t.offDays || []).includes(dayName);

export const TRAINS = TRAINS_RAW.map((t) => {
  const corridor = CORRIDORS.get(t.corridor);
  if (!corridor) throw new Error(`Unknown corridor "${t.corridor}" on train ${t.id}`);

  const kmByCode = new Map(
    [...corridor.stationKm.entries()].map(([code, km]) => [
      code,
      t.reverse ? corridor.totalKm - km : km,
    ])
  );

  const decoded = decodeStops(t.stops);
  const depClock = parseHM(decoded[0].time);
  const destArrClock = parseHM(decoded[decoded.length - 1].time);
  const journeyMin = (destArrClock - depClock + 1440) % 1440 || 1440;
  const totalKm = corridor.totalKm;

  const stops = decoded.map((d) => {
    const km = kmByCode.get(d.code);
    if (km === undefined) {
      throw new Error(`Train ${t.id}: station ${d.code} is not on corridor ${t.corridor}`);
    }
    return { code: d.code, km };
  });
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].km <= stops[i - 1].km) {
      throw new Error(`Train ${t.id}: non-monotonic km at ${stops[i].code}`);
    }
  }

  // Stop times: explicit times in the stop spec (e.g. "JOYD08:35") anchor the
  // timetable to the official BR schedule; gaps between anchors are filled
  // distance-proportionally. Trains pause DWELL_MIN at every halt.
  const arrMin = new Array(stops.length);
  const anchorIdx = [];
  decoded.forEach((d, i) => {
    if (i === 0) {
      arrMin[i] = 0;
      anchorIdx.push(i);
    } else if (i === stops.length - 1) {
      arrMin[i] = journeyMin;
      anchorIdx.push(i);
    } else if (d.time) {
      arrMin[i] = (parseHM(d.time) - depClock + 1440) % 1440;
      anchorIdx.push(i);
    }
  });
  for (let a = 0; a < anchorIdx.length - 1; a++) {
    const i0 = anchorIdx[a];
    const i1 = anchorIdx[a + 1];
    const km0 = stops[i0].km;
    const km1 = stops[i1].km;
    for (let j = i0 + 1; j < i1; j++) {
      arrMin[j] =
        arrMin[i0] +
        ((stops[j].km - km0) / Math.max(0.1, km1 - km0)) *
          (arrMin[i1] - arrMin[i0]);
    }
  }
  stops.forEach((st, i) => {
    st.elapsedArr = arrMin[i];
    st.elapsedDep = i === 0 ? 0 : st.elapsedArr + DWELL_MIN;
    st.arrClock = depClock + st.elapsedArr;
    st.depClock = i === stops.length - 1 ? null : depClock + st.elapsedDep;
  });
  for (let i = 0; i < stops.length - 1; i++) {
    if (stops[i].elapsedDep >= stops[i + 1].elapsedArr) {
      stops[i].elapsedDep = stops[i + 1].elapsedArr - 1;
    }
  }

  return {
    id: t.id,
    number: t.number ?? t.id,
    nameEn: t.nameEn,
    nameBn: t.nameBn,
    corridorId: t.corridor,
    reverse: !!t.reverse,
    offDays: t.off ?? [],
    stops,
    originCode: stops[0].code,
    destCode: stops[stops.length - 1].code,
    depClock,
    destArrClock,
    journeyMin,
    totalKm,
    avgSpeed: totalKm / (journeyMin / 60),
  };
});

export const trainById = new Map(TRAINS.map((t) => [t.id, t]));

const DHAKA_OFFSET_MIN = 360; // UTC+6 — Bangladesh has no DST

export function dhakaNow(date = new Date()) {
  const shifted = new Date(date.getTime() + DHAKA_OFFSET_MIN * 60000);
  return {
    ts: date.getTime(),
    // Fractional minutes (incl. seconds) so live positions sweep smoothly
    // between whole clock-minutes instead of freezing for up to 60s.
    min:
      shifted.getUTCHours() * 60 +
      shifted.getUTCMinutes() +
      shifted.getUTCSeconds() / 60,
    dayName: DAYS[shifted.getUTCDay()],
    dateStr: shifted.toISOString().slice(0, 10),
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic pseudo-delay (0–31 min) so the demo feels live. */
export function seededDelay(trainId, dateStr) {
  if (process.env.SIMULATE_DELAYS === "true")
    return hashStr(trainId + "|" + dateStr) % 32;
  return 0;
}

function stopView(t, st, elapsedMin, delay, kmNow = null) {
  const s = stationByCode.get(st.code);
  return {
    code: st.code,
    nameEn: s ? s.nameEn : st.code,
    nameBn: s ? s.nameBn : st.code,
    scheduledEta: fmtHM(st.arrClock).time,
    eta: fmtHM(st.arrClock + delay).time,
    etaInMin: Math.max(0, st.elapsedArr - (elapsedMin ?? 0)),
    // Along-track km still to cover until this stop (Google-Maps style
    // "12.3 km away"). null when the train position is unknown.
    kmAway:
      kmNow == null
        ? null
        : Math.max(0, Math.round((st.km - kmNow) * 10) / 10),
  };
}

function segmentSpeed(t, elapsed) {
  const s = t.stops;
  for (let i = 0; i < s.length - 1; i++) {
    if (elapsed >= s[i].elapsedDep && elapsed <= s[i + 1].elapsedArr) {
      const mins = s[i + 1].elapsedArr - s[i].elapsedDep;
      if (mins > 0) {
        const kmh = ((s[i + 1].km - s[i].km) / mins) * 60;
        // Cap at a realistic Bangladesh Railway maximum (~100 km/h) — if the
        // timetable data ever implies more, the train is not actually flying.
        return Math.min(100, Math.round(kmh));
      }
    }
  }
  return Math.min(100, Math.round(t.avgSpeed));
}

/** Along-track km for a given elapsed minute (piecewise, honours dwells). */
export function kmAt(t, elapsed) {
  const s = t.stops;
  if (elapsed <= 0) return 0;
  if (elapsed >= t.journeyMin) return t.totalKm;
  for (let i = 0; i < s.length - 1; i++) {
    if (elapsed >= s[i].elapsedDep && elapsed < s[i + 1].elapsedArr) {
      const mins = s[i + 1].elapsedArr - s[i].elapsedDep;
      const f = mins > 0 ? (elapsed - s[i].elapsedDep) / mins : 1;
      return s[i].km + f * (s[i + 1].km - s[i].km);
    }
  }
  for (const st of s) {
    if (elapsed >= st.elapsedArr && elapsed < st.elapsedDep) return st.km;
  }
  return (elapsed / t.journeyMin) * t.totalKm;
}

/** The stop the train is currently halted at (dwell window), if any. */
export function stationAt(t, elapsed) {
  for (const st of t.stops) {
    if (st.elapsedDep > st.elapsedArr && elapsed >= st.elapsedArr && elapsed < st.elapsedDep)
      return st;
  }
  return null;
}

function stationPos(code) {
  const s = stationByCode.get(code);
  return { lat: s.lat, lng: s.lng };
}

function stopName(code) {
  const s = stationByCode.get(code);
  return { code, nameEn: s ? s.nameEn : code, nameBn: s ? s.nameBn : code };
}

/**
 * Compute the live state of a train at Dhaka time `now`.
 * delayMin: minutes behind schedule (crowd offset when available, else seeded).
 */
export function getLiveState(t, now = dhakaNow(), delayMin = null) {
  const d = delayMin ?? seededDelay(t.id, now.dateStr);
  const corridor = CORRIDORS.get(t.corridorId);
  const J = t.journeyMin;
  const todayRuns = runsOnDay(t, now.dayName);
  const yesterdayRuns = runsOnDay(t, dayBefore(now.dayName));

  // Find the active scheduled run (today's, or yesterday's overnight run).
  let elapsedSched = null;
  if (
    todayRuns &&
    now.min >= t.depClock &&
    (t.depClock + J >= 1440 || now.min <= t.depClock + J)
  ) {
    elapsedSched = now.min - t.depClock;
  } else if (yesterdayRuns && now.min + 1440 <= t.depClock + J) {
    elapsedSched = now.min + 1440 - t.depClock;
  }

  if (elapsedSched === null) {
    if (todayRuns && now.min < t.depClock) {
      const origin = stationPos(t.originCode);
      return {
        status: "upcoming",
        delayMin: d,
        progressPct: 0,
        km: 0,
        lat: origin.lat,
        lng: origin.lng,
        speedKmh: null,
        elapsedMin: null,
        departsInMin: t.depClock - now.min,
        nextStop: stopView(
          t,
          t.stops[1] ?? t.stops[0],
          -(t.depClock - now.min),
          d,
          0
        ),
        prevStop: null,
        nearStop: null,
        segment: null,
      };
    }
    const dest = stationPos(t.destCode);
    return {
      status: "arrived",
      delayMin: d,
      progressPct: 100,
      km: t.totalKm,
      lat: dest.lat,
      lng: dest.lng,
      speedKmh: null,
      elapsedMin: null,
      nextStop: null,
      prevStop: null,
      nearStop: null,
      segment: null,
    };
  }

  const elapsed = Math.max(0, elapsedSched - d);
  if (elapsed >= J) {
    const dest = stationPos(t.destCode);
    return {
      status: "arrived",
      delayMin: d,
      progressPct: 100,
      km: t.totalKm,
      lat: dest.lat,
      lng: dest.lng,
      speedKmh: null,
      elapsedMin: null,
      nextStop: null,
      prevStop: null,
      nearStop: null,
      segment: null,
    };
  }

  const km = kmAt(t, elapsed);
  const halt = stationAt(t, elapsed);
  const corridorKm = t.reverse ? t.totalKm - km : km;
  const pos = pointAtKm(corridor.points, corridorKm);
  const next = t.stops.find((s) => s.elapsedArr > elapsed) ?? null;

  // Station the train last departed/passed — the "coming from" side of the
  // current segment (Google-Maps navigation style).
  let prev = null;
  for (const s of t.stops) {
    if (elapsed >= s.elapsedDep) prev = s;
    else break;
  }
  let prevStop = null;
  if (prev) {
    const ps = stationByCode.get(prev.code);
    prevStop = {
      code: prev.code,
      nameEn: ps ? ps.nameEn : prev.code,
      nameBn: ps ? ps.nameBn : prev.code,
      dep: prev.depClock == null ? null : fmtHM(prev.depClock + d).time,
      depMinAgo: Math.max(0, Math.round(elapsed - prev.elapsedDep)),
    };
  }
  // While dwelling, the "last station" is the one we're standing at — the
  // train has arrived there and is waiting to depart.
  if (halt) {
    const hs = stationByCode.get(halt.code);
    prevStop = {
      code: halt.code,
      nameEn: hs ? hs.nameEn : halt.code,
      nameBn: hs ? hs.nameBn : halt.code,
      dep: null,
      depMinAgo: Math.max(0, Math.round(elapsed - halt.elapsedArr)),
    };
  }

  // Nearest station along the track right now (any corridor station,
  // whether the train halts there or not).
  let nearCode = null;
  let nearDist = Infinity;
  for (const [code, sKm] of corridor.stationKm.entries()) {
    const dist = Math.abs(sKm - corridorKm);
    if (dist < nearDist) {
      nearDist = dist;
      nearCode = code;
    }
  }
  const ns = nearCode ? stationByCode.get(nearCode) : null;

  // Google-Maps-style current segment: from the last departed (or currently
  // occupied) station to the next stop — distance done vs remaining.
  const anchor = halt || prev;
  const segment =
    next && anchor
      ? {
          from: stopName(anchor.code),
          to: stopName(next.code),
          legKm: Math.round((next.km - anchor.km) * 10) / 10,
          doneKm: Math.max(0, Math.round((km - anchor.km) * 10) / 10),
          kmAway: Math.max(0, Math.round((next.km - km) * 10) / 10),
          etaInMin: Math.max(0, Math.round(next.elapsedArr - elapsed)),
        }
      : null;

  return {
    status: elapsedSched - d < 0 ? "delayed" : "running",
    delayMin: d,
    progressPct: Math.min(100, Math.round((km / t.totalKm) * 100)),
    km: Math.round(km * 10) / 10,
    lat: pos.lat,
    lng: pos.lng,
    speedKmh: halt ? 0 : segmentSpeed(t, elapsed),
    elapsedMin: Math.round(elapsed),
    nextStop: next ? stopView(t, next, elapsed, d, km) : null,
    prevStop,
    nearStop: ns
      ? {
          code: ns.code,
          nameEn: ns.nameEn,
          nameBn: ns.nameBn,
          kmAway: Math.round(nearDist * 10) / 10,
        }
      : null,
    atStation: halt
      ? {
          code: halt.code,
          nameEn: (stationByCode.get(halt.code) || {}).nameEn || halt.code,
          nameBn: (stationByCode.get(halt.code) || {}).nameBn || halt.code,
          depInMin: Math.max(0, Math.round(halt.elapsedDep - elapsed)),
        }
      : null,
    segment,
  };
}

