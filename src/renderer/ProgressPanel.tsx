// Displays run state with continuously available cancellation.
import type { TaskState } from "../shared/task";
import { strings as s } from "./strings";
export function ProgressPanel({
  task,
  physical,
  onError,
}: {
  task: TaskState;
  physical: boolean;
  onError: (message: string) => void;
}) {
  const active = [
    "planning",
    "running",
    "waiting_for_approval",
    "stopping",
  ].includes(task.phase);
  const approve = async (allow: boolean) => {
    const result = await window.jinav.approve(allow);
    if (!result.ok) onError(result.error);
  };
  return (
    <section className="panel">
      <p className="eyebrow">{s.progress}</p>
      <h1>{task.phase.replaceAll("_", " ")}</h1>
      <p role="status" aria-live="polite">
        {task.message}
      </p>
      <p className="hint">{task.step > 0 ? `${task.step}` : ""}</p>
      {physical && active && <p className="physical">{s.physical}</p>}
      {task.phase === "waiting_for_approval" && (
        <div className="approval">
          <pre>{task.approval}</pre>
          <button onClick={() => void approve(true)}>{s.approve}</button>
          <button onClick={() => void approve(false)}>{s.decline}</button>
        </div>
      )}
      <button
        autoFocus
        className="danger"
        disabled={!active || task.phase === "stopping"}
        onClick={() => void window.jinav.stopTask()}
      >
        {s.stop}
      </button>
      <p className="hint">{s.stopHint}</p>
    </section>
  );
}
