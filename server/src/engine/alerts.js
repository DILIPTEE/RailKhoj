// Community safety alerts — robbery, snatching, harassment, line problems...
//
// Reports are stored in memory and gain trust through confirm/deny votes from
// other passengers. Every active alert is also cross-checked against the rail
// news feed (engine/news.js): when a headline in the same corridor covers the
// same category, the alert gets a "matches news" boost. Alerts expire after
// 6-12 hours (by severity) so the list always reflects the current situation.

import { trainById } from "./schedule.js";

export const ALERT_TYPES = {
  robbery: { severity: 3, emoji: "🚨", bn: "ডাকাতি", en: "Robbery" },
  snatching: { severity: 2, emoji: "🎒", bn: "ছিনতাই", en: "Snatching" },
  pickpocket: { severity: 1, emoji: "👥", bn: "পকেটমার", en: "Pickpocket" },
  harassment: { severity: 2, emoji: "⚠️", bn: "হয়রানি/ইভতেজনা", en: "Harassment" },
  scam: { severity: 1, emoji: "🎭", bn: "প্রতারণা/ভিক্ষু চক্র", en: "Scam / fraud" },
  accident: { severity: 3, emoji: "💥", bn: "দুর্ঘটনা", en: "Accident" },
  line_problem: { severity: 3, emoji: "🛤️", bn: "লাইন সমস্যা", en: "Line problem" },
  blocked: { severity: 3, emoji: "🚧", bn: "রেল অবরোধ", en: "Rail blockade" },
  crowding: { severity: 1, emoji: "🧍", bn: "যাত্রী ভিড়", en: "Crowding" },
  other: { severity: 1, emoji: "📌", bn: "অন্যান্য", en: "Other" },
};

// News categories that corroborate each alert type.
const NEWS_REL = {
  accident: new Set(["accident"]),
  blocked: new Set(["blocked", "strike"]),
  line_problem: new Set(["line_problem", "delay"]),
  robbery: new Set(["crime"]),
  snatching: new Set(["crime"]),
  pickpocket: new Set(["crime"]),
  harassment: new Set(["crime"]),
  scam: new Set(["crime"]),
};

const EXPIRY_H = { 3: 12, 2: 8, 1: 6 };

const store = new Map(); // id -> alert
let seq = 0;

function publicAlert(a) {
  const { confirm, deny } = a.votes;
  const total = confirm + deny;
  let verdict = "unverified";
  let confidence = null;
  if (total >= 3) {
    confidence = Math.round((confirm / total) * 100);
    if (confidence >= 60) verdict = "verified";
    else if (confidence <= 40) verdict = "doubtful";
    else verdict = "mixed";
  }
  const info = ALERT_TYPES[a.type] || ALERT_TYPES.other;
  return {
    id: a.id,
    type: a.type,
    emoji: info.emoji,
    typeBn: info.bn,
    typeEn: info.en,
    severity: info.severity,
    note: a.note,
    noteBn: a.noteBn || null,
    noteEn: a.noteEn || null,
    trainId: a.trainId || null,
    corridorId: a.corridorId || null,
    stationCode: a.stationCode || null,
    votes: { confirm, deny },
    verdict,
    confidence,
    newsMatch: a.newsMatch || null,
    demo: !!a.demo,
    createdBy: a.createdBy,
    createdAt: a.createdAt,
    ageMin: Math.max(0, Math.round((Date.now() - a.createdAt) / 60000)),
    expiresInMin: Math.max(0, Math.round((a.expiresAt - Date.now()) / 60000)),
  };
}

function purgeExpired() {
  const now = Date.now();
  for (const [id, a] of store.entries()) if (a.expiresAt <= now) store.delete(id);
}

/** Active alerts, most severe + newest first (public shape). */
export function listActive() {
  purgeExpired();
  const list = [...store.values()].map(publicAlert);
  list.sort((x, y) => y.severity - x.severity || x.ageMin - y.ageMin);
  return list;
}

/** Active alerts relevant to a train (its own + corridor-wide). */
export function alertsForTrain(t) {
  return listActive().filter(
    (a) => a.trainId === t.id || (a.corridorId && a.corridorId === t.corridorId)
  );
}

export function addAlert({
  type,
  note,
  trainId = null,
  corridorId = null,
  stationCode = null,
  createdBy = "community",
  demo = false,
  votes = null,
  ageMinutes = 0,
  noteBn = null,
  noteEn = null,
}) {
  const info = ALERT_TYPES[type] || ALERT_TYPES.other;
  const now = Date.now() - ageMinutes * 60000;
  // Corridor is derived from the train so corridor-wide warnings & news
  // cross-checks keep working even when reporters don't pick a corridor.
  if (trainId && !corridorId) {
    const t = trainById.get(trainId);
    if (t) corridorId = t.corridorId;
  }
  const a = {
    id: "a" + now.toString(36) + (seq++).toString(36),
    type,
    note: String(note).trim(),
    noteBn,
    noteEn,
    trainId,
    corridorId,
    stationCode,
    createdBy,
    demo: !!demo,
    votes: { confirm: votes?.confirm ?? 0, deny: votes?.deny ?? 0 },
    voters: new Set(),
    newsMatch: null,
    createdAt: now,
    expiresAt: now + EXPIRY_H[info.severity] * 3600 * 1000,
  };
  store.set(a.id, a);
  return publicAlert(a);
}

/** One vote per visitor (ip hash) per alert. Demo alerts are not votable. */
export function voteAlert(id, vote, ipHash) {
  const a = store.get(id);
  if (!a || a.demo) return null;
  if (a.voters.has(ipHash)) return { alreadyVoted: true, alert: publicAlert(a) };
  a.voters.add(ipHash);
  a.votes[vote === "confirm" ? "confirm" : "deny"] += 1;
  return { alreadyVoted: false, alert: publicAlert(a) };
}

/** Attach corroborating news headlines & upgrade verdicts (mutates list). */
export function attachNewsMatches(alertList, newsItems) {
  for (const a of alertList) {
    a.newsMatch = null;
    const rel = NEWS_REL[a.type];
    if (!rel) continue;
    const m = newsItems.find(
      (n) =>
        rel.has(n.category) &&
        n.corridorId &&
        a.corridorId &&
        n.corridorId === a.corridorId &&
        (n.ageMin == null || n.ageMin <= 12 * 60)
    );
    if (m) {
      a.newsMatch = {
        headline: m.headline,
        url: m.url,
        source: m.source,
        ageMin: m.ageMin,
      };
      if (a.verdict === "unverified") a.verdict = "newsSupported";
    }
  }
  return alertList;
}

// --- Seed alerts (clearly labelled demo data, not votable) -------------------
// They make every verdict state visible on first load; community reports
// replace them naturally as they expire.
(function seed() {
  addAlert({
    type: "pickpocket",
    trainId: "704",
    stationCode: "DHA",
    createdBy: "demo",
    demo: true,
    ageMinutes: 35,
    votes: { confirm: 4, deny: 1 },
    note: "Pickpocket gangs active on Kamalapur platforms — keep bags in front.",
    noteBn:
      "কমলাপুর প্ল্যাটফর্মে পকেটমার দল সক্রিয় — ব্যাগ সামনে রাখুন, মোবাইল জিপযুক্ত পকেটে রাখুন।",
    noteEn:
      "Pickpocket gangs active on Kamalapur platforms — keep bags in front and phones in a zipped pocket.",
  });
  addAlert({
    type: "snatching",
    trainId: "704",
    createdBy: "demo",
    demo: true,
    ageMinutes: 180,
    votes: { confirm: 0, deny: 2 },
    note: "Unverified: mobile snatching near windows at night on this route.",
    noteBn:
      "যাচাই হয়নি: রাতে এই রুটে জানালার কাছে বসা যাত্রীদের মোবাইল ছিনতাইয়ের খবর ঘুরছে।",
    noteEn:
      "Unverified: mobile snatching near windows at night on this route.",
  });
  addAlert({
    type: "line_problem",
    trainId: "705",
    createdBy: "demo",
    demo: true,
    ageMinutes: 70,
    votes: { confirm: 2, deny: 0 },
    note: "Signal fault reported on the north-west line — trains may run 20-40 min late.",
    noteBn:
      "উত্তর-পশ্চিম রুটে সিগন্যাল ত্রুটির খবর — ট্রেন ২০–৪০ মিনিট দেরিতে চলতে পারে।",
    noteEn:
      "Signal fault reported on the north-west line — trains may run 20-40 min late.",
  });
  addAlert({
    type: "crowding",
    trainId: "704",
    createdBy: "demo",
    demo: true,
    ageMinutes: 50,
    votes: { confirm: 1, deny: 0 },
    note: "Evening trains are crowded — arrive early, keep an eye on luggage.",
    noteBn:
      "সন্ধ্যার ট্রেনগুলোতে যাত্রী চাপ বেশি — আগে পৌঁছান, জিনিসপত্রের যত্ন নিন।",
    noteEn:
      "Evening trains are crowded — arrive early, keep an eye on luggage.",
  });
})();

