// Verifies unlimited saved selection, reachable wheel pages and exterior preview captions.
import { _electron, expect } from "@playwright/test";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { prepareRuntime } from "./prepareRuntime.mjs";
const directory = await mkdtemp(join(tmpdir(), "jinav-many-apps-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
const packaged = process.argv.includes("--packaged");
let desktop;
const evidence = {
  kind: "real-many-apps-wheel",
  packaged,
  result: "failed",
  checks: [],
};
try {
  const executable = packaged
    ? resolve("out/jinav-win32-x64/jinav.exe")
    : await prepareRuntime();
  const ico = await readFile("resources/icon.ico"),
    last = 6 + (ico.readUInt16LE(4) - 1) * 16,
    start = ico.readUInt32LE(last + 12),
    length = ico.readUInt32LE(last + 8);
  expect(
    (await readFile(executable)).includes(ico.subarray(start, start + length)),
  ).toBe(true);
  desktop = await _electron.launch({
    executablePath: executable,
    args: [
      ...(packaged ? [] : [resolve(".")]),
      "--settings",
      `--user-data-dir=${directory}`,
    ],
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
  const seeded = await settings.evaluate(async () => {
    const r = await window.jinav.bootstrap();
    return window.jinav.saveConfig({
      ...r.value.config,
      shortcut: "Control+Alt+Shift+F6",
    });
  });
  if (!seeded.ok) throw Error(seeded.error);
  await settings.reload();
  await settings.getByRole("button", { name: "Add app", exact: true }).click();
  await expect(settings.locator(".picker-list")).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: 45000 },
  );
  const showTools = settings.getByRole("button", {
    name: "Show system tools",
    exact: true,
  });
  if (await showTools.count()) await showTools.click();
  await settings
    .getByRole("button", { name: "Select shown", exact: true })
    .click();
  await settings.getByRole("button", { name: /^Add to menu \(/ }).click();
  const bootstrap = await settings.evaluate(() => window.jinav.bootstrap());
  if (!bootstrap.ok) throw Error(bootstrap.error);
  const apps = bootstrap.value.config.apps;
  expect(apps.length).toBeGreaterThan(6);
  await expect(
    settings.getByRole("button", { name: "Add app", exact: true }),
  ).toBeEnabled();
  const preview = settings.locator(".preview-wheel");
  await expect(preview.locator(".wheel-page")).toBeVisible();
  const pageCount = Math.ceil(apps.length / 6);
  for (const side of ["left", "right"]) {
    const positions = await preview
      .locator("button.slot")
      .evaluateAll((buttons) =>
        buttons.map((b) => ({
          name: b.getAttribute("aria-label"),
          left: parseFloat(b.style.left),
          width: b.parentElement.getBoundingClientRect().width,
        })),
      );
    const entry = positions.find((b) =>
      side === "left" ? b.left < b.width / 2 - 10 : b.left > b.width / 2 + 10,
    );
    await preview
      .getByRole("button", { name: entry.name, exact: true })
      .hover();
    await expect(preview.locator(".preview-caption")).toHaveText(entry.name);
    const placed = await preview.locator(".preview-caption").evaluate((e) => {
      const a = e.parentElement.getBoundingClientRect(),
        b = e.getBoundingClientRect(),
        card = e.closest(".preview-card").getBoundingClientRect();
      return {
        outside:
          b.right <= a.left ||
          b.left >= a.right ||
          b.bottom <= a.top ||
          b.top >= a.bottom,
        inCard: b.left >= card.left && b.right <= card.right,
        side: e.getAttribute("data-side"),
      };
    });
    expect(placed.outside).toBe(true);
    expect(placed.inCard).toBe(true);
    expect(placed.side).not.toBe(side === "left" ? "right" : "left");
    await mkdir("evidence/screenshots", { recursive: true });
    await preview
      .locator(".preview-caption")
      .screenshot({ path: `evidence/screenshots/preview-caption-${side}.png` });
  }
  await preview.locator(".wheel-page").click();
  await expect(
    preview.getByRole("button", { name: apps[6].name, exact: true }),
  ).toBeVisible();
  await settings.getByRole("button", { name: "Try menu", exact: true }).click();
  const wheel = desktop.windows().find((p) => !p.url().includes("view="));
  await expect(wheel.locator(".wheel-page")).toHaveText(`1/${pageCount}›`);
  await wheel.keyboard.press("PageDown");
  await expect(
    wheel.getByRole("button", { name: apps[6].name, exact: true }),
  ).toBeVisible();
  await wheel.getByRole("button", { name: apps[6].name, exact: true }).hover();
  const tooltip = desktop
    .windows()
    .find((p) => p.url().includes("view=tooltip"));
  await expect(tooltip.locator(".native-tooltip")).toHaveText(apps[6].name);
  await wheel.keyboard.press("PageUp");
  await wheel.keyboard.press("PageUp");
  await expect(
    wheel.getByRole("button", { name: apps.at(-1).name, exact: true }),
  ).toBeVisible();
  await wheel.locator(".wheel-page").click();
  await expect(
    wheel.getByRole("button", { name: apps[0].name, exact: true }),
  ).toBeVisible();
  await wheel.keyboard.press("Escape");
  await settings
    .getByRole("navigation")
    .getByRole("button", { name: "Ask jinav", exact: true })
    .click();
  await settings
    .getByRole("button", { name: "Choose apps", exact: true })
    .click();
  await expect(settings.locator(".picker-list")).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: 45000 },
  );
  const permissionTools = settings.getByRole("button", {
    name: "Show system tools",
    exact: true,
  });
  if (await permissionTools.count()) await permissionTools.click();
  await settings
    .getByRole("button", { name: "Select shown", exact: true })
    .click();
  await settings
    .getByRole("button", { name: "Save selection", exact: true })
    .click();
  const result = await settings.evaluate(() => window.jinav.bootstrap());
  expect(result.value.config.allowedApps.length).toBe(apps.length);
  expect(result.value.config.apps.length).toBe(apps.length);
  expect(result.value.config.aiEnabled).toBe(false);
  await mkdir("evidence/screenshots", { recursive: true });
  await settings.screenshot({
    path: "evidence/screenshots/unlimited-app-selection.png",
  });
  evidence.checks.push({
    savedLauncherApps: apps.length,
    savedPermissionApps: result.value.config.allowedApps.length,
    pages: pageCount,
    previewLabelsOutside: true,
    lastPageReachable: true,
    brandedExecutable: true,
    aiDisabled: true,
  });
  evidence.result = "passed";
} catch (error) {
  evidence.failure = error.message;
  throw error;
} finally {
  if (desktop) await desktop.close();
  await writeFile(
    packaged
      ? "evidence/packaged-many-apps.json"
      : "evidence/desktop-many-apps.json",
    JSON.stringify(evidence, null, 2),
  );
  if (!directory.startsWith(join(tmpdir(), "jinav-many-apps-")))
    throw Error("Unexpected test profile");
  await rm(directory, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(evidence, null, 2));
