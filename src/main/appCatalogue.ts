// Resolves installed application identities for launcher requests.
import { app } from "electron";
import { basename } from "node:path";
import type { PlatformAdapter } from "../platform/platformAdapter";
import type { AppEntry } from "../shared/config";
export class AppCatalogue {
  entries: AppEntry[] = [];
  constructor(private readonly platform: PlatformAdapter) {}
  async discover() {
    this.entries = (await this.platform.discover()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return this.entries;
  }
  async icon(entry: AppEntry) {
    try {
      return {
        ...entry,
        icon: (
          await app.getFileIcon(entry.path || entry.id, { size: "normal" })
        ).toDataURL(),
      };
    } catch {
      return entry;
    }
  }
  async launch(entry: AppEntry, windowId?: string) {
    const processName = basename(entry.path).toLowerCase();
    const windows = (await this.platform.windows()).filter(
      (w) => w.app.toLowerCase() === processName,
    );
    if (windows.length > 1 && !windowId) return windows;
    const target = windowId
      ? windows.find((w) => w.id === windowId)
      : windows[0];
    if (windowId && !target)
      throw Error("That window is no longer available. Choose again.");
    if (target) await this.platform.focus(target);
    else await this.platform.launch(entry);
    return [];
  }
}
