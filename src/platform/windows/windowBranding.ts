// Sets the taskbar icon source on each window, not just on the process executable.
import type { BrowserWindow } from "electron";
// Keep the workspace shortcut writer's AppUserModelID in sync with this identity.
// A distinct branded identity avoids inheriting the earlier Electron taskbar group.
export const WINDOWS_APP_ID = "com.jinav.desktop";
export function windowsWindowBrand(
  window: Pick<BrowserWindow, "setAppDetails">,
  details: { iconPath: string; relaunchCommand: string },
) {
  window.setAppDetails({
    appId: WINDOWS_APP_ID,
    appIconPath: details.iconPath,
    appIconIndex: 0,
    relaunchCommand: details.relaunchCommand,
    relaunchDisplayName: "jinav",
  });
}
