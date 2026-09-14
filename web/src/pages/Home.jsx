import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLang } from "../i18n.jsx";
import { getJSON, stationName } from "../lib/api.js";
import TrainCard from "../components/TrainCard.jsx";
import OverviewMap from "../components/OverviewMap.jsx";
import SafetyPanel from "../components/SafetyPanel.jsx";
import { getTheme, onThemeChange } from "../lib/theme.js";

const POPULAR = [
  ["DHA", "CHA"],
  ["DHA", "SYL"],
  ["DHA", "COX"],
  ["DHA", "KHU"],
  ["DHA", "RAJS"],
  ["DHA", "MYM"],
  ["DHA", "PANC"],
];

export default function Home() {
  const { lang, t } = useLang();
  const navigate = useNavigate();
  const [trains, setTrains] = useState(null);
  const [meta, setMeta] = useState(null);
  const [q, setQ] = useState("");
  const [crowdPick, setCrowdPick] = useState("");
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => onThemeChange(setTheme), []);

  useEffect(() => {
    let alive = true;
    const load = () =>
      getJSON("/trains")
        .then((d) => {
          if (alive) setTrains(d.trains);
        })
        .catch((e) => {
          console.error("Failed to load trains:", e);
        });
    load();
    const iv = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);
  useEffect(() => {
    getJSON("/meta").then(setMeta).catch(() => {});
  }, []);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || !trains) return [];
    return trains
      .filter((tr) =>
        (tr.nameEn + " " + tr.nameBn + " " + tr.number)
          .toLowerCase()
          .includes(s)
      )
      .slice(0, 6);
  }, [q, trains]);

  const stByCode = useMemo(
    () => new Map((meta ? meta.stations : []).map((s) => [s.code, s])),
    [meta]
  );

  const running = (trains || []).filter(
    (x) => x.status === "running" || x.status === "delayed"
  );
  const upcoming = (trains || [])
    .filter((x) => x.status === "upcoming")
    .slice(0, 8);
  const reported = running
    .filter((x) => x.reports && x.reports.count > 0)
    .sort((a, b) => b.reports.count - a.reports.count)
    .slice(0, 4);
  const totalReports = running.reduce(
    (a, x) => a + (x.reports ? x.reports.count : 0),
    0
  );

  const handleTrainClick = (id) => {
    navigate("/train/" + id);
  };

  return (
    <div>
      <section className="bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <h1 className="text-3xl font-extrabold sm:text-5xl">
            {t("heroTitle")} 🚆
          </h1>
          <p className="mt-3 max-w-2xl text-brand-100 sm:text-lg">
            {t("heroSub")}
          </p>

          <div className="relative mt-7 max-w-xl">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-2xl border-0 bg-white/95 px-5 py-4 text-slate-900 shadow-lg outline-none ring-2 ring-transparent placeholder:text-slate-400 focus:ring-brand-200"
            />
            {q && matches.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl bg-white text-slate-900 shadow-xl">
                {matches.map((tr) => (
                  <li key={tr.id}>
                    <button
                      onClick={() => {
                        setQ("");
                        navigate("/train/" + tr.id);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-50"
                    >
                      <span className="rounded-md bg-brand-700 px-2 py-0.5 text-xs font-bold text-white">
                        {tr.number}
                      </span>
                      <span className="truncate font-semibold">
                        {lang === "bn" ? tr.nameBn : tr.nameEn}
                      </span>
                      <span className="ml-auto text-xs text-slate-400">
                        {stationName(tr.origin, lang)} →{" "}
                        {stationName(tr.dest, lang)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {meta && (
            <div className="mt-7 flex flex-wrap gap-2 text-sm font-semibold text-brand-100">
              <span className="rounded-full bg-white/10 px-3 py-1">
                🚆 {meta.trainCount} {lang === "bn" ? "ট্রেন" : "trains"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                🚉 {meta.stations.length}{" "}
                {lang === "bn" ? "স্টেশন" : "stations"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                🛤️ {meta.corridors.length}{" "}
                {lang === "bn" ? "রুট" : "routes"}
              </span>
            </div>
          )}

          <div className="mt-8">
            <p className="text-sm font-bold uppercase tracking-wide text-brand-200">
              {t("popularRoutes")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {POPULAR.map(([f, to]) => {
                const fs = stByCode.get(f);
                const ts = stByCode.get(to);
                return (
                  <Link
                    key={f + to}
                    to={`/search?from=${f}&to=${to}`}
                    className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    {fs ? stationName(fs, lang) : f} →{" "}
                    {ts ? stationName(ts, lang) : to}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Crowd live — "I'm on this train" CTA */}
        <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 dark:border-emerald-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start gap-4">
            <span className="text-3xl" aria-hidden>
              📲
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {t("crowdTitle")}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {t("crowdSub")}
              </p>
              {running.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t("crowdSub2")}
                  </label>
                  <select
                    value={crowdPick}
                    onChange={(e) => setCrowdPick(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">—</option>
                    {running.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.number} · {lang === "bn" ? tr.nameBn : tr.nameEn}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => crowdPick && navigate("/train/" + crowdPick)}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                    disabled={!crowdPick}
                  >
                    🚆 {t("crowdGo")}
                  </button>
                  {totalReports > 0 && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                      👥 {t("crowdCount", { n: totalReports })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {reported.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                {t("crowdReported")}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {reported.map((tr) => (
                  <button
                    key={tr.id}
                    onClick={() => navigate("/train/" + tr.id)}
                    className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-300"
                  >
                    🚆 {tr.number} · 👥 {tr.reports.count}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Live Overview Map */}
        <section>
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {t("liveMap")}
              {trains ? ` (${running.length})` : ""}
            </h2>
            <span className="ml-auto text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t("clickTrainHint")}
            </span>
          </div>
          {!trains ? (
            <div className="mt-4 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800 h-[400px]" />
          ) : running.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
              {t("noResults")}
            </div>
          ) : (
            <div className="mt-4">
              <OverviewMap
                trains={running}
                theme={theme}
                onTrainClick={handleTrainClick}
                height="h-[400px]"
              />
              <div className="mt-2 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {t("statusRunning")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
                  {t("statusDelayed")}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Safety alerts + rail news */}
        <section className="mt-10">
          <SafetyPanel limit={4} />
        </section>

        {/* Running Trains List */}
        <section className="mt-10">
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            {t("runningNow")}
            {trains ? ` (${running.length})` : ""}
          </h2>
          {!trains ? (
            <p className="mt-6 text-slate-500">…</p>
          ) : running.length === 0 ? (
            <p className="mt-4 text-slate-500 dark:text-slate-400">
              {t("noResults")}
            </p>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {running.map((tr) => (
                <TrainCard key={tr.id} train={tr} />
              ))}
            </div>
          )}
        </section>

        {upcoming.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {t("upcoming")}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {upcoming.map((tr) => (
                <TrainCard key={tr.id} train={tr} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

