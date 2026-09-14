import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLang } from "../i18n.jsx";
import { getJSON, stationName, fmtDuration } from "../lib/api.js";
import { StatusChip, DelayChip } from "../components/TrainCard.jsx";

export default function Search() {
  const { lang, t } = useLang();
  const [params, setParams] = useSearchParams();
  const [meta, setMeta] = useState(null);
  const [from, setFrom] = useState(params.get("from") || "DHA");
  const [to, setTo] = useState(params.get("to") || "CHA");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getJSON("/meta").then(setMeta).catch(() => {});
  }, []);
  useEffect(() => {
    const f = params.get("from");
    const tt = params.get("to");
    if (f) setFrom(f);
    if (tt) setTo(tt);
  }, [params]);
  useEffect(() => {
    const f = params.get("from");
    const tt = params.get("to");
    if (!f || !tt || f === tt) return;
    setLoading(true);
    getJSON(`/search?from=${f}&to=${tt}`)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params]);

  const submit = (e) => {
    e && e.preventDefault();
    if (from !== to) setParams({ from, to });
  };

  const stations = meta ? meta.stations : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
        {t("navSearch")}
      </h1>

      <form
        onSubmit={submit}
        className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto]">
          <label className="block">
            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
              {t("from")}
            </span>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {stations.map((s) => (
                <option key={s.code} value={s.code}>
                  {stationName(s, lang)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
            title={t("swap")}
            className="self-end rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700"
          >
            ⇄
          </button>
          <label className="block">
            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
              {t("to")}
            </span>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {stations.map((s) => (
                <option key={s.code} value={s.code}>
                  {stationName(s, lang)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="self-end rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-800"
          >
            {t("findTrains")}
          </button>
        </div>
      </form>

      {loading && <p className="mt-6 text-slate-500">…</p>}

      {data && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {stationName(data.from, lang)} → {stationName(data.to, lang)} ·{" "}
            {data.results.length} {lang === "bn" ? "ট্রেন" : "trains"}
          </p>
          {data.results.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
              {t("noResults")}
            </p>
          )}
          {data.results.map((r) => (
            <Link
              key={r.id}
              to={"/train/" + r.id}
              className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-brand-700 px-2 py-0.5 text-xs font-bold text-white">
                  {r.number}
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {lang === "bn" ? r.nameBn : r.nameEn}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <StatusChip status={r.status} />
                  <DelayChip delayMin={r.delayMin} />
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  🚉 {r.dep} → {r.arr}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  ⏱ {t("duration")}: {fmtDuration(r.durationMin)}
                </span>
                {r.offDays.length > 0 && (
                  <span className="text-slate-400">
                    🛑 {t("offDay")}: {r.offDays.join(", ")}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
