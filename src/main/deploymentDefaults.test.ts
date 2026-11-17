// Verifies IT defaults only seed new per-user profiles with installed identities.
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { deploymentDefaults } from "./deploymentDefaults";
import { ConfigStore } from "./configStore";
import { AppCatalogue } from "./appCatalogue";
vi.mock("electron", () => ({ app: { getFileIcon: vi.fn() } }));
it("seeds two fresh profiles independently and leaves upgrades intact", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jinav-deploy-"));
  const entry = { id: "editor", name: "Editor", path: "editor.exe" };
  const catalogue = {
    discover: async () => [entry],
    icon: async () => entry,
  } as unknown as AppCatalogue;
  try {
    const path = join(dir, "defaults.json");
    await writeFile(
      path,
      JSON.stringify({ shortcut: "Ctrl+Alt+K", appIds: ["editor"] }),
    );
    const a = new ConfigStore(join(dir, "a")),
      b = new ConfigStore(join(dir, "b"));
    await a.load();
    await b.load();
    await deploymentDefaults(a, catalogue, path);
    await deploymentDefaults(b, catalogue, path);
    expect(a.config.apps).toEqual([entry]);
    expect(b.config.shortcut).toBe("Ctrl+Alt+K");
    await a.save({ ...a.config, shortcut: "Ctrl+Alt+Q", appSource: "running" });
    const upgrade = new ConfigStore(join(dir, "a"));
    await upgrade.load();
    await deploymentDefaults(upgrade, catalogue, path);
    expect(upgrade.config.shortcut).toBe("Ctrl+Alt+Q");
    expect(upgrade.config.appSource).toBe("running");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
