// Locates the same native logo for development and packaged application surfaces.
import { appRuntime } from "./appRuntime";
import { join } from "node:path";
export function appIconPath() {
  return join(appRuntime().resources, "icon.png");
}
