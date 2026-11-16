// Owns renderer application state through the typed bridge.
import { useCallback, useEffect, useState } from "react";
import type { Bootstrap, Result } from "../shared/bridge";
import type { TaskState, TargetWindow } from "../shared/task";
export function useJinav() {
  const [bootstrap, setBootstrap] = useState<Bootstrap>();
  const [view, setView] = useState("menu");
  const [error, setError] = useState("");
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
    const offView = window.jinav.onView((next) => {
      setView(next);
      setChooser(undefined);
      setError("");
      void reload();
    });
    return () => {
      offTask();
      offView();
    };
  }, [reload, result]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && view !== "progress")
        void window.jinav.hide();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [view]);
  const launch = async (id: string, windowId?: string) => {
    setError("");
    const windows = result(await window.jinav.launch(id, windowId));
    if (windows?.length) setChooser({ id, windows });
    else setChooser(undefined);
  };
  return {
    bootstrap,
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
