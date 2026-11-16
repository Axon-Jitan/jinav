// Specifies the renderer's named capabilities; exposes no generic IPC.
import type { AppEntry, Config } from "./config";
import type { TargetWindow, TaskRequest, TaskState } from "./task";
export interface Bootstrap {
  config: Config;
  notice: string;
  credential: string;
  platform: string;
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface Bridge {
  bootstrap(): Promise<Result<Bootstrap>>;
  discover(): Promise<Result<AppEntry[]>>;
  manualApp(): Promise<Result<AppEntry | null>>;
  saveConfig(config: Config): Promise<Result<string>>;
  launch(id: string, windowId?: string): Promise<Result<TargetWindow[]>>;
  windows(): Promise<Result<TargetWindow[]>>;
  hide(): Promise<Result<void>>;
  settings(): Promise<Result<void>>;
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
  onView(callback: (view: string) => void): () => void;
}
export const channels = {
  bootstrap: "jinav:bootstrap",
  discover: "jinav:discover",
  manualApp: "jinav:manualApp",
  saveConfig: "jinav:saveConfig",
  launch: "jinav:launch",
  windows: "jinav:windows",
  hide: "jinav:hide",
  settings: "jinav:settings",
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
  chooseVerificationFile: "jinav:chooseVerificationFile",
} as const;
