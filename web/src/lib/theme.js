export const getTheme = () =>
  localStorage.getItem("rk-theme") === "dark" ? "dark" : "light";

export function setThemeStored(v) {
  localStorage.setItem("rk-theme", v);
  window.dispatchEvent(new Event("rk-theme"));
}

export function onThemeChange(cb) {
  const h = () => cb(getTheme());
  window.addEventListener("rk-theme", h);
  return () => window.removeEventListener("rk-theme", h);
}
