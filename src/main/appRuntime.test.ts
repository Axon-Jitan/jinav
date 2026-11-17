// Verifies renamed development executables resolve source assets rather than bundled paths.
import { afterEach, expect, it, vi } from "vitest";
import { resolve, join } from "node:path";
import { appRuntime } from "./appRuntime";
const getAppPath = vi.hoisted(() => vi.fn());
vi.mock("electron", () => ({ app: { getAppPath, isPackaged: true } }));
const original = Object.getOwnPropertyDescriptor(process, "resourcesPath");
afterEach(() => {
  if (original) Object.defineProperty(process, "resourcesPath", original);
  else Reflect.deleteProperty(process, "resourcesPath");
});
it("uses source resources even when a renamed Electron runtime reports packaged", () => {
  Object.defineProperty(process, "resourcesPath", {
    configurable: true,
    value: resolve("out/dev-runtime/resources"),
  });
  getAppPath.mockReturnValue(resolve("."));
  expect(appRuntime()).toEqual({
    development: true,
    resources: resolve("resources"),
    configuration: resolve("."),
  });
});
it("uses external packaged resources for ASAR and unpacked app bundles", () => {
  const resources = resolve("out/jinav/resources");
  Object.defineProperty(process, "resourcesPath", {
    configurable: true,
    value: resources,
  });
  for (const name of ["app.asar", "app"]) {
    getAppPath.mockReturnValue(join(resources, name));
    expect(appRuntime()).toEqual({
      development: false,
      resources,
      configuration: resources,
    });
  }
});
