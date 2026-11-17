// Verifies opt-in outcome history excludes task and observed content.
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { TaskHistoryStore } from "./taskHistoryStore";
it("persists only terminal outcome metadata and clears the file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jinav-history-"));
  try {
    const store = new TaskHistoryStore(directory);
    await store.record({
      runId: "run",
      phase: "completed",
      step: 4,
      message: "PRIVATE DOCUMENT CONTENT",
    });
    const text = await readFile(join(directory, "task-history.json"), "utf8");
    expect(text).not.toContain("PRIVATE");
    expect(JSON.parse(text)[0]).toMatchObject({
      runId: "run",
      phase: "completed",
      step: 4,
    });
    await store.clear();
    await expect(
      access(join(directory, "task-history.json")),
    ).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
