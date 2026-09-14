import { Fragment } from "react";
import { useLang } from "../i18n.jsx";
import { stationName } from "../lib/api.js";

export default function Timeline({ stops, segment = null }) {
  const { lang, t } = useLang();
  return (
    <ol className="relative ml-2 border-l-2 border-slate-200 dark:border-slate-700">
      {stops.map((s, i) => {
        const isNext = s.state === "next";
        const passed = s.state === "passed";
        const live = s.live.dep || s.live.arr;
        const sched = s.scheduled.dep || s.scheduled.arr;
        // Distance from the previous station on the line (Google-Maps style
        // station-to-station leg length).
        const leg = i > 0 ? Math.max(0, Math.round((s.km - stops[i - 1].km) * 10) / 10) : null;
        const seg = segment && isNext ? segment : null;
        return (
          <Fragment key={s.code + "-" + i}>
            {seg && (
              <li className="relative -ml-[9px] mb-5 flex items-start gap-4">
                <span className="mt-0.5 block shrink-0 text-lg leading-none">
                  🚆
                </span>
                <div className="flex-1 pb-1">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <span className="truncate">
                      🟢 {stationName(seg.from, lang)} → {stationName(seg.to, lang)}
                    </span>
                    <span className="shrink-0 whitespace-nowrap">
                      ~{seg.etaInMin} {t("minLeft")}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500 transition-all duration-700"
                      style={{
                        width:
                          Math.min(
                            100,
                            Math.round(
                              (seg.doneKm / Math.max(0.1, seg.legKm)) * 100
                            )
                          ) + "%",
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {seg.doneKm} / {seg.legKm} km{" "}
                    {t("kmLeft", { n: seg.kmAway })}
                  </p>
                </div>
              </li>
            )}
            <li
              className="relative -ml-[9px] mb-5 flex items-start gap-4 last:mb-0"
            >
              <span
                className={
                  "mt-1.5 block h-4 w-4 shrink-0 rounded-full border-[3px] " +
                  (passed
                    ? "border-emerald-500 bg-emerald-500"
                    : isNext
                      ? "animate-pulse border-accent bg-white dark:bg-slate-900"
                      : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800")
                }
              />
              <div className="flex-1 pb-1">
                <div
                  className={
                    "flex items-start justify-between gap-3 " +
                    (passed ? "opacity-60" : "")
                  }
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900 dark:text-white">
                      {stationName(s, lang)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {s.km} km
                      {leg != null && " · +" + leg + " " + t("fromPrev")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {live}{" "}
                      <span className="text-xs font-normal text-slate-400 line-through">
                        {sched}
                      </span>
                    </p>
                    {isNext && (
                      <p className="text-xs font-bold text-accent">
                        ● {t("nextStop")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
