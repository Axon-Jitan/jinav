// Owns renderer application state through the typed bridge.
import { useCallback, useEffect, useState } from "react";
import type { Bootstrap, Result } from "../shared/bridge";
import type { TaskState, TargetWindow } from "../shared/task";
export function useJinav() {
  const [bootstrap, setBootstrap] = useState<Bootstrap>();
  const [view, setView] = useState(
    new URLSearchParams(location.search).get("view") ?? "menu",
  );
  const [error, setError] = useState("");
  const [session, setSession] = useState("");
  const [task, setTask] = useState<TaskState>({
    runId: "",
    phase: "idle",
    message: "",
    step: 0,
  });
  const [chooser, setChooser] = useState<{
    id: string;
    windows: TargetWindow[];
  }>();
  const result = useCallback(<T>(value: Result<T>): T | undefined => {
    if (!value.ok) {
      setError(value.error);
      return;
    }
    return value.value;
  }, []);
  const reload = useCallback(async () => {
    const data = result(await window.jinav.bootstrap());
    if (data) setBootstrap(data);
  }, [result]);
  useEffect(() => {
    void window.jinav.bootstrap().then((value) => {
      const data = result(value);
      if (data) setBootstrap(data);
    });
    void window.jinav.taskState().then((value) => {
      const state = result(value);
      if (state) setTask(state);
    });
    const offTask = window.jinav.onTask(setTask);
    const offView = window.jinav.onView((next, token) => {
      void window.jinav.bootstrap().then((value) => {
        const data = result(value);
        if (!data) return;
        setBootstrap(data);
        setView(next);
        setSession(token ?? "");
        setChooser(undefined);
        setError("");
      });
    });
    return () => {
      offTask();
      offView();
    };
  }, [reload, result]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (
        [
          "planning",
          "running",
          "paused",
          "waiting_for_approval",
          "stopping",
        ].includes(task.phase)
      )
        void window.jinav.stopTask();
      else void window.jinav.hide();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [view, task.phase]);
  const launch = async (id: string, windowId?: string) => {
    setError("");
    const windows = result(await window.jinav.launch(id, windowId));
    if (windows?.length) setChooser({ id, windows });
    else setChooser(undefined);
  };
  return {
    bootstrap,
    session,
    view,
    setView,
    error,
    setError,
    task,
    chooser,
    launch,
    reload,
    result,
  };
}
