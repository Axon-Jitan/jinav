// Lists permitted window metadata only after the user explicitly changes context.
import { useEffect, useRef, useState } from "react";
import type { TargetWindow } from "../shared/task";
import type { Config } from "../shared/config";
import { strings as s } from "./strings";
import { supportsTaskTarget } from "../shared/supportsTaskTarget";
import { supportsTaskApp } from "../shared/appAccess";
export function ContextPicker({
  config,
  onChoose,
  onClose,
  onError,
}: {
  config: Config;
  onChoose: (target: TargetWindow | undefined) => void;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const root = useRef<HTMLDialogElement>(null);
  const [windows, setWindows] = useState<TargetWindow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    root.current?.showModal();
    let alive = true;
    void Promise.all([
      window.jinav.windows(),
      config.appAccess === "all"
        ? window.jinav.discover()
        : Promise.resolve({ ok: true as const, value: config.allowedApps }),
    ]).then(([r, apps]) => {
      if (!alive) return;
      if (r.ok && apps.ok)
        setWindows(
          r.value
            .filter(supportsTaskTarget)
            .filter((w) =>
              apps.value
                .filter(supportsTaskApp)
                .some(
                  (e) =>
                    e.path.split(/[\\/]/).at(-1)?.toLowerCase() ===
                    w.app.toLowerCase(),
                ),
            ),
        );
      else onError(!r.ok ? r.error : !apps.ok ? apps.error : s.noResults);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [config.allowedApps, config.appAccess, onError]);
  return (
    <dialog
      ref={root}
      className="context-picker"
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
      <h2>{s.context}</h2>
      <button
        onClick={() => {
          onChoose(undefined);
          onClose();
        }}
      >
        {s.chooseApplicationAutomatically}
      </button>
      {loading ? (
        <p className="hint">{s.loading}</p>
      ) : (
        windows.map((w) => (
          <button
            key={w.id}
            onClick={() => {
              onChoose(w);
              onClose();
            }}
          >
            {w.app}
            <small>{w.title}</small>
          </button>
        ))
      )}
      <button onClick={onClose}>{s.cancel}</button>
    </dialog>
  );
}
