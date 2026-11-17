// Supplies Windows shell relaunch metadata before application windows become visible.
import { app, type BrowserWindow } from "electron";
import { join } from "node:path";
import type { PlatformAdapter } from "../platform/platformAdapter";
import { appRuntime } from "./appRuntime";
function quote(value: string) {
  return (
    '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, "$1$1") + '"'
  );
}
export function windowBranding(
  platform: PlatformAdapter,
  windows: readonly Pick<BrowserWindow, "setAppDetails">[],
) {
  const runtime = appRuntime();
  const args = runtime.development
    ? [app.getAppPath(), "--settings"]
    : ["--settings"];
  const details = {
    iconPath: join(runtime.resources, "icon.ico"),
    relaunchCommand: [process.execPath, ...args].map(quote).join(" "),
  };
  for (const window of windows)
    platform.configureWindowBrand?.(window, details);
}
