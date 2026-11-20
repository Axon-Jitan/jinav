// Renders a populated compact wheel; explicit activation is required.
import { useEffect, useRef, useState } from "react";
import type { AppEntry, Config } from "../shared/config";
import { wheelLayout } from "../shared/wheelLayout";
import { strings as s } from "./strings";
import gear from "./assets/settings.svg";
import { BrandLogo } from "./BrandLogo";
import { wheelPages } from "../shared/wheelPages";
import { PreviewLabel } from "./PreviewLabel";
export function RadialMenu({
  config,
  apps = config.apps,
  launch,
  ask,
  preview = false,
  radius = config.menuRadius,
}: {
  config: Config;
  apps?: readonly AppEntry[];
  launch: (id: string) => void;
  ask: () => void;
  preview?: boolean;
  radius?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string>();
  const [page, setPage] = useState(0);
  const paging = wheelPages(apps, page);
  const lastPageMove = useRef(-Infinity);
  const changePage = (direction: number) => {
    setActive(undefined);
    setPage((paging.page + direction + paging.count) % paging.count);
    if (!preview) root.current?.focus();
  };
  const geometry = wheelLayout(paging.apps, config.showAsk, radius);
  useEffect(() => {
    if (!preview)
      void window.jinav.tooltip(
        config.appNames === "hidden" ? null : (active ?? null),
        paging.page,
      );
    return () => {
      if (!preview) void window.jinav.tooltip(null);
    };
  }, [active, preview, config.appNames, paging.page]);
  useEffect(() => {
    if (!preview) root.current?.focus();
  }, [preview]);
  const entries = geometry.entries.map((entry) => ({
    ...entry,
    name:
      entry.kind === "app"
        ? entry.app.name
        : entry.kind === "ask"
          ? s.ask
          : s.settings,
    icon:
      entry.kind === "app"
        ? entry.app.icon
        : entry.kind === "settings"
          ? gear
          : undefined,
  }));
  const navigate = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      changePage(event.key === "PageDown" ? 1 : -1);
      return;
    }
    if (preview) return;
    const forward =
      event.key === "Tab"
        ? !event.shiftKey
        : ["ArrowRight", "ArrowDown"].includes(event.key);
    if (
      ![
        "ArrowRight",
        "ArrowDown",
        "ArrowLeft",
        "ArrowUp",
        "Tab",
        "Home",
        "End",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    if (event.repeat) return;
    const buttons = Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>(
        "button.slot,button.wheel-page",
      ) ?? [],
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : index < 0
            ? forward
              ? 0
              : buttons.length - 1
            : (index + (forward ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  return (
    <div
      ref={root}
      className={`radial icons-${config.iconSize} background-${config.menuBackground} ${preview ? "preview-wheel" : ""}`}
      style={{ width: geometry.size, height: geometry.size }}
      onKeyDown={navigate}
      onWheel={(event) => {
        if (
          !preview &&
          paging.count > 1 &&
          Math.abs(event.deltaY) > 10 &&
          performance.now() - lastPageMove.current > 250
        ) {
          lastPageMove.current = performance.now();
          changePage(event.deltaY > 0 ? 1 : -1);
        }
      }}
      role="group"
      aria-label={
        preview
          ? `${s.preview}: ${paging.apps.map((e) => e.name).join(", ")}, ${s.settings}`
          : s.name
      }
      tabIndex={-1}
    >
      {entries.map((entry) => {
        const point = entry.point;
        return (
          <button
            key={`${entry.kind}:${entry.id}`}
            className={`slot ${entry.kind === "ask" ? "ask-slot" : ""}`}
            style={{ left: point[0], top: point[1] }}
            aria-label={entry.name}
            tabIndex={preview ? -1 : 0}
            onMouseEnter={() => setActive(entry.id)}
            onMouseLeave={() => setActive(undefined)}
            onFocus={() => setActive(entry.id)}
            onBlur={() => setActive(undefined)}
            onClick={() => {
              if (preview) return;
              if (entry.kind === "ask") ask();
              else if (entry.kind === "settings") void window.jinav.settings();
              else launch(entry.id);
            }}
          >
            {entry.kind === "ask" ? (
              <BrandLogo />
            ) : entry.icon ? (
              <img
                src={entry.icon}
                alt=""
                className={entry.kind === "settings" ? "gear" : ""}
              />
            ) : (
              <span className="app-fallback" aria-hidden="true">
                {entry.name.slice(0, 1)}
              </span>
            )}
          </button>
        );
      })}
      {preview &&
        config.appNames !== "hidden" &&
        entries
          .filter((entry) => entry.id === active)
          .map((entry) => {
            const point = entry.point;
            return point ? (
              <PreviewLabel
                key={entry.id}
                text={entry.name}
                point={point}
                size={geometry.size}
                position={config.labelPosition}
              />
            ) : null;
          })}
      {paging.count > 1 && (
        <button
          className="wheel-page"
          aria-label={`${s.nextApps} (${paging.page + 1}/${paging.count})`}
          title={s.wheelPagesHint}
          onMouseEnter={() => setActive(undefined)}
          onFocus={() => setActive(undefined)}
          onClick={() => changePage(1)}
        >
          <span>
            {paging.page + 1}/{paging.count}
          </span>
          <span aria-hidden="true">›</span>
        </button>
      )}
      {!apps.length && (
        <span className="wheel-empty">
          {config.appSource === "running" ? s.noRunning : s.add}
        </span>
      )}
    </div>
  );
}
