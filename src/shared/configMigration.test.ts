// Verifies profile upgrades preserve personal preferences without granting new permissions.
import { expect, it } from "vitest";
import { configMigration } from "./configMigration";
import { defaultConfig } from "./config";
it("migrates v1 apps, order, shortcut and motion while keeping allowed apps empty", () => {
  const legacy = {
    ...defaultConfig,
    version: 1,
    shortcut: "Alt+Shift+Space",
    apps: [{ id: "editor", name: "Editor", path: "editor.exe" }],
    reducedMotion: true,
  };
  const result = configMigration(legacy);
  expect(result.version).toBe(2);
  expect(result.apps).toEqual(legacy.apps);
  expect(result.shortcut).toBe(legacy.shortcut);
  expect(result.reducedMotion).toBe(true);
  expect(result.allowedApps).toEqual([]);
});
it("preserves new source and appearance preferences across updates", () => {
  const value = {
    ...defaultConfig,
    appSource: "frequent" as const,
    reducedMotion: true,
    shortcut: "Ctrl+Alt+K",
    showAsk: false,
  };
  expect(configMigration(value)).toEqual(value);
  expect(() => configMigration({ ...value, version: 99 })).toThrow();
});
