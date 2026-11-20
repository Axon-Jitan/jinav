// Collects a task without observing UI content before explicit submission.
import { useState } from "react";
import type { Bootstrap } from "../shared/bridge";
import { strings as s } from "./strings";
import { usePrompt } from "./usePrompt";
import { ContextPicker } from "./ContextPicker";
import { BrandLogo } from "./BrandLogo";
export function PromptPanel({
  bootstrap,
  onError,
  goal,
  onGoalChange,
}: {
  bootstrap: Bootstrap;
  goal: string;
  onGoalChange: (goal: string) => void;
  onError: (message: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [output, setOutput] = useState("");
  const c = bootstrap.config;
  const { target, setTarget, starting, issue, settings, submit } = usePrompt(
    bootstrap,
    goal,
    onGoalChange,
    onError,
  );
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
        onChange={(e) => onGoalChange(e.target.value)}
        maxLength={8000}
      />
      <div className="prompt-actions">
        <button
          className="context-button"
          title={s.context}
          onClick={() => setPicking(true)}
        >
          {target?.app ?? s.chooseApplicationAutomatically}
        </button>
        <button
          className="primary"
          disabled={!goal.trim() || starting}
          onClick={() => void submit(output)}
        >
          {starting ? s.startingTask : s.run}
        </button>
      </div>
      {issue && (
        <div className="prompt-setup">
          <p className="hint" role="status">
            {issue}
          </p>
          <button
            className="text-button setup-link"
            onClick={() => void settings()}
          >
            {s.setup}
          </button>
        </div>
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
