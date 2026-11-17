// Persists opt-in task outcome metadata without prompts or observed content.
import { writeFile, rename, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { TaskState } from "../shared/task";
const schema = z
  .array(
    z.object({
      runId: z.string(),
      phase: z.enum(["completed", "failed", "cancelled"]),
      step: z.number(),
      at: z.number(),
    }),
  )
  .max(100);
export class TaskHistoryStore {
  private records: z.infer<typeof schema> = [];
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly directory: string) {}
  async load() {
    try {
      this.records = schema.parse(
        JSON.parse(
          await readFile(join(this.directory, "task-history.json"), "utf8"),
        ),
      );
    } catch {
      this.records = [];
    }
  }
  record(state: TaskState) {
    const parsed = schema.element.safeParse({
      runId: state.runId,
      phase: state.phase,
      step: state.step,
      at: Date.now(),
    });
    if (!parsed.success) return Promise.resolve();
    this.records = [
      ...this.records.filter((e) => e.runId !== state.runId),
      parsed.data,
    ].slice(-100);
    const text = JSON.stringify(this.records);
    const path = join(this.directory, "task-history.json");
    const next = this.queue.then(async () => {
      await writeFile(path + ".tmp", text, { mode: 0o600 });
      await rename(path + ".tmp", path);
    });
    this.queue = next.catch(() => {
      /* Caller reports storage errors. */
    });
    return next;
  }
  async clear() {
    await this.queue;
    this.records = [];
    await rm(join(this.directory, "task-history.json"), { force: true });
  }
}
