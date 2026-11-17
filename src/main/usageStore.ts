// Stores minimal local launch metadata separately from task history.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { AppUsage } from "../shared/appRanking";
const schema = z
  .array(
    z.object({
      id: z.string().max(2048),
      launches: z.array(z.number().nonnegative()).max(10000),
      activated: z.number().nonnegative(),
    }),
  )
  .max(2000);
export class UsageStore {
  entries: AppUsage[] = [];
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly directory: string) {}
  async load() {
    try {
      this.entries = schema.parse(
        JSON.parse(
          await readFile(join(this.directory, "app-usage.json"), "utf8"),
        ),
      );
    } catch {
      this.entries = [];
    } // Corrupt optional ranking data never prevents launching.
  }
  record(id: string, launched: boolean, now = Date.now(), activated = true) {
    let entry = this.entries.find((e) => e.id === id);
    if (!entry) {
      entry = { id, launches: [], activated: 0 };
      this.entries.push(entry);
    }
    if (activated) entry.activated = now;
    const latest = Math.max(0, ...entry.launches);
    entry.launches = entry.launches
      .filter((t) => t > now - 30 * 86400000)
      .slice(-9999);
    if (!entry.launches.length && latest) entry.launches = [latest];
    if (launched) entry.launches.push(now);
    return this.persist();
  }
  async clear() {
    this.entries = [];
    await this.persist();
  }
  private persist() {
    const contents = JSON.stringify(this.entries);
    const next = this.queue.then(async () => {
      await mkdir(this.directory, { recursive: true });
      const path = join(this.directory, "app-usage.json");
      await writeFile(path + ".tmp", contents, { mode: 0o600 });
      await rename(path + ".tmp", path);
    });
    this.queue = next.catch(() => {
      /* The request receives persistence failures. */
    });
    return next;
  }
}
