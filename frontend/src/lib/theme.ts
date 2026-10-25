const KEY = "tj-theme";
export type Theme = "light" | "dark";

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(KEY);
  return v === "dark" || v === "light" ? v : null;
}

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", t === "dark");
}

export function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(t: Theme): Theme {
  localStorage.setItem(KEY, t);
  applyTheme(t);
  return t;
}

export function toggleTheme(): Theme {
  return setTheme(currentTheme() === "dark" ? "light" : "dark");
}