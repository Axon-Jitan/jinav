// Selects the active jinav surface; owns no operating-system logic.
import { useJinav } from "./useJinav";
import { useLayoutEffect, useRef } from "react";
import { RadialMenu } from "./RadialMenu";
import { SettingsPanel } from "./SettingsPanel";
import { PromptPanel } from "./PromptPanel";
import { ProgressPanel } from "./ProgressPanel";
import { strings as s } from "./strings";
import { useTheme } from "./useTheme";
export function App() {
  const state = useJinav();
  useTheme(state.bootstrap?.config.theme);
  const hasActiveTask = [
    "planning",
    "running",
    "paused",
    "waiting_for_approval",
    "stopping",
  ].includes(state.task.phase);
  const shell = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (shell.current) shell.current.scrollTop = 0;
    if (state.session) void window.jinav.viewReady(state.session);
  }, [state.view, state.session]);
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
        <PromptPanel bootstrap={state.bootstrap} onError={state.setError} />
      ) : state.view === "progress" ? (
        <ProgressPanel
          task={state.task}
          physical={state.bootstrap.config.physicalInput}
          onError={state.setError}
        />
      ) : (
        <RadialMenu
          key={state.session}
          config={state.bootstrap.config}
          apps={state.bootstrap.wheelApps ?? state.bootstrap.config.apps}
          radius={
            state.bootstrap.wheelRadius ?? state.bootstrap.config.menuRadius
          }
          launch={(id) => void state.launch(id)}
          ask={() => void window.jinav.prompt()}
        />
      )}
    </main>
  );
}
