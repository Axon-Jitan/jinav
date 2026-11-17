// Verifies local launch counts remain separate from activation and can be cleared.
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { UsageStore } from "./usageStore";
it("does not count focus as a launch and persists deletion", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jinav-usage-"));
  try {
    const store = new UsageStore(dir);
    await store.record("editor", true, 1000);
    await store.record("editor", false, 2000);
    expect(store.entries[0]?.launches).toEqual([1000]);
    const loaded = new UsageStore(dir);
    await loaded.load();
    expect(loaded.entries[0]?.activated).toBe(2000);
    await loaded.clear();
    expect(
      JSON.parse(await readFile(join(dir, "app-usage.json"), "utf8")),
    ).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
