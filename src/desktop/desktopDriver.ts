// Defines desktop observation capabilities without exposing arbitrary commands.
import type { Action, TargetWindow } from "../shared/task";
export interface Observation {
  text: string;
  refs: ReadonlySet<string>;
}
export interface Delivery {
  ok: boolean;
  code?: string;
  delivery: string;
  safeRetry: boolean;
}
export interface DesktopDriver {
  listWindows?(
    application: string,
    signal: AbortSignal,
  ): Promise<TargetWindow[]>;
  allWindows?(signal: AbortSignal): Promise<TargetWindow[]>;
  focusWindow?(target: TargetWindow, signal: AbortSignal): Promise<void>;
  status(signal: AbortSignal): Promise<unknown>;
  observe(target: TargetWindow, signal: AbortSignal): Promise<Observation>;
  execute(
    action: Action,
    target: TargetWindow,
    physical: boolean,
    signal: AbortSignal,
  ): Promise<Delivery>;
}
