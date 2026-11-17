// Discovers macOS bundles; reports unavailable window focus explicitly.
import { readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import type { PlatformAdapter } from "../platformAdapter";
export function macosAdapter(): PlatformAdapter {
  return {
    label: "macOS (untested)",
    isWayland: false,
    executableSuffix: "",
    configureBrand: (icon) => app.dock?.setIcon(icon),
    async discover() {
      const entries = [];
      for (const root of [
        "/Applications",
        "/System/Applications",
        join(homedir(), "Applications"),
      ]) {
        const names = await readdir(root).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return [];
            throw error;
          },
        );
        for (const name of names.filter((n) => n.endsWith(".app")))
          entries.push({
            id: join(root, name),
            name: name.slice(0, -4),
            path: join(root, name),
          });
      }
      return entries;
    },
    async windows() {
      return [];
    },
    async launch(entry) {
      await promisify(execFile)("/usr/bin/open", ["-a", entry.path], {
        timeout: 10000,
      });
    },
    async focus() {
      throw Error("Native window focus is not yet implemented on macOS.");
    },
  };
}
