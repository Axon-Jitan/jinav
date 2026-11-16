// Discovers Linux desktop entries without interpreting their Exec values.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PlatformAdapter } from "../platformAdapter";
import type { AppEntry } from "../../shared/config";
export function linuxAdapter(isWayland: boolean): PlatformAdapter {
  return {
    label: isWayland
      ? "Linux native Wayland: compositor-positioned fallback (experimental)"
      : "Linux X11 (untested)",
    isWayland,
    executableSuffix: "",
    async discover() {
      const entries: AppEntry[] = [];
      for (const root of [
        join(homedir(), ".local/share/applications"),
        "/usr/local/share/applications",
        "/usr/share/applications",
      ]) {
        const names = await readdir(root).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return [];
            throw error;
          },
        );
        for (const name of names.filter((n) => n.endsWith(".desktop"))) {
          const text = await readFile(join(root, name), "utf8");
          if (/^\s*(Hidden|NoDisplay)=true$/m.test(text)) continue;
          const label = text.match(/^Name=(.+)$/m)?.[1];
          if (label && !entries.some((e) => e.id === name))
            entries.push({ id: name, name: label, path: join(root, name) });
        }
      }
      return entries;
    },
    async windows() {
      return [];
    },
    async launch(entry) {
      await promisify(execFile)("gio", ["launch", entry.path], {
        timeout: 10000,
      });
    },
    async focus() {
      throw Error(
        "Native window focus is not yet implemented for this Linux session.",
      );
    },
  };
}
