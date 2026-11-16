// Selects the active jinav surface; owns no operating-system logic.
import { useJinav } from "./useJinav";
import { useLayoutEffect, useRef } from "react";
import { RadialMenu } from "./RadialMenu";
import { SettingsPanel } from "./SettingsPanel";
import { PromptPanel } from "./PromptPanel";
import { ProgressPanel } from "./ProgressPanel";
import { strings as s } from "./strings";
export function App() {
  const state = useJinav();
  const hasActiveTask = [
    "planning",
    "running",
    "waiting_for_approval",
    "stopping",
  ].includes(state.task.phase);
  const shell = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (shell.current) shell.current.scrollTop = 0;
  }, [state.view]);
  if (!state.bootstrap)
    return (
      <main className="shell">
        <p>{s.loading}</p>
      </main>
    );
  return (
    <main
      ref={shell}
      className={`shell ${state.view === "menu" ? "menu-shell" : ""} ${state.bootstrap.config.reducedMotion ? "reduced-motion" : ""}`}
    >
      {state.view !== "menu" && (
        <header>
          <strong>{s.name}</strong>
          <button onClick={() => void window.jinav.hide()} aria-label={s.close}>
            ×
          </button>
        </header>
      )}
      {state.error && (
        <div className="error" role="alert">
          {state.error}
        </div>
      )}
      {hasActiveTask && state.view !== "progress" && (
        <button
          className="global-stop danger"
          onClick={() => void window.jinav.stopTask()}
        >
          {s.stop}
        </button>
      )}
      {state.chooser ? (
        <section className="panel">
          <h1>{s.windows}</h1>
          {state.chooser.windows.map((w) => (
            <button
              key={w.id}
              onClick={() => void state.launch(state.chooser?.id ?? "", w.id)}
            >
              {w.title}
            </button>
          ))}
        </section>
      ) : state.view === "settings" ? (
        <SettingsPanel
          bootstrap={state.bootstrap}
          onSaved={state.reload}
          onError={state.setError}
        />
      ) : state.view === "prompt" ? (
        <PromptPanel config={state.bootstrap.config} onError={state.setError} />
      ) : state.view === "progress" ? (
        <ProgressPanel
          task={state.task}
          physical={state.bootstrap.config.physicalInput}
          onError={state.setError}
        />
      ) : (
        <RadialMenu
          config={state.bootstrap.config}
          launch={(id) => void state.launch(id)}
          ask={() => state.setView("prompt")}
        />
      )}
    </main>
  );
}
