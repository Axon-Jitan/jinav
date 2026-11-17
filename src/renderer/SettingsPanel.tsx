// Composes the four approved settings pages in a dedicated desktop window.
import { useEffect, useState } from "react";
import type { Bootstrap } from "../shared/bridge";
import { strings as s } from "./strings";
import { useSettings } from "./useSettings";
import { MenuSettings } from "./MenuSettings";
import { GeneralSettings } from "./GeneralSettings";
import { AskSettings } from "./AskSettings";
import { WindowControls } from "./WindowControls";
import { BrandLogo } from "./BrandLogo";
export function SettingsPanel({
  bootstrap,
  onSaved,
  onError,
}: {
  bootstrap: Bootstrap;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [page, setPage] = useState<"menu" | "general" | "appearance" | "ask">(
    "menu",
  );
  const state = useSettings(bootstrap.config, onSaved, onError);
  useEffect(
    () =>
      window.jinav.onView((view) => {
        if (view === "settings") setPage("menu");
      }),
    [],
  );
  const titles = {
    menu: s.menu,
    general: s.general,
    appearance: s.appearance,
    ask: s.ask,
  };
  const subtitles = {
    menu: s.menuSubtitle,
    general: s.generalSubtitle,
    appearance: s.appearanceSubtitle,
    ask: s.askSubtitle,
  };
  return (
    <section className="settings-layout">
      <aside className="settings-sidebar">
        <div className="brand">
          <BrandLogo />
          {s.name}
        </div>
        <p className="hint">{s.settings}</p>
        <nav aria-label={s.settings}>
          {(Object.keys(titles) as (keyof typeof titles)[]).map((id) => (
            <button
              key={id}
              aria-current={page === id ? "page" : undefined}
              onClick={() => setPage(id)}
            >
              {titles[id]}
            </button>
          ))}
        </nav>
        <small className="sidebar-status" role="status">
          {state.busy ? s.loading : state.message}
        </small>
      </aside>
      <div
        className={`settings-content ${page === "ask" ? "ask-settings" : ""}`}
      >
        <header className="settings-title">
          <div>
            <h1>{titles[page]}</h1>
            <p className="hint">{subtitles[page]}</p>
          </div>
          <WindowControls />
        </header>
        {bootstrap.notice && (
          <p className="notice" role="status">
            {bootstrap.notice}
          </p>
        )}
        {page === "menu" ? (
          <MenuSettings state={state} />
        ) : page === "general" ? (
          <GeneralSettings state={state} />
        ) : page === "appearance" ? (
          <MenuSettings state={state} appearance />
        ) : (
          <AskSettings state={state} bootstrap={bootstrap} />
        )}
      </div>
    </section>
  );
}
