// Verifies removal reflows both preview and native wheel in a disposable profile.
import { _electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { prepareRuntime } from "./prepareRuntime.mjs";
const directory = await mkdtemp(join(tmpdir(), "jinav-layout-"));
const packaged = process.argv.includes("--packaged"),
  team = process.argv.includes("--team-package");
const executable = team
  ? resolve("out/private-team/package/jinav-win32-x64/jinav.exe")
  : packaged
    ? resolve("out/jinav-win32-x64/jinav.exe")
    : await prepareRuntime();
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
let desktop, settings;
const evidence = {
  kind: "real-wheel-reflow",
  packaged: packaged || team,
  result: "failed",
  checks: [],
};
async function launch() {
  desktop = await _electron.launch({
    executablePath: executable,
    args: [
      ...(packaged || team ? [] : [resolve(".")]),
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
  settings = desktop.windows().find((p) => p.url().includes("view=settings"));
  await settings.waitForFunction(() => !!window.jinav);
}
async function evenlySpaced(page, selector, count) {
  const ring = page.locator(selector);
  await expect(ring.locator(".slot")).toHaveCount(count);
  const gaps = await ring.evaluate((element) => {
    const center = element.clientWidth / 2;
    const angles = Array.from(
      element.querySelectorAll(".slot"),
      (button) =>
        (Math.atan2(
          parseFloat(button.style.top) - center,
          parseFloat(button.style.left) - center,
        ) +
          Math.PI * 2.5) %
        (Math.PI * 2),
    ).sort((a, b) => a - b);
    return angles.map(
      (angle, index) =>
        angles[(index + 1) % angles.length] +
        (index === angles.length - 1 ? Math.PI * 2 : 0) -
        angle,
    );
  });
  for (const gap of gaps) expect(gap).toBeCloseTo((Math.PI * 2) / count, 3);
}
async function showMenu() {
  await settings.getByRole("button", { name: "Try menu", exact: true }).click();
  const wheel = desktop.windows().find((p) => !p.url().includes("view="));
  await expect
    .poll(() =>
      desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some(
          (w) => !w.webContents.getURL().includes("view=") && w.isVisible(),
        ),
      ),
    )
    .toBe(true);
  return wheel;
}
try {
  await launch();
  const catalogue = await settings.evaluate(() => window.jinav.discover());
  if (!catalogue.ok) throw Error(catalogue.error);
  const apps = catalogue.value.slice(0, 7);
  if (apps.length < 7)
    throw Error("This check needs seven real installed applications");
  const seeded = await settings.evaluate(async (apps) => {
    const r = await window.jinav.bootstrap();
    return window.jinav.saveConfig({
      ...r.value.config,
      apps: apps.slice(0, 6),
      showAsk: true,
      shortcut: "Ctrl+Alt+Shift+F10",
      aiEnabled: false,
      cloudConsent: false,
    });
  }, apps);
  if (!seeded.ok) throw Error(seeded.error);
  await settings.reload();
  await settings.waitForFunction(() => !!window.jinav);
  await evenlySpaced(settings, ".preview-wheel", 8);
  await settings
    .locator(".selected-apps li")
    .first()
    .locator("summary")
    .click();
  await settings.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(settings.locator(".selected-apps li")).toHaveCount(5);
  await evenlySpaced(settings, ".preview-wheel", 7);
  const after = await settings.evaluate(() => window.jinav.bootstrap());
  expect(after.value.config.apps.map((app) => app.id)).toEqual(
    apps.slice(1, 6).map((app) => app.id),
  );
  let wheel = await showMenu();
  await evenlySpaced(wheel, ".radial", 7);
  await wheel.keyboard.press("Escape");
  await desktop.close();
  desktop = undefined;
  await launch();
  await evenlySpaced(settings, ".preview-wheel", 7);
  evidence.checks.push(
    "Removing a real app evenly reflows seven remaining icons in preview and native menu; selected order and removal persist after restart",
  );
  await settings
    .getByRole("checkbox", { name: "Show Ask jinav", exact: true })
    .click();
  await evenlySpaced(settings, ".preview-wheel", 6);
  wheel = await showMenu();
  await evenlySpaced(wheel, ".radial", 6);
  await wheel.keyboard.press("Escape");
  const refreshed = await settings.evaluate(() => window.jinav.discover());
  if (!refreshed.ok) throw Error(refreshed.error);
  const paged = await settings.evaluate(
    async (apps) => {
      const r = await window.jinav.bootstrap();
      return window.jinav.saveConfig({
        ...r.value.config,
        apps,
        showAsk: true,
      });
    },
    refreshed.value.slice(0, 7),
  );
  if (!paged.ok) throw Error(paged.error);
  await settings.reload();
  await settings.waitForFunction(() => !!window.jinav);
  await settings.locator(".preview-wheel .wheel-page").click();
  await evenlySpaced(settings, ".preview-wheel", 3);
  wheel = await showMenu();
  await wheel.locator(".wheel-page").click();
  await evenlySpaced(wheel, ".radial", 3);
  await desktop.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows().find(
        (w) => !w.webContents.getURL().includes("view="),
      ),
      bounds = window.getBounds(),
      area = screen.getDisplayMatching(bounds).workArea;
    window.setPosition(
      Math.round(area.x + (area.width - bounds.width) / 2),
      Math.round(area.y + (area.height - bounds.height) / 2),
    );
  });
  await wheel.getByRole("button", { name: "Settings", exact: true }).hover();
  const tooltip = desktop
    .windows()
    .find((p) => p.url().includes("view=tooltip"));
  await expect(tooltip.locator(".native-tooltip")).toHaveAttribute(
    "data-side",
    "left",
  );
  await expect(tooltip.getByText("Settings", { exact: true })).toBeVisible();
  evidence.checks.push(
    "Hiding Ask leaves no reserved hole; partial final pages reflow to three icons and native Settings caption follows the new page geometry",
  );
  await wheel.keyboard.press("Escape");
  await mkdir("evidence/screenshots", { recursive: true });
  await settings.screenshot({ path: "evidence/screenshots/wheel-reflow.png" });
  evidence.result = "passed";
} catch (error) {
  evidence.failure = error.message;
  throw error;
} finally {
  if (desktop) await desktop.close();
  await mkdir("evidence", { recursive: true });
  await writeFile(
    `evidence/wheel-layout-${packaged || team ? "packaged" : "source"}.json`,
    JSON.stringify(evidence, null, 2),
  );
  if (!directory.startsWith(join(tmpdir(), "jinav-layout-")))
    throw Error("Unexpected test profile");
  await rm(directory, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(evidence, null, 2));
