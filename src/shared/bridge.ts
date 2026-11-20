// Specifies the renderer's named capabilities; exposes no generic IPC.
import type { AppEntry, Config } from "./config";
import type { TargetWindow, TaskRequest, TaskState } from "./task";
export type SettingsPage = "menu" | "general" | "appearance" | "ask";
export interface Bootstrap {
  config: Config;
  notice: string;
  credential: string;
  platform: string;
  wheelApps?: AppEntry[];
  wheelRadius?: number;
  origin?: TargetWindow;
  modelConnected?: boolean;
  inputMonitoring?: boolean;
  desktopReady?: boolean;
  desktopUnavailable?: boolean;
  modelProvisioned?: boolean;
  teamTestBuild?: boolean;
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface TooltipContent {
  text: string;
  side: "left" | "right" | "top" | "bottom";
}
export interface Bridge {
  bootstrap(): Promise<Result<Bootstrap>>;
  discover(): Promise<Result<AppEntry[]>>;
  manualApp(): Promise<Result<AppEntry | null>>;
  saveConfig(config: Config): Promise<Result<string>>;
  shortcutCapture(enabled: boolean): Promise<Result<void>>;
  onShortcutRecorded(callback: (shortcut: string) => void): () => void;
  launch(id: string, windowId?: string): Promise<Result<TargetWindow[]>>;
  windows(): Promise<Result<TargetWindow[]>>;
  hide(): Promise<Result<void>>;
  settings(page?: SettingsPage): Promise<Result<void>>;
  onSettingsPage(callback: (page: SettingsPage) => void): () => void;
  settingsWindow(
    command: "state" | "minimize" | "maximize" | "close",
  ): Promise<Result<{ maximized: boolean }>>;
  prompt(): Promise<Result<void>>;
  tryMenu(): Promise<Result<void>>;
  wheelApps(): Promise<Result<AppEntry[]>>;
  clearAppHistory(): Promise<Result<void>>;
  pauseTask(paused: boolean): Promise<Result<void>>;
  tooltip(id: string | null, page?: number): Promise<Result<void>>;
  onTooltip(callback: (content: TooltipContent) => void): () => void;
  saveKey(key: string): Promise<Result<string>>;
  testModel(): Promise<Result<string>>;
  driverStatus(): Promise<Result<string>>;
  startTask(request: TaskRequest): Promise<Result<void>>;
  stopTask(): Promise<Result<void>>;
  approve(allow: boolean): Promise<Result<void>>;
  clearHistory(): Promise<Result<void>>;
  taskState(): Promise<Result<TaskState>>;
  chooseVerificationFile(): Promise<Result<string>>;
  onTask(callback: (state: TaskState) => void): () => void;
  onView(callback: (view: string, session?: string) => void): () => void;
  viewReady(session: string): Promise<Result<void>>;
}
export const channels = {
  bootstrap: "jinav:bootstrap",
  discover: "jinav:discover",
  manualApp: "jinav:manualApp",
  saveConfig: "jinav:saveConfig",
  shortcutCapture: "jinav:shortcutCapture",
  shortcutRecorded: "jinav:shortcutRecorded",
  launch: "jinav:launch",
  windows: "jinav:windows",
  hide: "jinav:hide",
  settings: "jinav:settings",
  settingsPage: "jinav:settingsPage",
  settingsWindow: "jinav:settingsWindow",
  prompt: "jinav:prompt",
  tryMenu: "jinav:tryMenu",
  wheelApps: "jinav:wheelApps",
  clearAppHistory: "jinav:clearAppHistory",
  pauseTask: "jinav:pauseTask",
  tooltip: "jinav:tooltip",
  tooltipText: "jinav:tooltipText",
  saveKey: "jinav:saveKey",
  testModel: "jinav:testModel",
  driverStatus: "jinav:driverStatus",
  startTask: "jinav:startTask",
  stopTask: "jinav:stopTask",
  approve: "jinav:approve",
  clearHistory: "jinav:clearHistory",
  taskState: "jinav:taskState",
  task: "jinav:task",
  view: "jinav:view",
  viewReady: "jinav:viewReady",
  chooseVerificationFile: "jinav:chooseVerificationFile",
} as const;
