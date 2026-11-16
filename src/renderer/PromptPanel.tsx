// Renders the task's goal and authorized target selection.
import type { Config } from "../shared/config";
import { strings as s } from "./strings";
import { usePrompt } from "./usePrompt";
export function PromptPanel({
  config,
  onError,
}: {
  config: Config;
  onError: (message: string) => void;
}) {
  const state = usePrompt(onError);
  return (
    <section className="panel">
      <p className="eyebrow">{s.ask}</p>
      <h1>{s.prompt}</h1>
      <label>
        {s.context}
        <select
          value={state.target}
          onChange={(e) => state.setTarget(e.target.value)}
        >
          <option value="">{s.windows}</option>
          {state.windows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.app} — {w.title}
            </option>
          ))}
        </select>
      </label>
      <button className="subtle" onClick={() => void state.refresh()}>
        {s.refresh}
      </button>
      <p className="hint">{s.contextHint}</p>
      <textarea
        autoFocus
        rows={4}
        value={state.goal}
        onChange={(e) => state.setGoal(e.target.value)}
        placeholder={s.goalPlaceholder}
        maxLength={8000}
        aria-label={s.prompt}
      />
      <button className="subtle" onClick={() => void state.chooseOutput()}>
        {s.chooseOutput}
      </button>
      {state.output && (
        <p className="hint">
          {s.output}: {state.output}
        </p>
      )}
      <p className="hint">{s.cloud}</p>
      {config.physicalInput && <p className="physical">{s.physical}</p>}
      {!config.aiEnabled && <p role="status">{s.disabled}</p>}
      <button
        className="primary"
        disabled={!config.aiEnabled || !state.goal.trim() || !state.target}
        onClick={() => void state.submit()}
      >
        {s.submit}
      </button>
    </section>
  );
}
