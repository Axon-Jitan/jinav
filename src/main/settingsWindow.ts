// Owns the single settings surface; closing it keeps the launcher alive.
import { BrowserWindow, screen, app } from "electron";
import { join } from "node:path";
import { appIconPath } from "./appIconPath";
export class SettingsWindow {
  readonly window: BrowserWindow;
  constructor(iconPath = appIconPath()) {
    const area = screen.getPrimaryDisplay().workArea;
    this.window = new BrowserWindow({
      width: Math.min(1040, area.width),
      height: Math.min(760, area.height),
      show: false,
      frame: false,
      backgroundColor: "#ffffff",
      title: "jinav — Settings",
      icon: iconPath,
      minWidth: 620,
      minHeight: 440,
      webPreferences: {
        preload: join(__dirname, "../preload/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.window.webContents.on("will-navigate", (e) => e.preventDefault());
    this.window.on("close", (e) => {
      if (!this.quitting) {
        e.preventDefault();
        this.window.hide();
      }
    });
    app.on("before-quit", () => {
      this.quitting = true;
    });
    void this.window.loadFile(join(__dirname, "../renderer/index.html"), {
      query: { view: "settings" },
    });
  }
  private quitting = false;
  control(command: "state" | "minimize" | "maximize" | "close") {
    if (command === "minimize") this.window.minimize();
    if (command === "maximize") {
      if (this.window.isMaximized()) this.window.unmaximize();
      else this.window.maximize();
    }
    if (command === "close") this.window.hide();
    return { maximized: this.window.isMaximized() };
  }
  async show() {
    if (this.window.isMinimized()) this.window.restore();
    if (this.window.webContents.isLoading())
      await new Promise<void>((resolve) =>
        this.window.webContents.once("did-finish-load", resolve),
      );
    this.window.webContents.send("jinav:view", "settings");
    this.window.show();
    this.window.focus();
  }
}
