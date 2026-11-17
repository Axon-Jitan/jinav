// Resolves approved task app IDs through the native application catalogue.
import { basename } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { AppEntry } from "../shared/config";
import type {
  TaskApplicationLauncher,
  TaskApplication,
} from "../shared/taskApplications";
import type { PlatformAdapter } from "../platform/platformAdapter";
import type { DesktopDriver } from "../desktop/desktopDriver";
import { supportsTaskApp } from "../shared/appAccess";
export class TaskApplications implements TaskApplicationLauncher {
  readonly apps: TaskApplication[];
  get allowedEntries() {
    return this.entries;
  }
  constructor(
    private readonly platform: PlatformAdapter,
    private readonly entries: readonly AppEntry[],
    private readonly desktop?: DesktopDriver,
  ) {
    this.apps = entries.map((entry, index) => ({
      id: `app-${index}`,
      name: entry.name,
    }));
  }
  static async discover(
    platform: PlatformAdapter,
    signal?: AbortSignal,
    desktop?: DesktopDriver,
    allowed?: readonly AppEntry[],
  ) {
    const entries: AppEntry[] = [];
    const identities = new Set<string>();
    for (const entry of await platform.discover(signal)) {
      signal?.throwIfAborted();
      if (
        allowed &&
        !allowed.some((e) => e.id === entry.id && e.path === entry.path)
      )
        continue;
      if (!supportsTaskApp(entry)) continue;
      const identity = entry.path.toLowerCase();
      if (identities.has(identity)) continue;
      identities.add(identity);
      entries.push(entry);
    }
    return new TaskApplications(platform, entries.slice(0, 500), desktop);
  }
  async open(appId: string, signal: AbortSignal) {
    signal.throwIfAborted();
    const index = this.apps.findIndex((app) => app.id === appId);
    const entry = this.entries[index];
    if (!entry)
      throw Error(
        "The requested application is not in this task’s installed-app catalogue.",
      );
    const processName = basename(entry.path).toLowerCase();
    const matching = async () => {
      const windows = this.desktop?.listWindows
        ? await this.desktop.listWindows(processName, signal)
        : await this.platform.windows();
      signal.throwIfAborted();
      return windows.filter(
        (window) => window.app.toLowerCase() === processName,
      );
    };
    let windows = await matching();
    if (windows.length > 1)
      throw Error(
        `${entry.name} has several windows. Select the intended window in Ask jinav and submit again.`,
      );
    const existing = windows[0];
    if (existing) {
      if (this.desktop?.focusWindow)
        await this.desktop.focusWindow(
          { ...existing, id: this.driverId(existing.id) },
          signal,
        );
      else
        await this.platform.focus(
          {
            ...existing,
            id: this.platform.executableSuffix
              ? existing.id.replace(/^w-/, "")
              : existing.id,
          },
          signal,
        );
      signal.throwIfAborted();
      const refreshed = await matching();
      if (refreshed.length > 1)
        throw Error(
          `${entry.name} has several windows after activation. Select the intended window explicitly.`,
        );
      const confirmed = refreshed[0];
      if (!confirmed)
        throw Error(`${entry.name} window disappeared during activation.`);
      return { ...confirmed, id: this.driverId(confirmed.id) };
    }
    signal.throwIfAborted();
    await this.platform.launch(entry, signal);
    signal.throwIfAborted();
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      windows = await matching();
      if (windows.length > 1)
        throw Error(
          `${entry.name} opened several windows. Select one explicitly before continuing.`,
        );
      const target = windows[0];
      if (target) return { ...target, id: this.driverId(target.id) };
      await delay(200, undefined, { signal });
    }
    throw Error(
      `The launch request for ${entry.name} was sent, but no application window could be verified. It may still have opened.`,
    );
  }
  private driverId(id: string) {
    return this.platform.executableSuffix && !id.startsWith("w-")
      ? `w-${id}`
      : id;
  }
}
