// Resolves installed application identities for launcher requests.
import { app } from "electron";
import { basename } from "node:path";
import type { PlatformAdapter } from "../platform/platformAdapter";
import type { AppEntry } from "../shared/config";
import type { UsageStore } from "./usageStore";
export class AppCatalogue {
  entries: AppEntry[] = [];
  private loaded = false;
  private discovering: Promise<AppEntry[]> | undefined;
  private icons = new Map<string, AppEntry>();
  constructor(
    private readonly platform: PlatformAdapter,
    private readonly usage?: UsageStore,
  ) {}
  async discover(refresh = false) {
    if (this.loaded && !refresh) return this.entries;
    if (this.discovering) return this.discovering;
    this.discovering = this.readCatalogue();
    try {
      return await this.discovering;
    } finally {
      this.discovering = undefined;
    }
  }
  private async readCatalogue() {
    this.entries = (await this.platform.discover()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const seen = new Set<string>();
    this.entries = this.entries.filter((e) => {
      const identity = (e.path || e.id).toLowerCase();
      if (
        seen.has(identity) ||
        /jinav|uninstall|installer|helper|update/i.test(e.name)
      )
        return false;
      seen.add(identity);
      return true;
    });
    this.loaded = true;
    this.entries = await Promise.all(this.entries.map((e) => this.icon(e)));
    return this.entries;
  }
  async icon(entry: AppEntry) {
    const cached = this.icons.get(entry.id);
    if (cached && cached.path === entry.path && cached.name === entry.name)
      return cached;
    try {
      const enriched = {
        ...entry,
        icon: (
          await app.getFileIcon(entry.path || entry.id, { size: "normal" })
        ).toDataURL(),
      };
      this.icons.set(entry.id, enriched);
      return enriched;
    } catch {
      return entry;
    }
  }
  async launch(entry: AppEntry, windowId?: string) {
    const processName = basename(entry.path).toLowerCase();
    const windows = (await this.platform.windows()).filter(
      (w) => w.app.toLowerCase() === processName,
    );
    const target = windowId
      ? windows.find((w) => w.id === windowId)
      : windows[0];
    if (windowId && !target)
      throw Error("That window is no longer available. Choose again.");
    if (target) await this.platform.focus(target);
    else {
      await this.platform.launch(entry);
      if (!this.platform.subscribeEvents)
        await this.usage?.record(entry.id, true);
    }
    return [];
  }
}
