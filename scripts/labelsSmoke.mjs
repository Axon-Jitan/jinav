// Verifies native hover labels stay outside the wheel with fully visible text.
import { _electron, expect } from "@playwright/test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const directory = await mkdtemp(join(tmpdir(), "jinav-labels-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
const packaged = process.argv.includes("--packaged");
const evidence = {
  kind: "real-native-wheel-labels",
  packaged,
  result: "failed",
  checks: [],
};
let desktop;
try {
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
  const settings = desktop
    .windows()
    .find((p) => p.url().includes("view=settings"));
  await settings.waitForFunction(() => !!window.jinav);
  const catalogue = await settings.evaluate(() => window.jinav.discover());
  if (!catalogue.ok) throw Error(catalogue.error);
  const entries = [...catalogue.value]
    .sort((a, b) => b.name.length - a.name.length)
    .slice(0, 6);
  const configured = await settings.evaluate(async (apps) => {
    const r = await window.jinav.bootstrap();
    if (!r.ok) return r;
    return window.jinav.saveConfig({
      ...r.value.config,
      shortcut: "Control+Alt+Shift+F11",
      apps,
      aiEnabled: false,
      cloudConsent: false,
    });
  }, entries);
  if (!configured.ok) throw Error(configured.error);
  await settings.getByRole("button", { name: "Try menu", exact: true }).click();
  const wheel = desktop.windows().find((p) => !p.url().includes("view="));
  const tooltip = desktop
    .windows()
    .find((p) => p.url().includes("view=tooltip"));
  await expect(wheel.locator("button.slot")).toHaveCount(8);
  await desktop.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows().find(
      (w) => !w.webContents.getURL().includes("view="),
    );
    const bounds = window.getBounds(),
      area = screen.getDisplayMatching(bounds).workArea;
    window.setBounds({
      ...bounds,
      x: Math.round(area.x + (area.width - bounds.width) / 2),
      y: Math.round(area.y + (area.height - bounds.height) / 2),
    });
  });
  for (const button of await wheel.locator("button.slot").all()) {
    const name = await button.getAttribute("aria-label");
    await button.hover();
    await expect(tooltip.locator(".native-tooltip")).toHaveText(name);
    await expect
      .poll(() =>
        desktop.evaluate(({ BrowserWindow }) => {
          const wheel = BrowserWindow.getAllWindows().find(
            (w) => !w.webContents.getURL().includes("view="),
          );
          const tooltip = BrowserWindow.getAllWindows().find((w) =>
            w.webContents.getURL().includes("view=tooltip"),
          );
          const a = wheel.getBounds(),
            b = tooltip.getBounds();
          return (
            tooltip.isVisible() &&
            (b.x + b.width <= a.x ||
              b.x >= a.x + a.width ||
              b.y + b.height <= a.y ||
              b.y >= a.y + a.height)
          );
        }),
      )
      .toBe(true);
    expect(
      await tooltip
        .locator(".native-tooltip > span")
        .evaluate(
          (e) =>
            e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight,
        ),
    ).toBe(true);
    const caption = await tooltip.locator(".native-tooltip").evaluate((e) => {
      const text = e.querySelector("span").getBoundingClientRect(),
        box = e.getBoundingClientRect();
      return {
        padding: box.width - text.width,
        centered:
          Math.abs(text.x + text.width / 2 - (box.x + box.width / 2)) < 1,
        arrow: getComputedStyle(e, "::after").content !== "none",
        side: e.getAttribute("data-side"),
      };
    });
    expect(caption.padding).toBeGreaterThanOrEqual(21);
    expect(caption.padding).toBeLessThanOrEqual(23);
    expect(caption.centered).toBe(true);
    expect(caption.arrow).toBe(true);
    expect(["left", "right", "top", "bottom"]).toContain(caption.side);
    if (caption.side === "bottom") {
      await mkdir("evidence/screenshots", { recursive: true });
      await tooltip.screenshot({
        path: "evidence/screenshots/centered-app-caption.png",
        omitBackground: true,
      });
    }
    evidence.checks.push({ name, outsideWheel: true, textFits: true, caption });
  }
  expect(new Set(evidence.checks.map((check) => check.caption.side))).toEqual(
    new Set(["left", "right", "top", "bottom"]),
  );
  await wheel.keyboard.press("Escape");
  evidence.result = "passed";
} catch (error) {
  evidence.failure = error.message;
  throw error;
} finally {
  if (desktop) await desktop.close();
  await writeFile(
    packaged ? "evidence/packaged-labels.json" : "evidence/desktop-labels.json",
    JSON.stringify(evidence, null, 2),
  );
  if (!directory.startsWith(join(tmpdir(), "jinav-labels-")))
    throw Error("Unexpected test profile");
  await rm(directory, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(evidence, null, 2));
