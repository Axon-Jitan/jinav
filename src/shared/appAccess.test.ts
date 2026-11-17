// Verifies broad access is explicit and scope changes invalidate running permissions.
import { expect, it } from "vitest";
import { configSchema, defaultConfig } from "./config";
import { appScope, taskPermissions, supportsTaskApp } from "./appAccess";
it("keeps older profiles on selected apps without granting broader access", () => {
  const old: Record<string, unknown> = {
    ...defaultConfig,
    allowedApps: [{ id: "editor", name: "Editor", path: "editor.exe" }],
  };
  delete old.appAccess;
  const result = configSchema.parse(old);
  expect(result.appAccess).toBe("selected");
  expect(result.allowedApps).toEqual(old.allowedApps);
  expect(
    configSchema.safeParse({ ...defaultConfig, appAccess: "unrestricted" })
      .success,
  ).toBe(false);
});
it("tracks scope and consent changes while ignoring launcher appearance", () => {
  expect(appScope({ ...defaultConfig, appAccess: "all" })).not.toBe(
    appScope(defaultConfig),
  );
  expect(
    taskPermissions({ ...defaultConfig, appCatalogConsent: true }),
  ).not.toBe(taskPermissions(defaultConfig));
  expect(taskPermissions({ ...defaultConfig, menuRadius: 110 })).toBe(
    taskPermissions(defaultConfig),
  );
});
it("does not turn all-app access into terminal or credential-tool authority", () => {
  expect(supportsTaskApp({ name: "Notepad", path: "notepad.exe" })).toBe(true);
  expect(supportsTaskApp({ name: "PowerShell", path: "powershell.exe" })).toBe(
    false,
  );
  expect(
    supportsTaskApp({ name: "Credential Manager", path: "manager.exe" }),
  ).toBe(false);
  expect(supportsTaskApp({ name: "No executable", path: "" })).toBe(false);
});
