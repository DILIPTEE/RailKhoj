// Rail news feed via Google News RSS (no API key, no dependencies).
//
// Headlines are fetched for Bangla + English queries, classified into risk
// categories (accident / blockade / line problem / crime / delay / crowding)
// and mapped to railway corridors by station names. The feed is cached for
// 15 minutes and fails soft: if the network is unavailable the API simply
// reports ok:false and the UI hides the section.

import { CORRIDORS, stationByCode } from "./schedule.js";

const CACHE_MS = 15 * 60 * 1000;
let cache = { ts: 0, ok: false, items: [] };

const CATS = [
  {
    id: "accident",
    severity: 3,
    kw: ["দুর্ঘটনা", "উল্টে পড়ে", "derail", "accident", "নিহত", "মৃত্যু"],
    riskBn: "দুর্ঘটনার কারণে এই রুটে ট্রেন দেরি বা বাতিল হতে পারে",
    riskEn: "Delays or cancellations possible on this route due to the accident",
  },
  {
    id: "blocked",
    severity: 3,
    kw: ["অবরোধ", "আন্দোলন", "অবস্থান কর্মসূচি", "ভাঙচুর", "strike", "blockade"],
    riskBn: "রেল অবরোধ/আন্দোলনের খবর — যাত্রা বিলম্বিত বা বাতিল হতে পারে (ভবিষ্যৎবাণী)",
    riskEn:
      "Rail blockade/strike reported — journeys may be delayed or cancelled (forecast)",
  },
  {
    id: "line_problem",
    severity: 2,
    kw: ["সিগন্যাল", "যান্ত্রিক ত্রুটি", "ট্রেন চলাচল বন্ধ", "লাইনে ত্রুটি", "locomotive", "engine fail"],
    riskBn: "লাইন/যান্ত্রিক সমস্যার খবর — এই রুটে দেরি হতে পারে",
    riskEn: "Line/mechanical problem reported — delays possible on this route",
  },
  {
    id: "crime",
    severity: 2,
    kw: ["ডাকাতি", "ছিনতাই", "পকেটমার", "চাঁদাবাজ", "প্রতারণা", "নিরাপত্তা", "অভিযান", "গ্রেপ্তার", "robbery", "snatching", "mugging", "theft"],
    riskBn: "নিরাপত্তা-সংক্রান্ত খবর — এই রুটে সতর্ক থাকুন, মূল্যবান জিনিস নিয়ন্ত্রণে রাখুন",
    riskEn:
      "Security-related news — stay alert on this route and keep valuables close",
  },
  {
    id: "delay",
    severity: 1,
    kw: ["দেরি", "বিলম্ব", "পিছিয়ে", "বাতিল", "delay", "cancel"],
    riskBn: "ট্রেন দেরি/বাতিলের খবর — লাইভ টাইমলাইন দেখুন",
    riskEn: "Delay/cancellation news — check the live timeline",
  },
  {
    id: "crowding",
    severity: 1,
    kw: ["ভিড়", "ঈদ", "যাত্রী চাপ", "টিকিট", "rush", "holiday", "crowd"],
    riskBn: "যাত্রী চাপ/টিকিট জটিলতার খবর — আগে পৌঁছান, অগ্রিম টিকিট নিন",
    riskEn: "Crowding/ticket rush news — arrive early, book tickets in advance",
  },
];

function classify(text) {
  const s = String(text).toLowerCase();
  for (const c of CATS) if (c.kw.some((k) => s.includes(k.toLowerCase()))) return c;
  return null;
}

// Corridor lookup built once from stations (en + bn name tokens).
let corridorTokens = null;
function corridorFor(text) {
  if (!corridorTokens) {
    corridorTokens = [];
    for (const c of CORRIDORS.values()) {
      const toks = new Set();
      for (const st of c.stations) {
        const s = stationByCode.get(st.code);
        if (!s) continue;
        for (const tok of String(s.nameEn || "").toLowerCase().split(/[\s-]+/))
          if (tok.length >= 4) toks.add(tok);
        for (const tok of String(s.nameBn || "").split(/[\s-]+/))
          if (tok.length >= 2) toks.add(tok);
      }
      if (toks.size)
        corridorTokens.push({ id: c.id, nameEn: c.nameEn, nameBn: c.nameBn, toks });
    }
  }
  const s = String(text).toLowerCase();
  let best = null;
  for (const c of corridorTokens) {
    for (const t of c.toks) {
      if (s.includes(t) && (!best || c.toks.size < best.toks.size)) {
        best = c;
        break;
      }
    }
  }
  return best;
}

const FEEDS = [
  "https://news.google.com/rss/search?q=" +
    encodeURIComponent("রেল OR ট্রেন when:3d") +
    "&hl=bn&gl=BD&ceid=BD:bn",
  "https://news.google.com/rss/search?q=" +
    encodeURIComponent("Bangladesh railway train when:3d") +
    "&hl=en-US&gl=US&ceid=US:EN",
];

function parseRss(xml, limit) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) && items.length < limit) {
    const block = m[1];
    const pick = (tag) => {
      const mm = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
      return mm ? mm[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : "";
    };
    let title = pick("title");
    const link = pick("link");
    const pub = pick("pubDate");
    const source = pick("source") || title.split(" - ").pop() || "";
    title = title.replace(/\s-\s[^-]+$/, ""); // drop trailing " - Source"
    if (title) items.push({ title, link, pub, source });
  }
  return items;
}

async function fetchOnce(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "RailKhoj/1.0 (+news-feed)" },
    });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Cached rail-risk news. Returns { ok, items, ts }. */
export async function getNews(force = false) {
  const now = Date.now();
  if (!force && now - cache.ts < CACHE_MS) return cache;

  const raws = await Promise.all(FEEDS.map(fetchOnce));
  const items = [];
  for (const xml of raws) {
    if (!xml) continue;
    for (const it of parseRss(xml, 14)) {
      const cat = classify(it.title);
      if (!cat) continue; // keep only risk-related rail news
      const cor = corridorFor(it.title);
      const publishedAt = it.pub ? new Date(it.pub).getTime() : NaN;
      const ageMin = Number.isFinite(publishedAt)
        ? Math.max(0, Math.round((now - publishedAt) / 60000))
        : null;
      items.push({
        id: Buffer.from(it.link || it.title).toString("base64url").slice(0, 24),
        headline: it.title,
        url: it.link,
        source: it.source,
        ageMin,
        category: cat.id,
        severity: cat.severity,
        riskBn: cat.riskBn,
        riskEn: cat.riskEn,
        corridorId: cor ? cor.id : null,
        corridorNameEn: cor ? cor.nameEn : null,
        corridorNameBn: cor ? cor.nameBn : null,
      });
    }
  }
  items.sort(
    (a, b) => b.severity - a.severity || (a.ageMin ?? 9e9) - (b.ageMin ?? 9e9)
  );
  cache = { ts: now, ok: raws.some(Boolean), items: items.slice(0, 18) };
  return cache;
}

