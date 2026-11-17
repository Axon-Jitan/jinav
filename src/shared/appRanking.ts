// Ranks stable application identities without recording UI content.
import type { AppEntry, Config } from "./config";
export interface AppUsage {
  id: string;
  launches: number[];
  activated: number;
}
export function appRanking(
  config: Config,
  installed: readonly AppEntry[],
  usage: readonly AppUsage[],
  running: readonly string[],
  now = Date.now(),
): AppEntry[] {
  if (config.appSource === "selected") return config.apps.slice();
  const cutoff = now - 30 * 86400000;
  const candidates = installed.filter(
    (e) =>
      !/jinav|uninstall|installer|helper|update|powershell|command prompt/i.test(
        e.name,
      ),
  );
  const history = new Map(usage.map((u) => [u.id, u]));
  const latest = (id: string) =>
    Math.max(0, ...(history.get(id)?.launches ?? []));
  const count = (id: string) =>
    history.get(id)?.launches.filter((t) => t >= cutoff).length ?? 0;
  const ranked = candidates
    .filter((e) =>
      config.appSource === "running"
        ? running.includes(e.id)
        : config.appSource === "frequent"
          ? count(e.id) > 0
          : latest(e.id) > 0,
    )
    .sort((a, b) => {
      if (config.appSource === "running")
        return (
          (history.get(b.id)?.activated ?? 0) -
            (history.get(a.id)?.activated ?? 0) || a.id.localeCompare(b.id)
        );
      return (
        (config.appSource === "frequent" ? count(b.id) - count(a.id) : 0) ||
        latest(b.id) - latest(a.id) ||
        a.id.localeCompare(b.id)
      );
    });
  if (config.appSource !== "running")
    for (const entry of config.apps)
      if (!ranked.some((e) => e.id === entry.id)) ranked.push(entry);
  return ranked;
}
