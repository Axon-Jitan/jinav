// Selects the built host executable for the Electron smoke harness.
import { resolve } from "node:path";
if (process.platform !== "win32")
  throw Error("The native smoke workflow is currently Windows-only.");
process.env.JINAV_PACKAGED_EXECUTABLE = resolve(
  "out/jinav-win32-x64/jinav.exe",
);
await import("./desktopSmoke.mjs");
