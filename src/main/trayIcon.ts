// Provides persistent desktop entry points through a native tray menu.
import { Tray, Menu, nativeImage } from "electron";
import { appIconPath } from "./appIconPath";
export function trayIcon(
  open: () => void,
  settings: () => void,
  stop: () => void,
  quit: () => void,
  imagePath?: string,
) {
  const icon = nativeImage.createFromPath(imagePath ?? appIconPath());
  if (icon.isEmpty()) throw Error("Tray icon asset is missing. Rebuild jinav.");
  // Preserve the native ICO's size representations instead of forcing 16px PNG.
  const tray = new Tray(
    imagePath ?? icon.resize({ width: 16, height: 16, quality: "best" }),
  );
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
