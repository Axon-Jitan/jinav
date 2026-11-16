// Enforces fresh scoped references with conservative sensitive-action detection.
import type { Action, TargetWindow } from "../shared/task";
import type { Observation } from "../desktop/desktopDriver";
const sensitive =
  /send|submit|publish|purchase|buy|delete|remove|erase|security|password|permission|transfer|checkout|overwrite|replace|verzenden|verwijderen|senden|löschen/i;
export function actionPolicy(
  action: Action,
  observation: Observation,
  target: TargetWindow,
  physical: boolean,
): { approval?: string } {
  if (
    /jinav|electron|powershell|cmd\.exe|terminal|credential|password|security|lockapp/i.test(
      target.app + " " + target.title,
    )
  )
    throw Error("This application is outside supported automation scope.");
  if ("ref" in action && !observation.refs.has(action.ref))
    throw Error(
      "Stale or out-of-scope reference. A fresh observation is required.",
    );
  if ((action.kind === "type" || action.kind === "press") && !physical)
    throw Error(
      "Physical input is disabled. Enable it deliberately in settings or use semantic controls.",
    );
  if (
    action.kind === "type" &&
    new TextEncoder().encode(action.text).length > 10000
  )
    throw Error("Physical text input exceeds the backend UTF-8 size limit.");
  if (action.kind === "click") {
    // Semantic clicks can have irreversible effects in arbitrary applications.
    // Until a capability-specific action classifier exists, review every click.
    let label = action.ref;
    try {
      const find = (value: unknown): void => {
        if (Array.isArray(value)) {
          value.forEach(find);
          return;
        }
        if (value && typeof value === "object") {
          const node = value as Record<string, unknown>;
          if (node.ref_id === action.ref && typeof node.name === "string")
            label = node.name;
          Object.values(node).forEach(find);
        }
      };
      find(JSON.parse(observation.text));
    } catch {
      /* A malformed display label never expands permission. */
    }
    return {
      approval: `Confirm click “${label}” (${action.ref}) in ${target.title}. ${action.reason}`,
    };
  }
  if (action.kind === "press" && action.key === "return")
    return { approval: `Confirm Enter in ${target.title}. ${action.reason}` };
  if ("reason" in action && sensitive.test(action.reason))
    return {
      approval: `Review action in ${target.title}: ${JSON.stringify(action)}`,
    };
  if (
    "text" in action &&
    !/notepad|textedit|mousepad|gedit|kate/i.test(target.app)
  )
    return {
      approval: `Review text entry in ${target.title}: ${JSON.stringify(action)}`,
    };
  return {};
}
