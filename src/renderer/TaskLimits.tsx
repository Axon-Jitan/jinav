// Renders task execution limits independently of IT model provisioning.
import type { SettingsState } from "./useSettings";
import { strings as s } from "./strings";
export function TaskLimits({ state }: { state: SettingsState }) {
  return (
    <details className="task-limits">
      <summary>{s.taskLimits}</summary>
      <div className="limits">
        {(
          [
            ["maxSteps", s.steps, 1, 100],
            ["maxSeconds", s.seconds, 10, 1800],
            ["maxTokens", s.tokens, 1000, 100000],
          ] as const
        ).map(([name, label, min, max]) => (
          <label key={name}>
            {label}
            <input
              aria-label={label}
              type="number"
              min={min}
              max={max}
              defaultValue={state.config[name]}
              disabled={state.busy}
              onBlur={(e) => {
                const field = e.currentTarget;
                const previous = state.config[name];
                if (Number(field.value) !== previous)
                  void state
                    .update({ [name]: Number(field.value) })
                    .then((ok) => {
                      if (!ok) field.value = String(previous);
                    });
              }}
            />
          </label>
        ))}
      </div>
    </details>
  );
}
