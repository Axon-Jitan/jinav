// Coordinates explicit task submission with user-selected context.
import { useEffect, useState } from "react";
import type { TargetWindow } from "../shared/task";
export function usePrompt(onError: (message: string) => void) {
  const [windows, setWindows] = useState<TargetWindow[]>([]);
  const [target, setTarget] = useState("");
  const [goal, setGoal] = useState("");
  const [output, setOutput] = useState("");
  const refresh = async () => {
    const value = await window.jinav.windows();
    if (!value.ok) {
      onError(value.error);
      return;
    }
    setWindows(value.value);
    const focused = value.value.find(
      (w) => (w as TargetWindow & { focused?: boolean }).focused,
    );
    setTarget(focused?.id ?? value.value[0]?.id ?? "");
  };
  useEffect(() => {
    let alive = true;
    void window.jinav.windows().then((value) => {
      if (!alive) return;
      if (!value.ok) {
        onError(value.error);
        return;
      }
      setWindows(value.value);
      setTarget(value.value[0]?.id ?? "");
    });
    return () => {
      alive = false;
    };
  }, [onError]);
  const chooseOutput = async () => {
    const value = await window.jinav.chooseVerificationFile();
    if (value.ok) setOutput(value.value);
    else onError(value.error);
  };
  const submit = async () => {
    const selected = windows.find((w) => w.id === target);
    if (!selected) return;
    const value = await window.jinav.startTask({
      goal,
      target: selected,
      verificationFile: output || undefined,
    });
    if (!value.ok) onError(value.error);
  };
  return {
    windows,
    target,
    setTarget,
    goal,
    setGoal,
    output,
    refresh,
    chooseOutput,
    submit,
  };
}
