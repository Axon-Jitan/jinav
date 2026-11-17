// Applies the saved palette, including live operating-system theme changes.
import { useEffect } from "react";
import type { Config } from "../shared/config";
export function useTheme(theme: Config["theme"] = "light") {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}
