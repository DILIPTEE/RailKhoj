import { useLang } from "../i18n.jsx";

// Compact warning strip shown above a train card / detail page when the train
// has an active safety alert (robbery, line problem, ...).
// Rendered as a <div> (not a link) so it can safely sit inside the train
// card's own <Link> — <a> inside <a> is invalid HTML.
export default function AlertBanner({ alert }) {
  const { lang } = useLang();
  if (!alert) return null;
  const note = lang === "bn" ? alert.noteBn || alert.note : alert.noteEn || alert.note;
  const type = lang === "bn" ? alert.typeBn : alert.typeEn;
  const sev = alert.severity >= 3 ? "high" : alert.severity === 2 ? "mid" : "low";
  return (
    <div className={"rk-alert-banner rk-alert-banner-" + sev} role="alert">
      <span className="rk-alert-banner-emoji" aria-hidden>
        {alert.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <b>{type}</b>
        <span className="rk-alert-banner-note">{note}</span>
      </span>
      <span className="rk-alert-banner-arrow" aria-hidden>
        ›
      </span>
    </div>
  );
}
