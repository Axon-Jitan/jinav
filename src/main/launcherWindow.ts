// Manages the compact launcher surface; never starts computer observation.
import { BrowserWindow, screen, app } from "electron";
import { join } from "node:path";
import { menuBounds } from "../shared/menuBounds";
import type { PlatformAdapter } from "../platform/platformAdapter";
import { channels } from "../shared/bridge";
import type { TargetWindow } from "../shared/task";
import { logger } from "./logger";
export class LauncherWindow {
  readonly window: BrowserWindow;
  private lastToggle = 0;
  private mode = "menu";
  origin: TargetWindow | undefined;
  private opening = false;
  constructor(private readonly platform: PlatformAdapter) {
    this.window = new BrowserWindow({
      width: 420,
      height: 420,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, "../preload/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.window.webContents.on("will-navigate", (event) =>
      event.preventDefault(),
    );
    this.window.on("blur", () => {
      if (this.mode === "menu" || this.mode === "prompt") this.window.hide();
    });
    screen.on("display-removed", () => this.window.hide());
    screen.on("display-metrics-changed", () => {
      if (this.mode === "menu") this.window.hide();
    });
    void this.window.loadFile(join(__dirname, "../renderer/index.html"));
  }
  async show(mode = "menu") {
    if (this.opening) return;
    this.opening = true;
    const before = performance.now();
    try {
      if (mode === "menu" && !this.window.isFocused()) {
        try {
          this.origin = await this.platform.foreground?.();
        } catch {
          this.origin = undefined;
        }
      }
      this.mode = mode;
      const size = mode === "menu" ? 420 : mode === "settings" ? 720 : 520;
      const area = this.platform.isWayland
        ? screen.getPrimaryDisplay().workArea
        : screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
      const point = this.platform.isWayland
        ? { x: area.x + area.width / 2, y: area.y + area.height / 2 }
        : screen.getCursorScreenPoint();
      if (this.platform.isWayland) this.window.setSize(size, size);
      else this.window.setBounds(menuBounds(point, area, size));
      if (this.window.webContents.isLoading())
        await new Promise<void>((resolve) =>
          this.window.webContents.once("did-finish-load", () => resolve()),
        );
      this.window.webContents.send(channels.view, mode);
      this.window.show();
      this.window.focus();
      if (!app.isPackaged)
        logger.info("launcher-show", {
          mode,
          milliseconds: performance.now() - before,
        });
    } finally {
      this.opening = false;
    }
  }
  toggle() {
    const now = Date.now();
    const elapsed = now - this.lastToggle;
    this.lastToggle = now;
    if (elapsed < 250) return;
    if (this.window.isVisible() && this.mode === "menu") this.window.hide();
    else void this.show();
  }
}
