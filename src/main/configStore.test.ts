// Verifies malformed configuration recovery without losing the original.
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { ConfigStore } from "./configStore";
import { defaultConfig } from "../shared/config";
it("backs up invalid JSON then persists valid settings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jinav-config-"));
  try {
    await writeFile(join(dir, "settings.json"), "{broken");
    const store = new ConfigStore(dir);
    await store.load();
    expect(store.config).toEqual(defaultConfig);
    expect(store.notice).toContain("Defaults restored");
    expect(
      (await readdir(dir)).some((n) => n.startsWith("settings.invalid-")),
    ).toBe(true);
    await store.save({ ...defaultConfig, shortcut: "Ctrl+Alt+J" });
    const restored = new ConfigStore(dir);
    await restored.load();
    expect(restored.config.shortcut).toBe("Ctrl+Alt+J");
    expect(await readFile(join(dir, "settings.json"), "utf8")).not.toContain(
      "key",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("rejects invalid limits before writing", async () => {
  const store = new ConfigStore("unused");
  await expect(store.save({ ...defaultConfig, maxSteps: 0 })).rejects.toThrow();
});
