// Verifies the supplied logo appears on real packaged surfaces and in Windows icon resources.
import { _electron, expect } from "@playwright/test";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const directory = await mkdtemp(join(tmpdir(), "jinav-brand-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
const evidence = {
  kind: "real-packaged-branding",
  result: "failed",
  checks: [],
};
let desktop;
try {
  const icon = await readFile("resources/icon.ico"),
    count = icon.readUInt16LE(4);
  expect(icon.readUInt16LE(2)).toBe(1);
  expect(count).toBe(9);
  const last = 6 + (count - 1) * 16,
    start = icon.readUInt32LE(last + 12),
    length = icon.readUInt32LE(last + 8);
  expect(
    (await readFile("out/jinav-win32-x64/jinav.exe")).includes(
      icon.subarray(start, start + length),
    ),
  ).toBe(true);
  expect(
    (await readFile("out/jinav-win32-x64/resources/icon.png")).equals(
      await readFile("resources/icon.png"),
    ),
  ).toBe(true);
  expect(
    (await readFile("out/jinav-win32-x64/resources/icon.ico")).equals(icon),
  ).toBe(true);
  evidence.checks.push(
    "new multi-resolution logo embedded in Windows executable; packaged native PNG matches canonical derivative",
  );
  desktop = await _electron.launch({
    executablePath: resolve("out/jinav-win32-x64/jinav.exe"),
    args: ["--settings", `--user-data-dir=${directory}`],
    env,
  });
  await desktop.firstWindow();
  await expect
    .poll(() =>
      desktop.windows().some((p) => p.url().includes("view=settings")),
    )
    .toBe(true);
  const settings = desktop
    .windows()
    .find((p) => p.url().includes("view=settings"));
  await settings.waitForFunction(() => !!window.jinav);
  const saved = await settings.evaluate(async () => {
    const r = await window.jinav.bootstrap();
    return window.jinav.saveConfig({
      ...r.value.config,
      shortcut: "Control+Alt+Shift+F9",
    });
  });
  if (!saved.ok) throw Error(saved.error);
  await expect(settings.locator(".brand > .brand-logo")).toBeVisible();
  await expect(
    settings.locator(".preview-wheel .ask-slot > .brand-logo"),
  ).toBeVisible();
  expect(
    await settings
      .locator(".brand > .brand-logo")
      .evaluate(
        (img) =>
          img.complete &&
          img.naturalWidth === 1024 &&
          img.naturalHeight === 1024,
      ),
  ).toBe(true);
  await expect(settings.locator(".jinav-glyph")).toHaveCount(0);
  await mkdir("evidence/screenshots", { recursive: true });
  await settings.screenshot({
    path: "evidence/screenshots/new-brand-settings.png",
  });
  await settings.getByRole("button", { name: "Try menu", exact: true }).click();
  const wheel = desktop.windows().find((p) => !p.url().includes("view="));
  await expect(wheel.locator(".ask-slot > .brand-logo")).toBeVisible();
  expect(
    await wheel
      .locator(".brand-logo")
      .evaluate((img) => img.complete && img.naturalWidth === 1024),
  ).toBe(true);
  await wheel.screenshot({
    path: "evidence/screenshots/new-brand-wheel.png",
    omitBackground: true,
  });
  await wheel.getByRole("button", { name: "Ask jinav", exact: true }).click();
  await expect(wheel.locator(".ask-header > .brand-logo")).toBeVisible();
  await expect(
    wheel.getByRole("button", { name: "Run", exact: true }),
  ).toBeDisabled();
  await expect(wheel.locator(".jinav-glyph")).toHaveCount(0);
  await wheel.screenshot({ path: "evidence/screenshots/new-brand-prompt.png" });
  evidence.checks.push(
    "real Settings brand, preview, radial Ask slot and prompt load supplied SVG; old letter glyph absent; AI stays unconfigured",
  );
  evidence.result = "passed";
} catch (error) {
  evidence.failure = error.message;
  throw error;
} finally {
  if (desktop) await desktop.close();
  await writeFile(
    "evidence/packaged-branding.json",
    JSON.stringify(evidence, null, 2),
  );
  if (!directory.startsWith(join(tmpdir(), "jinav-brand-")))
    throw Error("Unexpected test profile");
  await rm(directory, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(evidence, null, 2));
