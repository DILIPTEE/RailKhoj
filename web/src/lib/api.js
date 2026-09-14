const API = import.meta.env.VITE_API_URL || "/api";

export async function getJSON(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

export async function postJSON(path, body) {
  const r = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

export const stationName = (s, lang) =>
  !s ? "" : lang === "bn" ? s.nameBn || s.nameEn : s.nameEn;

export function fmtDuration(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function fmtEta(min) {
  if (min == null) return "";
  if (min < 1) return "<1m";
  if (min < 60) return Math.round(min) + "m";
  return Math.floor(min / 60) + "h " + Math.round(min % 60) + "m";
}
