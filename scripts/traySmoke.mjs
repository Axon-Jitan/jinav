// Creates the actual Windows tray through the production factory in an isolated host.
import { build } from "esbuild";
import { _electron, expect } from "@playwright/test";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const directory = await mkdtemp(join(tmpdir(), "jinav-tray-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
let desktop;
try {
  const bundle = await build({
    entryPoints: ["src/main/trayIcon.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["electron"],
    write: false,
  });
  const fixture = join(directory, "tray.cjs"),
    icon = resolve("resources/icon.ico");
  await writeFile(
    fixture,
    bundle.outputFiles[0].text +
      `
const {app, nativeImage} = require("electron");
app.setName("jinav tray verification");
app.whenReady().then(() => {
  globalThis.trayUnderTest = module.exports.trayIcon(()=>{},()=>{},()=>{},()=>app.quit(), ${JSON.stringify(icon)});
});
app.on("before-quit", () => globalThis.trayUnderTest?.destroy());
`,
  );
  desktop = await _electron.launch({
    args: [fixture, `--user-data-dir=${directory}/profile`],
    env,
  });
  await expect
    .poll(() => desktop.evaluate(() => !!globalThis.trayUnderTest))
    .toBe(true);
  const result = await desktop.evaluate(() => ({
    destroyed: globalThis.trayUnderTest.isDestroyed(),
    bounds: globalThis.trayUnderTest.getBounds(),
  }));
  expect(result.destroyed).toBe(false);
  expect(result.bounds.width).toBeGreaterThan(0);
  expect(result.bounds.height).toBeGreaterThan(0);
  await mkdir("evidence", { recursive: true });
  await writeFile(
    "evidence/native-tray.json",
    JSON.stringify(
      { kind: "real-windows-native-tray", result: "passed", ...result },
      null,
      2,
    ),
  );
  process.stdout.write(
    "Windows created a live tray using jinav's native ICO and production tray factory.\n",
  );
} finally {
  if (desktop) await desktop.close();
  if (!directory.startsWith(join(tmpdir(), "jinav-tray-")))
    throw Error("Unexpected profile directory");
  await rm(directory, { recursive: true, force: true });
}
