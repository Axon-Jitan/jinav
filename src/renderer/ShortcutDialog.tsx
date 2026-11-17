// Captures a candidate shortcut; cancellation never changes the registered shortcut.
import { useRef, useEffect, useState } from "react";
import type { SettingsState } from "./useSettings";
import { strings as s } from "./strings";
export function ShortcutDialog({
  state,
  onClose,
}: {
  state: SettingsState;
  onClose: () => void;
}) {
  const root = useRef<HTMLDialogElement>(null);
  const [candidate, setCandidate] = useState("");
  useEffect(() => {
    root.current?.showModal();
  }, []);
  return (
    <dialog
      ref={root}
      className="shortcut-dialog"
      onCancel={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <h2>{s.shortcutCapture}</h2>
      <p className="hint">{s.shortcutHint}</p>
      <input
        autoFocus
        aria-label={s.shortcutCapture}
        placeholder={state.config.shortcut}
        readOnly
        value={candidate}
        onKeyDown={(e) => {
          if (e.key === "Tab" || e.key === "Escape") return;
          e.preventDefault();
          if (e.repeat || ["Control", "Alt", "Shift", "Meta"].includes(e.key))
            return;
          const modifiers = [
            e.ctrlKey ? "Ctrl" : "",
            e.altKey ? "Alt" : "",
            e.shiftKey ? "Shift" : "",
            e.metaKey ? "Meta" : "",
          ].filter(Boolean);
          if (!modifiers.length) return;
          const key =
            e.code === "Space"
              ? "Space"
              : e.key.length === 1
                ? e.key.toUpperCase()
                : e.key;
          setCandidate([...modifiers, key].join("+"));
        }}
      />
      <footer>
        <button onClick={onClose}>{s.cancel}</button>
        <button
          className="primary"
          disabled={!candidate || state.busy}
          onClick={() =>
            void state.update({ shortcut: candidate }).then((ok) => {
              if (ok) onClose();
            })
          }
        >
          {s.confirm}
        </button>
      </footer>
    </dialog>
  );
}
