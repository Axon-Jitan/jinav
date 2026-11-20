// Validates the real Electron UI with isolated profiles and actual installed apps.
// No model is simulated; physical global-shortcut delivery remains a separate manual check.
import { _electron as electron, expect } from "@playwright/test";
import {
  mkdtemp,
  rm,
  mkdir,
  readFile,
  writeFile,
  stat,
} from "node:fs/promises";
import { tmpdir, release, arch } from "node:os";
import { resolve, join } from "node:path";
import { captureWheel } from "./captureWheel.mjs";
const directory = await mkdtemp(join(tmpdir(), "jinav-desktop-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
const packaged = process.env.JINAV_PACKAGED_EXECUTABLE;
const evidence = {
  kind: "real-electron-approved-design",
  platform: process.platform,
  os: release(),
  arch: arch(),
  packaged: !!packaged,
  checks: [],
  showMeasurements: [],
  screenshots: [],
};
let desktop;
const screenshots = resolve("evidence/screenshots");
await mkdir(screenshots, { recursive: true });
async function launch() {
  desktop = await electron.launch({
    ...(packaged ? { executablePath: resolve(packaged) } : {}),
    args: [...(packaged ? [] : [resolve(".")]), `--user-data-dir=${directory}`],
    env,
  });
  desktop.process().stderr.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n")) {
      try {
        const value = JSON.parse(line);
        if (value.event === "launcher-show")
          evidence.showMeasurements.push(value);
      } catch {
        /* Do not persist native diagnostics or task content. */
      }
    }
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
  await expect
    .poll(async () =>
      settings.evaluate(async () => {
        const r = await window.jinav.bootstrap();
        return r.ok;
      }),
    )
    .toBe(true);
  await settings.evaluate(() => window.jinav.settings());
  await expect(
    settings.getByRole("heading", { name: "Menu", exact: true }),
  ).toBeVisible();
  return settings;
}
async function screenshot(page, name) {
  await page.screenshot({
    path: join(screenshots, name),
    animations: "disabled",
  });
  evidence.screenshots.push(name);
}
async function source(page, id) {
  await page
    .getByRole("combobox", { name: "Show on the wheel", exact: true })
    .click();
  await page
    .getByRole("option", {
      name: {
        selected: "Selected apps",
        running: "Currently open",
        recent: "Recently opened",
        frequent: "Frequently used",
      }[id],
      exact: false,
    })
    .click();
  await expect
    .poll(async () => {
      const r = await page.evaluate(() => window.jinav.bootstrap());
      return r.value.config.appSource;
    })
    .toBe(id);
}
try {
  let settings = await launch();
  evidence.environment = await desktop.evaluate(({ screen, app }) => ({
    electron: process.versions.electron,
    appVersion: app.getVersion(),
    displays: screen.getAllDisplays().map((d) => ({
      id: d.id,
      scaleFactor: d.scaleFactor,
      workArea: d.workArea,
    })),
  }));
  const security = await desktop.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().every((w) => {
      const p = w.webContents.getLastWebPreferences();
      return p.contextIsolation && p.sandbox && !p.nodeIntegration;
    }),
  );
  expect(security).toBe(true);
  evidence.checks.push("all three real windows isolated and sandboxed");
  const bootstrap = await settings.evaluate(() => window.jinav.bootstrap());
  expect(bootstrap.ok).toBe(true);
  expect(bootstrap.value.config.aiEnabled).toBe(false);
  expect(bootstrap.value.config.shortcut).toBe("Ctrl+Alt+Space");
  const catalogue = await settings.evaluate(() => window.jinav.discover());
  expect(catalogue.ok, JSON.stringify(catalogue)).toBe(true);
  const preferred = [
    /notepad/i,
    /calculator/i,
    /paint/i,
    /chrome/i,
    /edge/i,
    /explorer/i,
  ];
  const selected = [];
  const classic = catalogue.value.filter(
    (entry) => !entry.id.startsWith("aumid:"),
  );
  const available = await Promise.all(
    classic.map(async (entry) => {
      try {
        return (await stat(entry.path)).isFile();
      } catch {
        return false;
      }
    }),
  );
  expect(available.every(Boolean)).toBe(true);
  evidence.checks.push(
    "real Windows discovery excludes missing shortcut executable targets",
  );
  for (const match of preferred) {
    const app = catalogue.value.find(
      (e) => match.test(e.name) && !selected.some((a) => a.id === e.id),
    );
    if (app) selected.push(app);
  }
  for (const entry of catalogue.value) {
    if (selected.length >= 6) break;
    if (!selected.some((e) => e.id === entry.id)) selected.push(entry);
  }
  expect(selected.length).toBe(6);
  const pickerName =
    selected[0].name === "notepad" ? "Notepad" : selected[0].name;
  const saved = await settings.evaluate(async (apps) => {
    const b = await window.jinav.bootstrap();
    return window.jinav.saveConfig({ ...b.value.config, apps });
  }, selected);
  expect(saved.ok, JSON.stringify(saved)).toBe(true);
  await settings.evaluate(() => window.jinav.settings());
  // Reopen the renderer to represent a real window reload with persisted settings.
  await settings.reload();
  await expect(settings.locator(".selected-apps li")).toHaveCount(6);
  await screenshot(settings, "settings-menu.png");
  await settings.getByRole("button", { name: "Maximize", exact: true }).click();
  await expect
    .poll(() =>
      desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes("view=settings"))
          ?.isMaximized(),
      ),
    )
    .toBe(true);
  await settings
    .getByRole("button", { name: "Restore window", exact: true })
    .click();
  await expect
    .poll(() =>
      desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes("view=settings"))
          ?.isMaximized(),
      ),
    )
    .toBe(false);
  await settings.getByRole("button", { name: "Minimize", exact: true }).click();
  await expect
    .poll(() =>
      desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes("view=settings"))
          ?.isMinimized(),
      ),
    )
    .toBe(true);
  await settings.evaluate(() => window.jinav.settings());
  await expect
    .poll(() =>
      desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes("view=settings"))
          ?.isMinimized(),
      ),
    )
    .toBe(false);
  evidence.checks.push(
    "native maximize/restore/minimize controls and minimized-window reopening",
  );
  await expect
    .poll(
      async () => {
        const b = await settings.evaluate(() => window.jinav.bootstrap());
        return b.value.inputMonitoring;
      },
      { timeout: 15000 },
    )
    .toBe(true);
  evidence.checks.push("real Windows native event/input subscription ready");
  await desktop.evaluate(({ globalShortcut }) =>
    globalShortcut.register("Ctrl+Alt+K", () => {}),
  );
  const conflict = await settings.evaluate(async () => {
    const b = await window.jinav.bootstrap();
    return window.jinav.saveConfig({
      ...b.value.config,
      shortcut: "Ctrl+Alt+K",
    });
  });
  expect(conflict.ok).toBe(false);
  expect(
    await desktop.evaluate(({ globalShortcut }) =>
      globalShortcut.isRegistered("Ctrl+Alt+Space"),
    ),
  ).toBe(true);
  await desktop.evaluate(({ globalShortcut }) =>
    globalShortcut.unregister("Ctrl+Alt+K"),
  );
  evidence.checks.push(
    "actual OS shortcut conflict preserves prior working registration",
  );
  await settings.getByRole("button", { name: "General", exact: true }).click();
  await screenshot(settings, "settings-general.png");
  await settings.getByRole("button", { name: "Change", exact: true }).click();
  await expect(settings.getByRole("dialog")).toBeVisible();
  await settings.getByRole("dialog").press("Control+Alt+J");
  await settings.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (await settings.evaluate(() => window.jinav.bootstrap())).value.config
      .shortcut,
  ).toBe("Ctrl+Alt+Space");
  await settings
    .getByRole("button", { name: "Appearance", exact: true })
    .click();
  await screenshot(settings, "settings-appearance.png");
  await settings
    .getByRole("navigation")
    .getByRole("button", { name: "Ask jinav", exact: true })
    .click();
  await screenshot(settings, "settings-ask.png");
  await expect(
    settings.getByRole("button", { name: "Connect", exact: true }),
  ).toHaveCount(0);
  await expect(settings.getByText("AI provider", { exact: true })).toHaveCount(
    0,
  );
  await expect(settings.locator('input[type="password"]')).toHaveCount(0);
  await expect(
    settings.getByRole("checkbox", { name: "Enable Ask jinav", exact: true }),
  ).toBeVisible();
  evidence.checks.push(
    "coworker settings contain no provider connection or API-key fields",
  );
  await settings.getByRole("button", { name: "Menu", exact: true }).click();
  await settings.getByRole("button", { name: "Try menu", exact: true }).click();
  const wheel = desktop.windows().find((p) => !p.url().includes("view="));
  expect(wheel).toBeTruthy();
  await expect(wheel.locator(".slot")).toHaveCount(8);
  await expect
    .poll(() =>
      desktop.evaluate(({ BrowserWindow }) => {
        const settingsWindow = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().includes("view=settings"),
        );
        const menuWindow = BrowserWindow.getAllWindows().find(
          (w) => !w.webContents.getURL().includes("view="),
        );
        return {
          settingsVisible: settingsWindow?.isVisible(),
          menuVisible: menuWindow?.isVisible(),
        };
      }),
    )
    .toEqual({ settingsVisible: false, menuVisible: true });
  evidence.checks.push(
    "Try menu hides the Settings preview, showing only the real desktop wheel",
  );
  expect(
    await wheel.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
  ).toBe("jinav");
  const geometry = await wheel
    .getByRole("button", { name: "Settings", exact: true })
    .evaluate((e) => ({
      left: e.style.left,
      top: e.style.top,
      width: e.offsetWidth,
      height: e.offsetHeight,
    }));
  expect(geometry).toEqual({
    left: "124.426px",
    top: "124.426px",
    width: 44,
    height: 44,
  });
  expect(
    await wheel.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe("rgba(0, 0, 0, 0)");
  await screenshot(wheel, "wheel-ready.png");
  await captureWheel(
    desktop,
    join(screenshots, "wheel-native-transparency.png"),
  );
  evidence.screenshots.push("wheel-native-transparency.png");
  evidence.checks.push(
    "native Windows compositor capture over disposable two-colour backdrop",
  );
  await wheel.keyboard.press("ArrowRight");
  await expect(
    wheel.getByRole("button", { name: "Ask jinav", exact: true }),
  ).toBeFocused();
  await wheel.keyboard.press("ArrowRight");
  await wheel.keyboard.press("ArrowRight");
  await wheel.keyboard.press("ArrowRight");
  await expect(
    wheel.getByRole("button", { name: "Settings", exact: true }),
  ).toBeFocused();
  await screenshot(wheel, "wheel-settings-focus.png");
  await wheel.keyboard.press("Escape");
  await expect
    .poll(() =>
      desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes("view=settings"))
          ?.isFocused(),
      ),
    )
    .toBe(true);
  evidence.checks.push(
    "default 164-DIP geometry, eight slots, neutral initial focus, keyboard clockwise navigation, Escape returns to Settings, transparent renderer",
  );
  await settings.getByRole("button", { name: "Try menu", exact: true }).click();
  await expect
    .poll(() =>
      desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((window) => !window.webContents.getURL().includes("view="))
          ?.isFocused(),
      ),
    )
    .toBe(true);
  const focusTargetId = await desktop.evaluate(({ BrowserWindow }) => {
    const target = new BrowserWindow({
      width: 160,
      height: 100,
      show: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    target.focus();
    return target.id;
  });
  await expect
    .poll(() =>
      desktop.evaluate(
        ({ BrowserWindow }, id) =>
          BrowserWindow.getAllWindows().filter(
            (window) => window.isVisible() && window.id !== id,
          ).length,
        focusTargetId,
      ),
    )
    .toBe(0);
  await desktop.evaluate(
    ({ BrowserWindow }, id) => BrowserWindow.fromId(id)?.destroy(),
    focusTargetId,
  );
  await settings.evaluate(() => window.jinav.settings());
  evidence.checks.push(
    "Try menu focus-loss dismissal does not restore Settings over another app",
  );
  await settings
    .getByRole("checkbox", { name: "Show Ask jinav", exact: true })
    .click();
  await expect
    .poll(async () => {
      const r = await settings.evaluate(() => window.jinav.bootstrap());
      return r.value.config.showAsk;
    })
    .toBe(false);
  await settings.getByRole("button", { name: "Try menu", exact: true }).click();
  await expect(wheel.locator(".slot")).toHaveCount(7);
  expect(
    await wheel
      .getByRole("button", { name: "Settings", exact: true })
      .evaluate((e) => e.style.left),
  ).toBe("108.033px");
  await wheel.keyboard.press("Escape");
  await settings
    .getByRole("checkbox", { name: "Show Ask jinav", exact: true })
    .click();
  await expect
    .poll(async () => {
      const r = await settings.evaluate(() => window.jinav.bootstrap());
      return r.value.config.showAsk;
    })
    .toBe(true);
  const firstName = selected[0].name;
  await settings.getByRole("button", { name: "Try menu", exact: true }).click();
  await expect(wheel.locator(".slot")).toHaveCount(8);
  const reversed = [...selected].reverse();
  await wheel.evaluate(async (apps) => {
    const b = await window.jinav.bootstrap();
    return window.jinav.saveConfig({ ...b.value.config, apps });
  }, reversed);
  await expect(wheel.locator(".slot")).toHaveCount(8);
  expect(
    (await wheel.evaluate(() => window.jinav.bootstrap())).value.wheelApps[0]
      .name,
  ).toBe(firstName);
  await wheel.keyboard.press("Escape");
  await settings.reload();
  await expect(settings.locator(".selected-apps li").first()).toContainText(
    reversed[0].name,
  );
  evidence.checks.push(
    "Ask visibility compacts the wheel; manual order persists; session app list stays frozen during preference changes",
  );
  await source(settings, "running");
  await expect(
    settings.getByRole("button", { name: "Add app", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(async () => {
      const r = await settings.evaluate(() => window.jinav.bootstrap());
      return r.value.config.appSource;
    })
    .toBe("running");
  await source(settings, "recent");
  await expect(
    settings.getByRole("button", {
      name: "Clear app-use history",
      exact: true,
    }),
  ).toBeVisible();
  await settings
    .getByRole("button", { name: "Clear app-use history", exact: true })
    .click();
  await expect(settings.getByRole("alertdialog")).toBeVisible();
  await settings.getByRole("button", { name: "Cancel", exact: true }).click();
  await source(settings, "frequent");
  await source(settings, "selected");
  await expect(settings.locator(".selected-apps li")).toHaveCount(6);
  await settings.locator(".selected-apps li").last().locator("summary").click();
  await settings.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(settings.locator(".selected-apps li")).toHaveCount(5);
  await settings.getByRole("button", { name: "Add app", exact: true }).click();
  await expect(settings.getByRole("dialog")).toBeVisible();
  await expect(
    settings.getByRole("dialog", { name: "Choose your apps", exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByRole("button", { name: "Save selection", exact: true }),
  ).toBeDisabled();
  await expect(
    settings
      .getByRole("dialog")
      .getByRole("checkbox", { name: /Data Source Administrator/ }),
  ).toHaveCount(0);
  await settings
    .getByRole("textbox", {
      name: "Search installed applications",
      exact: true,
    })
    .fill("jinav-no-such-application");
  await expect(settings.locator(".picker-list")).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: 45000 },
  );
  await expect(
    settings.getByText("No apps found", {
      exact: true,
    }),
  ).toBeVisible();
  await settings.getByRole("dialog").press("Escape");
  await expect(settings.locator(".selected-apps li")).toHaveCount(5);
  await settings.getByRole("button", { name: "Add app", exact: true }).click();
  await settings
    .getByRole("textbox", {
      name: "Search installed applications",
      exact: true,
    })
    .fill(selected[0].name);
  await expect(settings.locator(".picker-list")).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: 45000 },
  );
  await settings
    .getByRole("dialog")
    .getByRole("checkbox", { name: pickerName, exact: true })
    .check();
  await expect(settings.locator(".selected-apps li")).toHaveCount(5);
  await settings
    .getByRole("button", { name: `Remove ${pickerName}`, exact: true })
    .click();
  await expect(
    settings
      .getByRole("dialog")
      .getByRole("checkbox", { name: pickerName, exact: true }),
  ).not.toBeChecked();
  await settings
    .getByRole("dialog")
    .getByRole("checkbox", { name: pickerName, exact: true })
    .check();
  await screenshot(settings, "add-app.png");
  expect(
    await settings
      .getByRole("dialog")
      .evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
  ).toBe(true);
  await expect(
    settings.getByRole("button", {
      name: `Remove ${pickerName}`,
      exact: true,
    }),
  ).toBeVisible();
  await settings
    .getByRole("button", { name: "Save selection", exact: true })
    .click();
  await expect(settings.locator(".selected-apps li")).toHaveCount(6);
  evidence.checks.push(
    "redesigned installed-app picker: system tools hidden by default, searchable apps, removable selected chips, no changes before save and Escape cancellation",
  );
  evidence.checks.push(
    "running/recent source controls, read-only derived view, history-clear confirmation, manual list preserved across modes",
  );
  await settings.getByRole("button", { name: "Try menu", exact: true }).click();
  await wheel.getByRole("button", { name: "Ask jinav", exact: true }).click();
  await expect(
    wheel.getByRole("textbox", {
      name: "What would you like me to do?",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    wheel.getByRole("button", { name: "Run", exact: true }),
  ).toBeDisabled();
  await screenshot(wheel, "ask-disconnected.png");
  await wheel.keyboard.press("Escape");
  const connection = await settings.evaluate(() => window.jinav.testModel());
  expect(connection.ok).toBe(false);
  expect(connection.error).toContain("unconfigured");
  evidence.checks.push(
    "Ask opens compact prompt without model; empty goal disables Run; real unconfigured provider failure",
  );
  const beforeWindows = await settings.evaluate(() => window.jinav.windows());
  const notepad = selected.find((e) => /notepad/i.test(e.name));
  if (notepad) {
    await settings.evaluate(() => window.jinav.settings());
    await settings
      .getByRole("button", { name: "Try menu", exact: true })
      .click();
    await expect
      .poll(() =>
        desktop.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((window) => !window.webContents.getURL().includes("view="))
            ?.isFocused(),
        ),
      )
      .toBe(true);
    await wheel
      .getByRole("button", { name: notepad.name, exact: true })
      .click();
    await expect
      .poll(
        async () => {
          const current = await settings.evaluate(() => window.jinav.windows());
          return (
            current.ok &&
            current.value.some(
              (window) => /^notepad\.exe$/i.test(window.app) && window.focused,
            )
          );
        },
        { timeout: 15000 },
      )
      .toBe(true);
    const before = beforeWindows.ok
      ? beforeWindows.value.filter((w) => /^notepad\.exe$/i.test(w.app)).length
      : 0;
    const after = await settings.evaluate(() => window.jinav.windows());
    const count = after.ok
      ? after.value.filter((w) => /^notepad\.exe$/i.test(w.app)).length
      : 0;
    evidence.nativeEditor = {
      result: "real wheel click verified Notepad foreground",
      windowsBefore: before,
      windowsAfter: count,
    };
    if (before > 0) expect(count).toBe(before);
    evidence.checks.push(
      "real wheel icon click brings Notepad to the foreground with AI disabled and no duplicate window",
    );
  }
  const keyResult = await settings.evaluate(() =>
    window.jinav.saveKey("jinav-diagnostic-not-a-real-key"),
  );
  expect(keyResult.ok).toBe(true);
  expect(
    await readFile(join(directory, "settings.json"), "utf8"),
  ).not.toContain("jinav-diagnostic");
  await settings.evaluate(() => window.jinav.saveKey(""));
  await desktop.close();
  desktop = undefined;
  settings = await launch();
  await expect(settings.locator(".selected-apps li").first()).toContainText(
    reversed[0].name,
  );
  evidence.checks.push(
    "restart preserves reordered manual list and source; credentials excluded from preferences",
  );
  evidence.result = "passed";
} catch (error) {
  evidence.result = "failed";
  evidence.failure = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  if (desktop) await desktop.close();
  const file = packaged
    ? "evidence/packaged-smoke.json"
    : "evidence/desktop-smoke.json";
  await writeFile(file, JSON.stringify(evidence, null, 2));
  const target = resolve(directory);
  if (
    !target.startsWith(resolve(tmpdir()) + "\\") ||
    !target.includes("jinav-desktop-")
  )
    throw Error("Unexpected diagnostic profile path");
  await rm(target, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(evidence, null, 2) + "\n");
