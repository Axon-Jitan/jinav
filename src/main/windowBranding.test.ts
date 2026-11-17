// Verifies source and packaged taskbar shortcuts target jinav with safe path quoting.
import { expect, it, vi } from "vitest";
import { join } from "node:path";
import { windowBranding } from "./windowBranding";
import type { PlatformAdapter } from "../platform/platformAdapter";
const runtime = vi.hoisted(() => ({
  development: true,
  resources: "C:/jinav resources",
  configuration: "C:/Team space/jinav",
}));
vi.mock("electron", () => ({
  app: { getAppPath: () => "C:/Team space/jinav" },
}));
vi.mock("./appRuntime", () => ({ appRuntime: () => runtime }));
function fixture() {
  const window = { setAppDetails: vi.fn() },
    configureWindowBrand = vi.fn();
  const platform: PlatformAdapter = {
    label: "test",
    isWayland: false,
    executableSuffix: ".exe",
    discover: async () => [],
    windows: async () => [],
    launch: async () => {},
    focus: async () => {},
    configureWindowBrand,
  };
  return { window, platform, configureWindowBrand };
}
it("preserves the source entry point for development relaunch", () => {
  runtime.development = true;
  const f = fixture();
  windowBranding(f.platform, [f.window]);
  expect(f.configureWindowBrand).toHaveBeenCalledWith(f.window, {
    iconPath: join(runtime.resources, "icon.ico"),
    relaunchCommand: `"${process.execPath}" "C:/Team space/jinav" "--settings"`,
  });
});
it("relaunches the packaged executable without a source-directory argument", () => {
  runtime.development = false;
  const f = fixture();
  windowBranding(f.platform, [f.window]);
  expect(f.configureWindowBrand.mock.calls[0]?.[1].relaunchCommand).toBe(
    `"${process.execPath}" "--settings"`,
  );
});
