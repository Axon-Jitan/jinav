// Displays a small non-interactive tooltip without enlarging the wheel input window.
import { BrowserWindow, screen } from "electron";
import { join } from "node:path";
import { tooltipBounds } from "../shared/tooltipBounds";
import type { Bounds } from "../shared/menuBounds";
export class WheelTooltip {
  readonly window: BrowserWindow;
  constructor() {
    this.window = new BrowserWindow({
      width: 100,
      height: 32,
      show: false,
      frame: false,
      transparent: true,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      resizable: false,
      webPreferences: {
        preload: join(__dirname, "../preload/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.window.setIgnoreMouseEvents(true);
    this.window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    this.window.webContents.on("will-navigate", (e) => e.preventDefault());
    void this.window.loadFile(join(__dirname, "../renderer/index.html"), {
      query: { view: "tooltip" },
    });
  }
  show(
    name: string,
    x: number,
    y: number,
    wheel: Bounds,
    placement: "auto" | "top" | "bottom" = "auto",
  ) {
    const area = screen.getDisplayNearestPoint({ x, y }).workArea;
    const textWidth = Array.from(name).reduce(
      (sum, char) => sum + (/[^\u0000-\u024f]/.test(char) ? 14 : 8),
      0,
    );
    const width = Math.min(
      area.width,
      Math.min(320, Math.max(70, textWidth + 26)) + 16,
    );
    const height =
      Math.max(32, Math.ceil(textWidth / Math.max(1, width - 42)) * 18 + 14) +
      16;
    const bounds = tooltipBounds(
      wheel,
      { x, y },
      area,
      { width, height },
      placement,
    );
    const side =
      bounds.x >= wheel.x + wheel.width
        ? "right"
        : bounds.x + bounds.width <= wheel.x
          ? "left"
          : bounds.y + bounds.height <= wheel.y
            ? "top"
            : "bottom";
    this.window.setBounds(bounds);
    this.window.webContents.send("jinav:tooltipText", { text: name, side });
    this.window.showInactive();
  }
}
