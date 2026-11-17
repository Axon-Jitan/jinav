// Verifies radius editing, native geometry, frozen sessions and restart persistence.
import { _electron, expect } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const directory = await mkdtemp(join(tmpdir(), "jinav-radius-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
const packaged = process.argv.includes("--packaged");
let desktop, settings;
const evidence = {
  kind: "real-wheel-radius",
  packaged,
  result: "failed",
  checks: [],
};
async function launch() {
  desktop = await _electron.launch({
    ...(packaged
      ? { executablePath: resolve("out/jinav-win32-x64/jinav.exe") }
      : {}),
    args: [...(packaged ? [] : [resolve(".")]), `--user-data-dir=${directory}`],
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
try {
  await launch();
  const saved = await settings.evaluate(async () => {
    const r = await window.jinav.bootstrap();
    if (!r.ok) return r;
    return window.jinav.saveConfig({
      ...r.value.config,
      shortcut: "Control+Alt+Shift+F10",
    });
  });
  if (!saved.ok) throw Error(saved.error);
  await settings.reload();
  await settings.waitForFunction(() => !!window.jinav);
  await settings
    .getByRole("button", { name: "Appearance", exact: true })
    .click();
  for (const [key, radius, size] of [
    ["Home", 58, 160],
    ["End", 110, 264],
  ]) {
    const slider = settings.getByRole("slider", {
      name: "Distance from cursor",
      exact: true,
    });
    await slider.focus();
    await slider.press(key);
    await expect
      .poll(async () => {
        const r = await settings.evaluate(() => window.jinav.bootstrap());
        return r.ok ? r.value.config.menuRadius : 0;
      })
      .toBe(radius);
    expect(
      await settings
        .locator(".preview-wheel")
        .evaluate((e) => e.getBoundingClientRect().width),
    ).toBe(size);
    await settings
      .getByRole("button", { name: "Try menu", exact: true })
      .click();
    const wheel = desktop.windows().find((p) => !p.url().includes("view="));
    await expect
      .poll(() =>
        desktop
          .evaluate(({ BrowserWindow }) => {
            const w = BrowserWindow.getAllWindows().find(
              (w) => !w.webContents.getURL().includes("view="),
            );
            return w?.isVisible() ? w.getBounds().width : 0;
          })
          .then((width) => Math.abs(width - size)),
      )
      .toBeLessThanOrEqual(1);
    expect(
      await wheel
        .locator(".radial")
        .evaluate((e) => e.getBoundingClientRect().width),
    ).toBe(size);
    expect(
      await wheel
        .locator(".slot")
        .first()
        .evaluate((e) => e.getBoundingClientRect().width),
    ).toBe(44);
    await wheel.getByRole("button", { name: "Ask jinav", exact: true }).hover();
    await expect
      .poll(() =>
        desktop.evaluate(({ BrowserWindow }) => {
          const a = BrowserWindow.getAllWindows()
            .find((w) => !w.webContents.getURL().includes("view="))
            ?.getBounds();
          const tooltip = BrowserWindow.getAllWindows().find((w) =>
            w.webContents.getURL().includes("view=tooltip"),
          );
          const b = tooltip?.getBounds();
          return (
            tooltip?.isVisible() &&
            (b.x + b.width <= a.x ||
              b.x >= a.x + a.width ||
              b.y + b.height <= a.y ||
              b.y >= a.y + a.height)
          );
        }),
      )
      .toBe(true);
    if (radius === 110) {
      const r = await settings.evaluate(async () => {
        const b = await window.jinav.bootstrap();
        return window.jinav.saveConfig({ ...b.value.config, menuRadius: 88 });
      });
      if (!r.ok) throw Error(r.error);
      expect(
        (await wheel.evaluate(() => window.jinav.bootstrap())).value
          .wheelRadius,
      ).toBe(110);
      expect(
        await wheel
          .locator(".radial")
          .evaluate((e) => e.getBoundingClientRect().width),
      ).toBe(264);
    }
    await wheel.keyboard.press("Escape");
    evidence.checks.push({ radius, size, targets: 44, tooltipOutside: true });
    await settings
      .getByRole("button", { name: "Appearance", exact: true })
      .click();
  }
  await desktop.close();
  desktop = undefined;
  await launch();
  await settings
    .getByRole("button", { name: "Appearance", exact: true })
    .click();
  await expect(
    settings.getByRole("slider", { name: "Distance from cursor", exact: true }),
  ).toHaveValue("88");
  await settings.getByRole("button", { name: "Try menu", exact: true }).click();
  await expect
    .poll(() =>
      desktop
        .evaluate(
          ({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()
              .find((w) => !w.webContents.getURL().includes("view="))
              ?.getBounds().width,
        )
        .then((width) => Math.abs((width ?? 0) - 220)),
    )
    .toBeLessThanOrEqual(1);
  evidence.persistenceAndFrozenSession = true;
  evidence.result = "passed";
} catch (error) {
  evidence.failure = error.message;
  throw error;
} finally {
  if (desktop) await desktop.close();
  await writeFile(
    packaged ? "evidence/packaged-radius.json" : "evidence/desktop-radius.json",
    JSON.stringify(evidence, null, 2),
  );
  if (!directory.startsWith(join(tmpdir(), "jinav-radius-")))
    throw Error("Unexpected test profile");
  await rm(directory, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(evidence, null, 2));
