import { Link } from "react-router-dom";
import { useLang } from "../i18n.jsx";
import { stationName } from "../lib/api.js";
import AlertBanner from "./AlertBanner.jsx";

const statusStyle = {
  running:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  delayed:
    "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  upcoming:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  arrived:
    "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300",
};
const statusKey = {
  running: "statusRunning",
  delayed: "statusDelayed",
  upcoming: "statusUpcoming",
  arrived: "statusArrived",
};

export function StatusChip({ status, className = "" }) {
  const { t } = useLang();
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold " +
        (statusStyle[status] || statusStyle.arrived) +
        " " +
        className
      }
    >
      {(status === "running" || status === "delayed") && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {t(statusKey[status] || statusKey.arrived)}
    </span>
  );
}

export function DelayChip({ delayMin }) {
  const { t } = useLang();
  if (delayMin == null) return null;
  if (delayMin <= 2)
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
        {t("onTime")}
      </span>
    );
  return (
    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
      +{Math.round(delayMin)}m
    </span>
  );
}

export default function TrainCard({ train }) {
  const { lang, t } = useLang();
  const name = lang === "bn" ? train.nameBn : train.nameEn;
  const moving = train.status === "running" || train.status === "delayed";

  return (
    <Link
      to={"/train/" + train.id}
      className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      {train.topAlert && (
        <AlertBanner
          alert={{ ...train.topAlert, severity: train.alertSeverity || 2 }}
        />
      )}
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-brand-700 px-2 py-0.5 text-xs font-bold text-white">
          {train.number}
        </span>
        <StatusChip status={train.status} />
        {train.reports && train.reports.count > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            👥 {train.reports.count}
          </span>
        )}
        <span className="ml-auto">
          <DelayChip delayMin={train.delayMin} />
        </span>
      </div>
      <h3 className="mt-2 truncate text-base font-bold text-slate-900 dark:text-white">
        {name}
      </h3>
      <div className="mt-1 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <span className="font-semibold">
          {stationName(train.origin, lang)} {train.originDep}
        </span>
        <span className="text-slate-400">→</span>
        <span className="font-semibold">
          {stationName(train.dest, lang)} {train.destArr}
        </span>
      </div>
      <div className="mt-3">
        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
            style={{ width: (train.progressPct || 0) + "%" }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {train.progressPct || 0}% {t("progress")}
          </span>
          {moving && train.atStation && (
            <span className="truncate font-medium text-amber-600 dark:text-amber-400">
              🚉 {stationName(train.atStation, lang)} · {t("atStationNow")}
              {train.atStation.depInMin != null &&
                " · " + train.atStation.depInMin + " " + t("minLeft")}
            </span>
          )}
          {moving && !train.atStation && train.nextStop && (
            <span className="truncate font-medium text-slate-600 dark:text-slate-300">
              {t("nextStop")}: {stationName(train.nextStop, lang)}
              {train.nextStop.kmAway != null &&
                " · " + train.nextStop.kmAway + " " + t("kmAway")}
            </span>
          )}
        </div>
      </div>
      {moving && train.nextStop && train.prevStop && (
        <div
          className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300"
          title={
            stationName(train.prevStop, lang) +
            " → " +
            stationName(train.nextStop, lang)
          }
        >
          <span className="truncate">
            🚆 {stationName(train.prevStop, lang)} →{" "}
            {stationName(train.nextStop, lang)}
          </span>
          <span className="ml-auto whitespace-nowrap text-slate-500 dark:text-slate-400">
            {t("eta")} {train.nextStop.eta}
          </span>
        </div>
      )}
    </Link>
  );
}
