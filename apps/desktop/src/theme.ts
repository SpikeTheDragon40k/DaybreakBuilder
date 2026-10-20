import { isTauri, settings } from "./platform";

export type Theme = "system" | "light" | "dark";

export function storedTheme(): Theme {
  const t = settings.get<Theme>("theme", "system");
  return t === "light" || t === "dark" ? t : "system";
}

/** Apply a theme to the document (and the native window frame on desktop). */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  if (isTauri) {
    void import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => getCurrentWindow().setTheme(theme === "system" ? null : theme))
      .catch(() => {
        /* older webviews: the page theme still applies */
      });
  }
}

export function setTheme(theme: Theme): void {
  settings.set("theme", theme);
  applyTheme(theme);
}
