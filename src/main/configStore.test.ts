// Verifies malformed configuration recovery without losing the original.
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { ConfigStore } from "./configStore";
import { defaultConfig, configSchema } from "../shared/config";
it("preserves legacy settings without granting installed-app disclosure consent", () => {
  const legacy: Record<string, unknown> = {
    ...defaultConfig,
    shortcut: "Ctrl+Alt+J",
    cloudConsent: true,
  };
  delete legacy.appCatalogConsent;
  const recovered = configSchema.parse(legacy);
  expect(recovered.shortcut).toBe("Ctrl+Alt+J");
  expect(recovered.cloudConsent).toBe(true);
  expect(recovered.appCatalogConsent).toBe(false);
});
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
it("serializes overlapping writes without losing the last accepted configuration", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jinav-serial-"));
  try {
    const store = new ConfigStore(dir);
    await store.load();
    await Promise.all([
      store.save({ ...defaultConfig, shortcut: "Ctrl+Alt+A" }),
      store.save({ ...defaultConfig, shortcut: "Ctrl+Alt+B" }),
    ]);
    const restored = new ConfigStore(dir);
    await restored.load();
    expect(restored.config.shortcut).toBe("Ctrl+Alt+B");
    expect(store.config.shortcut).toBe("Ctrl+Alt+B");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("recovers the last valid atomic backup instead of losing existing choices", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jinav-backup-"));
  try {
    const store = new ConfigStore(dir);
    await store.load();
    await store.save({ ...defaultConfig, shortcut: "Ctrl+Alt+K" });
    await store.save({ ...store.config, showAsk: false });
    await writeFile(join(dir, "settings.json"), "broken");
    const recovered = new ConfigStore(dir);
    await recovered.load();
    expect(recovered.config.shortcut).toBe("Ctrl+Alt+K");
    expect(recovered.notice).toContain("last valid");
    const restarted = new ConfigStore(dir);
    await restarted.load();
    expect(restarted.config.shortcut).toBe("Ctrl+Alt+K");
    expect(restarted.isNewProfile).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
