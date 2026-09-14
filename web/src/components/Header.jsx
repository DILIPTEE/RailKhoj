import { Link, NavLink } from "react-router-dom";
import { useLang } from "../i18n.jsx";

export default function Header({ theme, setTheme }) {
  const { lang, setLang, t } = useLang();
  const navCls = ({ isActive }) =>
    "rounded-lg px-3 py-1.5 text-sm font-semibold transition " +
    (isActive
      ? "bg-brand-700 text-white"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800");

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img src="/icon.svg" alt="" className="h-9 w-9 rounded-xl" />
          <span className="leading-tight">
            <span className="block text-lg font-extrabold text-brand-700 dark:text-brand-200">
              {t("brand")}
            </span>
            <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t("tagline")}
            </span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 sm:flex">
          <NavLink to="/" end className={navCls}>
            {t("navHome")}
          </NavLink>
          <NavLink to="/search" className={navCls}>
            {t("navSearch")}
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setLang(lang === "bn" ? "en" : "bn")}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            title="বাংলা / English"
          >
            {lang === "bn" ? "EN" : "বাংলা"}
          </button>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            title="Theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </div>
    </header>
  );
}
