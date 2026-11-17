// Defines native launcher operations independently of computer use.
import type { AppEntry } from "../shared/config";
import type { TargetWindow } from "../shared/task";
import type { BrowserWindow } from "electron";
export type DesktopEvent =
  | { kind: "ready" | "unavailable" | "release" }
  | { kind: "input"; at: number; windowId: string }
  | {
      kind: "window";
      app: string;
      processId: string;
      id: string;
      activated: boolean;
    };
export interface PlatformAdapter {
  label: string;
  isWayland: boolean;
  executableSuffix: string;
  configureBrand?(icon: string): void;
  nativeIconPath?(resources: string): string;
  configureWindowBrand?(
    window: Pick<BrowserWindow, "setAppDetails">,
    details: { iconPath: string; relaunchCommand: string },
  ): void;
  discover(signal?: AbortSignal): Promise<AppEntry[]>;
  windows(): Promise<(TargetWindow & { focused?: boolean })[]>;
  foreground?(): Promise<TargetWindow | undefined>;
  launch(entry: AppEntry, signal?: AbortSignal): Promise<void>;
  focus(window: TargetWindow, signal?: AbortSignal): Promise<void>;
  dispose?(): void;
  subscribeEvents?(callback: (event: DesktopEvent) => void): () => void;
}
