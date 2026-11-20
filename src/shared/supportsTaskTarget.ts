// Rejects protected application identities without mistaking project names for jinav itself.
import type { TargetWindow } from "./task";
export function supportsTaskTarget(
  target: Pick<TargetWindow, "app" | "title">,
) {
  return (
    !/jinav|electron|powershell|cmd\.exe|terminal|credential|password|security|lockapp/i.test(
      target.app,
    ) &&
    !/powershell|cmd\.exe|terminal|credential|password|security|lockapp/i.test(
      target.title,
    )
  );
}
