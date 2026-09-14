import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../i18n.jsx";
import { getJSON, postJSON, stationName } from "../lib/api.js";

const TYPES = [
  { key: "robbery", emoji: "🚨", bn: "ডাকাতি", en: "Robbery" },
  { key: "snatching", emoji: "🎒", bn: "ছিনতাই", en: "Snatching" },
  { key: "pickpocket", emoji: "👥", bn: "পকেটমার", en: "Pickpocket" },
  { key: "harassment", emoji: "⚠️", bn: "হয়রানি", en: "Harassment" },
  { key: "scam", emoji: "🎭", bn: "প্রতারণা", en: "Scam" },
  { key: "accident", emoji: "💥", bn: "দুর্ঘটনা", en: "Accident" },
  { key: "line_problem", emoji: "🛤️", bn: "লাইন সমস্যা", en: "Line problem" },
  { key: "blocked", emoji: "🚧", bn: "অবরোধ", en: "Blockade" },
  { key: "crowding", emoji: "🧍", bn: "ভিড়", en: "Crowding" },
  { key: "other", emoji: "📌", bn: "অন্যান্য", en: "Other" },
];

const VERDICT = {
  verified: { cls: "rk-v-verified", key: "verifiedBadge" },
  doubtful: { cls: "rk-v-doubtful", key: "doubtfulBadge" },
  mixed: { cls: "rk-v-mixed", key: "verifiedBadge" },
  newsSupported: { cls: "rk-v-news", key: "newsSupportedBadge" },
  unverified: { cls: "rk-v-unverified", key: "unverifiedBadge" },
};

function ago(min, lang) {
  if (min == null) return "";
  if (min < 1) return lang === "bn" ? "এইমাত্র" : "just now";
  if (min < 60) return min + (lang === "bn" ? " মিনিট আগে" : "m ago");
  const h = Math.floor(min / 60);
  return h + (lang === "bn" ? " ঘণ্টা আগে" : "h ago");
}

export default function SafetyPanel({ trainId = null, limit = null }) {
  const { lang, t } = useLang();
  const [data, setData] = useState(null);
  const [news, setNews] = useState(null);
  const [voted, setVoted] = useState({});
  const [toast, setToast] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: "robbery", note: "" });
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      const d = await getJSON("/alerts" + (trainId ? "?trainId=" + trainId : ""));
      setData(d);
    } catch {
      setData({ alerts: [], newsOk: false });
    }
    if (!news) {
      try {
        const n = await getJSON("/news");
        setNews(n);
      } catch {
        setNews({ ok: false, items: [] });
      }
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainId]);

  async function vote(id, v) {
    const r = await postJSON(`/alerts/${id}/vote`, { vote: v });
    if (r.accepted) {
      setVoted((p) => ({ ...p, [id]: true }));
      setToast(r.alreadyVoted ? t("alreadyVoted") : t("thanksVoted"));
      setData((d) =>
        d
          ? { ...d, alerts: d.alerts.map((a) => (a.id === id ? r.alert : a)) }
          : d
      );
    }
    setTimeout(() => setToast(""), 3500);
  }

  async function submit(e) {
    e.preventDefault();
    if (form.note.trim().length < 10 || sending) return;
    setSending(true);
    const r = await postJSON("/alerts", {
      type: form.type,
      note: form.note.trim(),
      trainId,
    });
    setSending(false);
    if (r.accepted) {
      setForm((f) => ({ ...f, note: "" }));
      setShowForm(false);
      setToast(t("reportAccepted"));
      load();
    } else {
      setToast((r.reason ? r.reason + " — " : "") + t("reportError"));
    }
    setTimeout(() => setToast(""), 4000);
  }

  const alerts = (data?.alerts || []).slice(0, limit || undefined);
  const newsItems = (news?.ok ? news.items : []).slice(0, limit ? 3 : 6);

  return (
    <section className="rk-safety rounded-2xl border border-amber-300/70 bg-amber-50/60 p-4 dark:border-amber-500/25 dark:bg-amber-950/25">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-amber-900 dark:text-amber-200">
          🛡️ {t("safetyAlerts")}
        </h2>
        <span className="text-xs text-amber-800/80 dark:text-amber-200/70">
          {t("safetySub")}
        </span>
        <a
          href="tel:999"
          className="rk-hotline ml-auto rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-700"
          title={t("safetyHotline")}
        >
          📞 999 · {t("callNow")}
        </a>
      </div>

      {toast && (
        <p className="mt-2 rounded-lg bg-amber-200/70 px-3 py-1.5 text-sm font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
          {toast}
        </p>
      )}

      <div className="mt-3 space-y-2.5">
        {alerts.map((a) => {
          const v = VERDICT[a.verdict] || VERDICT.unverified;
          const note = lang === "bn" ? a.noteBn || a.note : a.noteEn || a.note;
          const typeName = lang === "bn" ? a.typeBn : a.typeEn;
          return (
            <article
              key={a.id}
              className={
                "rk-alert rk-alert-s" +
                a.severity +
                " rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900"
              }
            >
              <div className="flex items-start gap-3">
                <span className="rk-alert-emoji text-xl" aria-hidden>
                  {a.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b className="text-sm text-slate-800 dark:text-slate-100">
                      {typeName}
                    </b>
                    <span className={"rk-badge " + v.cls}>{t(v.key)}</span>
                    {a.confidence != null && (
                      <span className="text-[11px] text-slate-400">
                        {a.confidence}%
                      </span>
                    )}
                    {a.demo && (
                      <span className="rk-badge rk-v-demo">{t("demoBadge")}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-snug text-slate-700 dark:text-slate-300">
                    {note}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                    {a.trainId && (
                      <Link
                        to={`/train/${a.trainId}`}
                        className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
                      >
                        🚆 {a.trainId}
                      </Link>
                    )}
                    <span>{ago(a.ageMin, lang)}</span>
                  </div>
                  {a.newsMatch && (
                    <a
                      href={a.newsMatch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rk-newsmatch mt-1.5 block rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs text-teal-800 hover:underline dark:bg-teal-900/30 dark:text-teal-200"
                    >
                      📰 {t("newsMatchLabel")} “{a.newsMatch.headline}”
                    </a>
                  )}
                </div>
              </div>
              {!a.demo && (
                <div className="mt-2 flex items-center gap-2 pl-9">
                  <button
                    onClick={() => vote(a.id, "confirm")}
                    disabled={voted[a.id]}
                    className="rk-vote-btn rk-vote-confirm"
                  >
                    {t("confirmYes")} ({a.votes.confirm})
                  </button>
                  <button
                    onClick={() => vote(a.id, "deny")}
                    disabled={voted[a.id]}
                    className="rk-vote-btn rk-vote-deny"
                  >
                    {t("denyNo")} ({a.votes.deny})
                  </button>
                </div>
              )}
            </article>
          );
        })}
        {alerts.length === 0 && (
          <p className="rounded-xl bg-white/70 p-3 text-sm text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            ✅{" "}
            {lang === "bn"
              ? "এই রুটে এখন কোনো সতর্কতা নেই"
              : "No active alerts on this route"}
          </p>
        )}
      </div>

      {/* --- Report a problem --- */}
      <div className="mt-3">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="rk-report-toggle w-full rounded-xl border-2 border-dashed border-amber-400/80 px-3 py-2.5 text-sm font-bold text-amber-800 transition hover:bg-amber-100/70 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-900/30"
          >
            ⚠️ {t("reportProblem")}
          </button>
        ) : (
          <form
            onSubmit={submit}
            className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900"
          >
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {t("chooseType")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TYPES.map((ty) => (
                <button
                  key={ty.key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: ty.key }))}
                  className={
                    "rk-type-chip" +
                    (form.type === ty.key ? " rk-type-chip-on" : "")
                  }
                >
                  {ty.emoji} {lang === "bn" ? ty.bn : ty.en}
                </button>
              ))}
            </div>
            <textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder={t("describeNote")}
              rows={3}
              maxLength={400}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={form.note.trim().length < 10 || sending}
                className="rk-report-send rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {t("sendReport")}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-slate-400 hover:underline"
              >
                ✕
              </button>
            </div>
          </form>
        )}
      </div>

      {/* --- Rail news & forecast --- */}
      {newsItems.length > 0 && (
        <div className="mt-4 border-t border-amber-300/60 pt-3 dark:border-amber-500/20">
          <h3 className="text-sm font-extrabold text-amber-900 dark:text-amber-200">
            📰 {t("railNews")}
          </h3>
          <p className="mt-0.5 text-[11px] text-amber-800/70 dark:text-amber-200/60">
            {t("railNewsSub")}
          </p>
          <ul className="mt-2 space-y-2">
            {newsItems.map((n) => (
              <li
                key={n.id}
                className="rounded-xl bg-white p-2.5 shadow-sm dark:bg-slate-900"
              >
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold leading-snug text-slate-800 hover:text-brand-700 hover:underline dark:text-slate-100 dark:hover:text-brand-300"
                >
                  {n.headline}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                  <span className="font-semibold">{n.source}</span>
                  {n.ageMin != null && <span>{ago(n.ageMin, lang)}</span>}
                  {(lang === "bn" ? n.corridorNameBn : n.corridorNameEn) && (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                      📍 {lang === "bn" ? n.corridorNameBn : n.corridorNameEn}
                    </span>
                  )}
                </div>
                <p className="mt-1 rounded-lg bg-amber-100/70 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                  {t("riskForecast")}:{" "}
                  {lang === "bn" ? n.riskBn : n.riskEn}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-snug text-amber-800/70 dark:text-amber-200/60">
        ℹ️ {t("safetyNote")}
      </p>
    </section>
  );
}
