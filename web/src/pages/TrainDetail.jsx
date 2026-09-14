import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLang } from "../i18n.jsx";
import { getJSON, postJSON, stationName } from "../lib/api.js";
import { getTheme, onThemeChange } from "../lib/theme.js";
import LiveMap from "../components/LiveMap.jsx";
import Timeline from "../components/Timeline.jsx";
import AlertBanner from "../components/AlertBanner.jsx";
import SafetyPanel from "../components/SafetyPanel.jsx";
import { StatusChip, DelayChip } from "../components/TrainCard.jsx";

export default function TrainDetail() {
  const { id } = useParams();
  const { lang, t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [meta, setMeta] = useState(null);
  const [theme, setTheme] = useState(getTheme);
  const [report, setReport] = useState({ busy: false, msg: "" });
  const [copied, setCopied] = useState(false);

  useEffect(() => onThemeChange(setTheme), []);
  useEffect(() => {
    getJSON("/meta").then(setMeta).catch(() => {});
  }, []);
  useEffect(() => {
    let alive = true;
    setError(false);
    setData(null);
    const load = () =>
      getJSON("/trains/" + id)
        .then((d) => alive && setData(d))
        .catch(() => alive && setError(true));
    load();
    const iv = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [id]);

  const stations = useMemo(() => {
    if (!data || !meta) return [];
    const byCode = new Map(meta.stations.map((s) => [s.code, s]));
    return data.stops.map((s) => byCode.get(s.code)).filter(Boolean);
  }, [data, meta]);

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 text-center">
        <p className="text-5xl">🚉</p>
        <h1 className="mt-4 text-2xl font-bold">{t("notFound")}</h1>
        <Link
          to="/"
          className="mt-6 inline-block rounded-xl bg-brand-700 px-5 py-2.5 font-semibold text-white"
        >
          ← {t("navHome")}
        </Link>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse px-4 py-12">
        <div className="h-10 w-2/3 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="mt-6 h-72 rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  const live = data.live;
  const pos = live.position;
  const moving = live.status === "running" || live.status === "delayed";

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: data.train.nameEn,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user cancelled */
    }
  };

  const sendReport = () => {
    if (!navigator.geolocation) {
      setReport({ busy: false, msg: t("reportRejected") });
      return;
    }
    setReport({ busy: true, msg: t("locating") });
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const r = await postJSON("/trains/" + id + "/reports", {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
        });
        if (r.accepted) setReport({ busy: false, msg: t("reportThanks") });
        else if (r.reason === "Train is not running right now")
          setReport({ busy: false, msg: t("reportNotRunning") });
        else
          setReport({
            busy: false,
            msg:
              t("reportRejected") +
              (r.distanceKm ? " (~" + r.distanceKm + " km)" : ""),
          });
      },
      () => setReport({ busy: false, msg: t("reportRejected") }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const flagPos = async () => {
    const r = await postJSON("/trains/" + id + "/flag", {});
    setReport({
      busy: false,
      msg: r.accepted ? t("flagThanks") : r.reason || t("reportError"),
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link
        to="/"
        className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
      >
        ← {t("navHome")}
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="rounded-xl bg-brand-700 px-3 py-1 text-lg font-extrabold text-white">
          {data.train.number}
        </span>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          {lang === "bn" ? data.train.nameBn : data.train.nameEn}
        </h1>
        <StatusChip status={live.status} />
        <DelayChip delayMin={live.delayMin} />
        {data.train.offDays.length > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            🛑 {t("offDay")}: {data.train.offDays.join(", ")}
          </span>
        )}
      </div>

      {data.alerts && data.alerts.length > 0 && (
        <div className="mt-3 space-y-2">
          {data.alerts.slice(0, 3).map((a) => (
            <AlertBanner key={a.id} alert={a} />
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoChip
          label={t("from")}
          value={stationName(data.origin, lang) + " " + data.originDep}
        />
        <InfoChip
          label={t("to")}
          value={stationName(data.dest, lang) + " " + data.destArr}
        />
        <InfoChip
          label={t("nextStop")}
          value={
            live.nextStop
              ? stationName(live.nextStop, lang) +
                (live.nextStop.kmAway != null
                  ? " · " + live.nextStop.kmAway + " " + t("kmAway")
                  : "") +
                " · " +
                live.nextStop.eta
              : "—"
          }
          highlight={moving}
        />
        <InfoChip
          label={t("speed")}
          value={
            pos && moving
              ? live.atStation
                ? "🚉 " + t("atStationNow")
                : pos.speedKmh + " km/h"
              : "—"
          }
        />
      </div>

      {moving && live.prevStop && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <InfoChip
            label={t("lastStation")}
            value={
              stationName(live.prevStop, lang) +
              (live.prevStop.depMinAgo != null
                ? " · " + live.prevStop.depMinAgo + " " + t("minAgo")
                : "")
            }
          />
          <InfoChip
            label={t("nearStation")}
            value={
              live.nearStop
                ? stationName(live.nearStop, lang) +
                  " · " +
                  live.nearStop.kmAway +
                  " " +
                  t("kmAway")
                : "—"
            }
          />
        </div>
      )}

      <div className="mt-4">
        <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-2.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-all duration-700"
            style={{ width: live.progressPct + "%" }}
          />
        </div>
        <p className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {live.progressPct}% {t("progress")} · {data.totalKm} km
          {moving && live.prevStop && live.nextStop
            ? " · " +
              stationName(live.prevStop, lang) +
              " → " +
              stationName(live.nextStop, lang)
            : ""}
          {live.reports ? " · " + live.reports.count + " " + t("reports") : ""}
        </p>
      </div>

      <h2 className="mt-8 text-lg font-extrabold text-slate-900 dark:text-white">
        🗺️ {t("liveMap")}
      </h2>
      <div className="mt-3">
        <LiveMap
          polyline={data.polyline}
          stations={stations}
          position={pos ? { lat: pos.lat, lng: pos.lng } : null}
          info={
            moving
              ? {
                  prevStop: live.prevStop,
                  nextStop: live.nextStop,
                  nearStop: live.nearStop,
                  delayed: live.status === "delayed",
                  speedKmh: pos ? pos.speedKmh : null,
                  atStation: live.atStation,
                  positionSource: live.positionSource,
                  reports: live.reports ? live.reports.count : 0,
                }
              : null
          }
          theme={theme}
          height="h-[380px]"
        />
      </div>

      {moving && (
        <p
          className={
            "mt-2 text-xs " +
            (live.positionSource === "crowd"
              ? "font-semibold text-emerald-600 dark:text-emerald-400"
              : "text-slate-400 dark:text-slate-500")
          }
        >
          {live.positionSource === "crowd"
            ? t("posSourceCrowd")
            : t("posSourceSchedule")}
        </p>
      )}
      {moving && live.flags && (
        <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
          ⚠️ {t("flagBadge", { n: live.flags.count })}
        </p>
      )}

      <div className="mt-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 dark:border-emerald-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-2xl" aria-hidden>
            📲
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-slate-900 dark:text-white">
              {t("crowdCtaTitle")}
            </p>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {t("crowdCtaSub")}
            </p>
          </div>
          {live.reports && live.reports.count > 0 && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
              👥 {t("crowdReportCount", { n: live.reports.count })}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={sendReport}
            disabled={report.busy}
            className="rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-extrabold text-white shadow transition hover:bg-emerald-700 disabled:opacity-60"
          >
            📍 {report.busy ? t("locating") : t("imOnTrain")}
            {!report.busy && " ▶"}
          </button>
          <button
            onClick={share}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {copied ? "✅ " + t("copied") : "🔗 " + t("share")}
          </button>
          <button
            onClick={flagPos}
            className="rounded-xl border border-amber-300 px-4 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
          >
            ⚠️ {t("flagPos")}
          </button>
          {report.msg && (
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {report.msg}
            </p>
          )}
        </div>
      </div>

      <h2 className="mt-10 text-lg font-extrabold text-slate-900 dark:text-white">
        🕐 {t("schedule")}
      </h2>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <Timeline stops={data.stops} segment={moving ? live.segment : null} />
      </div>

      <div className="mt-10">
        <SafetyPanel trainId={id} />
      </div>

      <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
        ⚠️ {t("approxNote")}
      </p>
    </div>
  );
}

function InfoChip({ label, value, highlight = false }) {
  return (
    <div
      className={
        "rounded-2xl border p-3 " +
        (highlight
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900")
      }
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

