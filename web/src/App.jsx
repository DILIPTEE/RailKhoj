import { useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { LangProvider, useLang } from "./i18n.jsx";
import { getTheme, onThemeChange, setThemeStored } from "./lib/theme.js";
import Header from "./components/Header.jsx";
import Home from "./pages/Home.jsx";
import TrainDetail from "./pages/TrainDetail.jsx";
import Search from "./pages/Search.jsx";

function Footer() {
  const { t } = useLang();
  return (
    <footer className="mt-16 border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500 dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-300">
          রেলখোঁজ · RailKhoj
        </p>
        <p className="mt-2">{t("approxNote")}</p>
        <p className="mt-2">
          Not affiliated with Bangladesh Railway · Built with ❤️ for BD
          passengers
        </p>
      </div>
    </footer>
  );
}

function NotFound() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 text-center">
      <p className="text-5xl">🚉</p>
      <h1 className="mt-4 text-2xl font-bold">404 — {t("notFound")}</h1>
      <Link
        to="/"
        className="mt-6 inline-block rounded-xl bg-brand-700 px-5 py-2.5 font-semibold text-white hover:bg-brand-800"
      >
        ← {t("navHome")}
      </Link>
    </div>
  );
}

function Shell() {
  const { lang } = useLang();
  const [theme, setTheme] = useState(getTheme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  useEffect(() => onThemeChange(setTheme), []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header theme={theme} setTheme={setThemeStored} />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/train/:id" element={<TrainDetail />} />
          <Route path="/search" element={<Search />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <LangProvider>
      <Shell />
    </LangProvider>
  );
}
