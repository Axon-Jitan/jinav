// Provides persistent desktop entry points through a native tray menu.
import { Tray, Menu, nativeImage, app } from "electron";
import { join } from "node:path";
export function trayIcon(
  open: () => void,
  settings: () => void,
  stop: () => void,
  quit: () => void,
) {
  const path = app.isPackaged
    ? join(process.resourcesPath, "icon.png")
    : join(app.getAppPath(), "resources/icon.png");
  const icon = nativeImage.createFromPath(path);
  if (icon.isEmpty()) throw Error("Tray icon asset is missing. Rebuild jinav.");
  const tray = new Tray(icon);
  tray.setToolTip("jinav");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open jinav", click: open },
      { label: "Settings", click: settings },
      { label: "Stop current task", click: stop },
      { type: "separator" },
      { label: "Quit", click: quit },
    ]),
  );
  tray.on("click", open);
  return tray;
}
