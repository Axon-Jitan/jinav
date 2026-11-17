// Collects a task without observing UI content before explicit submission.
import { useState } from "react";
import type { Bootstrap } from "../shared/bridge";
import { strings as s } from "./strings";
import type { TargetWindow } from "../shared/task";
import { ContextPicker } from "./ContextPicker";
import { BrandLogo } from "./BrandLogo";
export function PromptPanel({
  bootstrap,
  onError,
}: {
  bootstrap: Bootstrap;
  onError: (message: string) => void;
}) {
  const [goal, setGoal] = useState("");
  const [target, setTarget] = useState<TargetWindow | undefined>(
    bootstrap.origin,
  );
  const [picking, setPicking] = useState(false);
  const [output, setOutput] = useState("");
  const c = bootstrap.config;
  const targetAllowed =
    !target ||
    c.appAccess === "all" ||
    c.allowedApps.some(
      (e) =>
        e.path.split(/[\\/]/).at(-1)?.toLowerCase() ===
        target.app.toLowerCase(),
    );
  const ready =
    c.aiEnabled &&
    (bootstrap.modelConnected || bootstrap.modelProvisioned) &&
    !bootstrap.desktopUnavailable &&
    c.cloudConsent &&
    (c.appAccess === "all" || c.allowedApps.length > 0) &&
    targetAllowed &&
    (!c.pauseOnUserInput || bootstrap.inputMonitoring);
  return (
    <section className="prompt-panel">
      <header className="ask-header">
        <BrandLogo />
        <strong>{s.ask}</strong>
        <button aria-label={s.close} onClick={() => void window.jinav.hide()}>
          ×
        </button>
      </header>
      <textarea
        autoFocus
        aria-label={s.prompt}
        placeholder={s.prompt}
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        maxLength={8000}
      />
      <div className="prompt-actions">
        <button
          className="context-button"
          title={s.context}
          onClick={() => setPicking(true)}
        >
          {target?.app ?? s.noContext}
        </button>
        <button
          className="primary"
          disabled={!ready || !goal.trim()}
          onClick={() =>
            void window.jinav
              .startTask({
                goal,
                target,
                verificationFile: output || undefined,
              })
              .then((r) => {
                if (!r.ok) onError(r.error);
              })
          }
        >
          {s.run}
        </button>
      </div>
      {!ready && (
        <button
          className="text-button setup-link"
          onClick={() => void window.jinav.settings()}
        >
          {s.setup}
        </button>
      )}
      <details className="verification-details">
        <summary>{s.output}</summary>
        <button
          onClick={() =>
            void window.jinav.chooseVerificationFile().then((r) => {
              if (r.ok) setOutput(r.value);
              else onError(r.error);
            })
          }
        >
          {output || s.chooseOutput}
        </button>
      </details>
      {picking && (
        <ContextPicker
          config={c}
          onChoose={setTarget}
          onClose={() => setPicking(false)}
          onError={onError}
        />
      )}
    </section>
  );
}
