// Exposes native settings-window commands without granting generic window access.
import { useEffect, useState } from "react";
import { strings as s } from "./strings";
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const refresh = () => {
      void window.jinav.settingsWindow("state").then((r) => {
        if (r.ok) setMaximized(r.value.maximized);
      });
    };
    refresh();
    window.addEventListener("resize", refresh);
    return () => window.removeEventListener("resize", refresh);
  }, []);
  const command = (value: "minimize" | "maximize" | "close") => {
    void window.jinav.settingsWindow(value).then((r) => {
      if (r.ok) setMaximized(r.value.maximized);
    });
  };
  return (
    <div className="window-controls">
      <button
        title={s.minimize}
        aria-label={s.minimize}
        onClick={() => command("minimize")}
      >
        <span aria-hidden="true" className="window-symbol minimize-symbol" />
      </button>
      <button
        title={maximized ? s.restoreWindow : s.maximize}
        aria-label={maximized ? s.restoreWindow : s.maximize}
        onClick={() => command("maximize")}
      >
        <span
          aria-hidden="true"
          className={`window-symbol ${maximized ? "restore-symbol" : "maximize-symbol"}`}
        />
      </button>
      <button
        className="window-close"
        title={s.close}
        aria-label={s.close}
        onClick={() => command("close")}
      >
        <span aria-hidden="true" className="window-symbol close-symbol" />
      </button>
    </div>
  );
}
