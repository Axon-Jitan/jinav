// Owns the cursor-anchored overlay session; never starts desktop observation.
import { BrowserWindow, screen } from "electron";
import { appRuntime } from "./appRuntime";
import { join } from "node:path";
import { menuBounds } from "../shared/menuBounds";
import type { PlatformAdapter } from "../platform/platformAdapter";
import { channels } from "../shared/bridge";
import type { TargetWindow } from "../shared/task";
import type { AppEntry } from "../shared/config";
import { logger } from "./logger";
import { randomUUID } from "node:crypto";
import { SettingsWindow } from "./settingsWindow";
import { WheelTooltip } from "./wheelTooltip";
import { appIconPath } from "./appIconPath";
import { windowBranding } from "./windowBranding";
import { shortcutClosesMenu } from "../shared/shortcutBehavior";
import type { Config } from "../shared/config";
import {
  wheelGeometry,
  WHEEL_SIZE,
  DEFAULT_WHEEL_RADIUS,
  applicationPositions,
} from "../shared/wheelGeometry";
export class LauncherWindow {
  readonly window: BrowserWindow;
  readonly settings: SettingsWindow;
  readonly tooltip = new WheelTooltip();
  private lastToggle = 0;
  private mode = "menu";
  origin: TargetWindow | undefined;
  wheelApps: AppEntry[] = [];
  resolveApps: () => Promise<AppEntry[]> = async () => [];
  resolveRadius: () => number = () => DEFAULT_WHEEL_RADIUS;
  resolvePreferences: () => Pick<
    Config,
    "activationStyle" | "appNames" | "labelPosition"
  > = () => ({
    activationStyle: "toggle",
    appNames: "hover",
    labelPosition: "auto",
  });
  private geometry = wheelGeometry();
  get wheelRadius() {
    return this.geometry.radius;
  }
  taskActive: () => boolean = () => false;
  private opening = false;
  private readyToken: string | undefined;
  private acknowledge: (() => void) | undefined;
  viewReady(token: string) {
    if (token === this.readyToken) this.acknowledge?.();
  }
  ownsInputWindow(id: string) {
    const handle = this.window.getNativeWindowHandle();
    return (
      id ===
      (handle.length >= 8
        ? handle.readBigUInt64LE().toString()
        : handle.readUInt32LE().toString())
    );
  }
  private returnToSettings = false;
  private anchor = { x: 0, y: 0 };
  constructor(private readonly platform: PlatformAdapter) {
    const iconPath =
      platform.nativeIconPath?.(appRuntime().resources) ?? appIconPath();
    this.settings = new SettingsWindow(iconPath);
    this.window = new BrowserWindow({
      width: WHEEL_SIZE,
      height: WHEEL_SIZE,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      icon: iconPath,
      hasShadow: false,
      webPreferences: {
        preload: join(__dirname, "../preload/preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    windowBranding(platform, [this.settings.window, this.window]);
    this.window.webContents.on("will-navigate", (e) => e.preventDefault());
    this.window.on("blur", () => {
      if (this.mode === "menu" || this.mode === "prompt") this.dismiss(false);
    });
    screen.on("display-removed", () => this.dismiss(false));
    screen.on("display-metrics-changed", () => {
      if (this.mode === "menu") this.dismiss(false);
    });
    void this.window.loadFile(join(__dirname, "../renderer/index.html"));
  }
  async show(mode = "menu") {
    if (mode === "menu" && this.taskActive()) mode = "progress";
    this.tooltip.window.hide();
    if (mode === "settings") {
      this.returnToSettings = false;
      this.window.hide();
      await this.settings.show();
      return;
    }
    if (this.opening) return;
    this.opening = true;
    const before = performance.now();
    const point = this.platform.isWayland
      ? undefined
      : screen.getCursorScreenPoint();
    try {
      const area = point
        ? screen.getDisplayNearestPoint(point).workArea
        : screen.getPrimaryDisplay().workArea;
      if (mode === "menu") {
        this.anchor = point ?? {
          x: area.x + area.width / 2,
          y: area.y + area.height / 2,
        };
        try {
          const origin = await this.platform.foreground?.();
          if (origin && !/jinav|electron/i.test(origin.app))
            this.origin = origin;
        } catch {
          this.origin = undefined;
        }
        this.wheelApps = structuredClone(await this.resolveApps());
        this.geometry = wheelGeometry(this.resolveRadius());
      }
      this.mode = mode;
      const width = mode === "menu" ? this.geometry.size : 360;
      const height =
        mode === "menu" ? this.geometry.size : mode === "prompt" ? 280 : 380;
      const bounds = menuBounds(this.anchor, area, width);
      bounds.height = Math.min(height, area.height);
      bounds.y = Math.max(
        area.y,
        Math.min(this.anchor.y - height / 2, area.y + area.height - height),
      );
      if (this.platform.isWayland) this.window.setSize(width, height);
      else
        this.window.setBounds({
          ...bounds,
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
        });
      if (this.window.webContents.isLoading())
        await new Promise<void>((resolve) =>
          this.window.webContents.once("did-finish-load", resolve),
        );
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.readyToken = undefined;
          this.acknowledge = undefined;
          reject(
            Error(
              "The launcher surface did not become ready. Open Settings from the tray.",
            ),
          );
        }, 1500);
        this.readyToken = randomUUID();
        this.acknowledge = () => {
          clearTimeout(timer);
          this.readyToken = undefined;
          this.acknowledge = undefined;
          resolve();
        };
        this.window.webContents.send(channels.view, mode, this.readyToken);
      });
      if (this.returnToSettings) this.settings.window.hide();
      this.window.show();
      this.window.focus();
      if (appRuntime().development)
        logger.info("launcher-show", {
          mode,
          milliseconds: performance.now() - before,
        });
    } finally {
      this.opening = false;
    }
  }
  async tryMenu() {
    if (this.opening) return;
    this.returnToSettings = true;
    try {
      await this.show();
    } catch (error) {
      this.returnToSettings = false;
      await this.settings.show();
      throw error;
    }
  }
  label(id: string | null) {
    this.tooltip.window.hide();
    if (
      !id ||
      !this.window.isVisible() ||
      this.mode !== "menu" ||
      this.resolvePreferences().appNames === "hidden"
    )
      return;
    const index = this.wheelApps.findIndex((e) => e.id === id);
    const position =
      id === "ask"
        ? 0
        : id === "settings"
          ? 3
          : applicationPositions[index % applicationPositions.length];
    const name =
      id === "ask"
        ? "Ask jinav"
        : id === "settings"
          ? "Settings"
          : this.wheelApps[index]?.name;
    const point =
      position === undefined ? undefined : this.geometry.positions[position];
    if (!point || !name) return;
    const bounds = this.window.getBounds();
    this.tooltip.show(
      name,
      bounds.x + point[0],
      bounds.y + point[1],
      bounds,
      this.resolvePreferences().labelPosition,
    );
  }
  dismiss(restore = true) {
    this.tooltip.window.hide();
    this.window.hide();
    if (this.returnToSettings) {
      this.returnToSettings = false;
      if (restore) void this.settings.show();
    } else if (restore && this.origin)
      void this.platform
        .focus(this.origin)
        .catch(() =>
          logger.error(
            "focus-restore-refused",
            "The OS refused foreground restoration",
          ),
        );
  }
  toggle() {
    const now = Date.now();
    if (now - this.lastToggle < 300) return;
    this.lastToggle = now;
    if (
      shortcutClosesMenu(
        this.resolvePreferences().activationStyle,
        this.window.isVisible(),
        this.mode,
      )
    )
      this.dismiss();
    else if (this.window.isVisible() && this.mode === "menu") return;
    else void this.show().catch(() => void this.settings.show());
  }
}
