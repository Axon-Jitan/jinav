// Submits explicit tasks using fresh setup metadata; never starts observation itself.
import { useState } from "react";
import type { Bootstrap } from "../shared/bridge";
import type { TargetWindow } from "../shared/task";
import { promptReadiness } from "./promptReadiness";
export function usePrompt(
  bootstrap: Bootstrap,
  goal: string,
  onGoalChange: (goal: string) => void,
  onError: (message: string) => void,
) {
  const [target, setTarget] = useState<TargetWindow | undefined>(
    promptReadiness(bootstrap, bootstrap.origin) === ""
      ? bootstrap.origin
      : undefined,
  );
  const [starting, setStarting] = useState(false);
  const issue = promptReadiness(bootstrap, target);
  const settings = async () => {
    const r = await window.jinav.settings("ask");
    if (!r.ok) onError(r.error);
  };
  const submit = async (output: string) => {
    if (starting || !goal.trim()) return;
    setStarting(true);
    try {
      const current = await window.jinav.bootstrap();
      if (!current.ok) {
        onError(current.error);
        return;
      }
      if (promptReadiness(current.value, target)) {
        await settings();
        return;
      }
      const r = await window.jinav.startTask({
        goal: goal.trim(),
        target,
        verificationFile: output || undefined,
      });
      if (!r.ok) onError(r.error);
      else onGoalChange("");
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(false);
    }
  };
  return { target, setTarget, starting, issue, settings, submit };
}
