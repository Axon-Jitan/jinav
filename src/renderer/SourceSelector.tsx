// Provides the approved four source modes with accessible descriptions.
import { useEffect, useRef, useState } from "react";
import type { Config } from "../shared/config";
import { strings as s } from "./strings";
export function SourceSelector({
  value,
  disabled,
  onChange,
}: {
  value: Config["appSource"];
  disabled: boolean;
  onChange: (value: Config["appSource"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const modes = Object.keys(s.sourceNames) as Config["appSource"][];
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const focus = (index: number) => {
    root.current
      ?.querySelectorAll<HTMLButtonElement>("[role=option]")
      [(index + modes.length) % modes.length]?.focus();
  };
  return (
    <div
      ref={root}
      className="source-selector"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        } else if (["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          if (!open) {
            setOpen(true);
            return;
          }
          const options = Array.from(
            root.current?.querySelectorAll("[role=option]") ?? [],
          );
          const current = options.indexOf(document.activeElement as Element);
          focus(
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? 3
                : current + (e.key === "ArrowDown" ? 1 : -1),
          );
        }
      }}
    >
      <button
        ref={trigger}
        className="source-trigger"
        role="combobox"
        aria-label={s.showOnWheel}
        aria-expanded={open}
        aria-controls="app-source-options"
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {s.sourceNames[value]}
        <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div id="app-source-options" role="listbox" aria-label={s.showOnWheel}>
          {modes.map((mode) => (
            <button
              key={mode}
              role="option"
              aria-selected={mode === value}
              onClick={() => {
                setOpen(false);
                onChange(mode);
                trigger.current?.focus();
              }}
            >
              <span>{s.sourceNames[mode]}</span>
              <small>{s.sourceDescriptions[mode]}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
