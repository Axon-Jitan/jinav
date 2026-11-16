// Defines native launcher operations independently of computer use.
import type { AppEntry } from "../shared/config";
import type { TargetWindow } from "../shared/task";
export interface PlatformAdapter {
  label: string;
  isWayland: boolean;
  executableSuffix: string;
  discover(): Promise<AppEntry[]>;
  windows(): Promise<(TargetWindow & { focused?: boolean })[]>;
  foreground?(): Promise<TargetWindow | undefined>;
  launch(entry: AppEntry): Promise<void>;
  focus(window: TargetWindow): Promise<void>;
  dispose?(): void;
}
