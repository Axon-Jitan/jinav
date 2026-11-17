// Captures a candidate shortcut; cancellation never changes the registered shortcut.
import { useRef, useEffect, useState } from "react";
import type { SettingsState } from "./useSettings";
import { strings as s } from "./strings";
import { shortcutInput, shortcutFromKey } from "../shared/shortcutInput";
export function ShortcutDialog({
  state,
  onClose,
}: {
  state: SettingsState;
  onClose: () => void;
}) {
  const root = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const [candidate, setCandidate] = useState(state.config.shortcut);
  const [recording, setRecording] = useState(true);
  const listening = useRef(true);
  const [attempted, setAttempted] = useState(false);
  const normalized = shortcutInput(candidate);
  const error = !normalized ? s.shortcutInvalid : attempted ? state.error : "";
  const { onError } = state;
  useEffect(() => {
    const dialog = root.current;
    dialog?.showModal();
    field.current?.focus();
    const off = window.jinav.onShortcutRecorded((key) => {
      if (!listening.current) return;
      setCandidate(key);
      setAttempted(false);
      listening.current = false;
      setRecording(false);
    });
    void window.jinav.shortcutCapture(true).then((result) => {
      if (!result.ok) onError(result.error);
    });
    return () => {
      off();
      dialog?.close();
      void window.jinav.shortcutCapture(false);
    };
  }, [onError]);
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
      <p className="hint" id="shortcut-hint">
        {s.shortcutManualHint}
      </p>
      <div className="shortcut-recording">
        <span role="status">
          {recording ? s.shortcutListening : s.shortcutHint}
        </span>
        <button
          type="button"
          disabled={state.busy}
          onClick={() => {
            listening.current = !recording;
            setRecording(!recording);
            field.current?.focus();
            if (recording) field.current?.select();
          }}
        >
          {recording ? s.shortcutType : s.shortcutRecord}
        </button>
      </div>
      <input
        ref={field}
        aria-label={s.shortcutCapture}
        aria-describedby={
          error ? "shortcut-hint shortcut-error" : "shortcut-hint"
        }
        aria-invalid={!!error}
        readOnly={recording}
        disabled={state.busy}
        value={candidate}
        onChange={(e) => {
          setCandidate(e.target.value);
          setAttempted(false);
        }}
        onKeyDown={(e) => {
          if (!recording) return;
          if (e.key === "Tab" || e.key === "Escape") return;
          e.preventDefault();
          const key = shortcutFromKey(e);
          if (!key) return;
          setCandidate(key);
          setAttempted(false);
          listening.current = false;
          setRecording(false);
        }}
      />
      {error && (
        <p id="shortcut-error" className="shortcut-error" role="alert">
          {error}
        </p>
      )}
      <footer>
        <button onClick={onClose}>{s.cancel}</button>
        <button
          className="primary"
          disabled={!normalized || state.busy}
          onClick={() => {
            if (!normalized) return;
            setAttempted(true);
            const shortcut =
              normalized === shortcutInput(state.config.shortcut)
                ? state.config.shortcut
                : normalized;
            void state.update({ shortcut }).then((ok) => {
              if (ok) onClose();
            });
          }}
        >
          {s.confirm}
        </button>
      </footer>
    </dialog>
  );
}
