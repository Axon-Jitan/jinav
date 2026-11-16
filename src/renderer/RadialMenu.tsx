// Renders stable application slots around a neutral centre.
import type { Config } from "../shared/config";
import { strings as s } from "./strings";
export function RadialMenu({
  config,
  launch,
  ask,
}: {
  config: Config;
  launch: (id: string) => void;
  ask: () => void;
}) {
  const navigate = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      ![
        "ArrowRight",
        "ArrowDown",
        "ArrowLeft",
        "ArrowUp",
        "Home",
        "End",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button.slot"),
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const direction = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + direction + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  return (
    <div
      className="radial"
      onKeyDown={navigate}
      role="group"
      aria-label={s.name}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) void window.jinav.hide();
      }}
    >
      <div className="orbit" />
      <div className="neutral">
        <strong>{s.name}</strong>
        <span>{s.tagline}</span>
      </div>
      {[{ id: "ask", name: s.ask, icon: undefined }, ...config.apps].map(
        (entry, index) => {
          const angle = ((-90 + (index * 360) / 7) * Math.PI) / 180;
          return (
            <button
              key={entry.id}
              className={`slot ${index === 0 ? "ask-slot" : ""}`}
              autoFocus={index === 0}
              style={{
                left: 210 + 132 * Math.cos(angle),
                top: 198 + 132 * Math.sin(angle),
              }}
              onClick={() => (index === 0 ? ask() : launch(entry.id))}
              aria-label={entry.name}
            >
              {entry.icon ? (
                <img src={entry.icon} alt="" />
              ) : (
                <span className="app-glyph" aria-hidden="true">
                  {index === 0 ? "✦" : entry.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span>{entry.name}</span>
            </button>
          );
        },
      )}
      {!config.apps.length && <p className="empty-ring">{s.add}</p>}
      <button
        className="menu-settings"
        onClick={() => void window.jinav.settings()}
      >
        {s.settings}
      </button>
      <small className="radial-hint">{s.escape}</small>
    </div>
  );
}
