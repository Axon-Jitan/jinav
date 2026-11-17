// Resolves resources from the loaded app, including renamed development executables.
import { app } from "electron";
import { join, resolve } from "node:path";
export function appRuntime() {
  const root = resolve(app.getAppPath());
  const development =
    root !== resolve(process.resourcesPath, "app.asar") &&
    root !== resolve(process.resourcesPath, "app");
  return {
    development,
    resources: development ? join(root, "resources") : process.resourcesPath,
    configuration: development ? root : process.resourcesPath,
  };
}
