// Filters Windows catalogue entries against current launch-target availability.
import { stat } from "node:fs/promises";
import type { AppEntry } from "../../shared/config";
export async function installedApps(
  entries: readonly AppEntry[],
  packaged: readonly { id: string; path: string }[],
) {
  const registered = new Map(packaged.map((entry) => [entry.id, entry.path]));
  const checked = await Promise.all(
    entries.map(async (entry) => {
      if (entry.id.startsWith("aumid:")) {
        // Only current-user manifest registrations qualify, not stale Start entries.
        const path = registered.get(entry.id);
        return path === undefined ? undefined : { ...entry, path };
      }
      if (!entry.path) return undefined;
      try {
        return (await stat(entry.path)).isFile() ? entry : undefined;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (["ENOENT", "ENOTDIR", "EACCES", "EPERM"].includes(code ?? ""))
          return undefined;
        throw error;
      }
    }),
  );
  return checked.filter((entry): entry is AppEntry => entry !== undefined);
}
