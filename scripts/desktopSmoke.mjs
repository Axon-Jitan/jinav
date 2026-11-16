// Exercises the real Electron host through its renderer; uses no model simulation.
import { _electron as electron, expect } from "@playwright/test";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
const directory = await mkdtemp(join(tmpdir(), "jinav-desktop-"));
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const evidence = {
  kind: "real-electron-smoke",
  runtime: "Electron 45.3.3",
  checks: [],
  showTimings: [],
  showMeasurements: [],
};
let desktop;
const packaged = process.env.JINAV_PACKAGED_EXECUTABLE;
const launchOptions = {
  ...(packaged ? { executablePath: resolve(packaged) } : {}),
  args: [...(packaged ? [] : [resolve(".")]), `--user-data-dir=${directory}`],
  env: environment,
};
evidence.packaged = !!packaged;
async function launch() {
  desktop = await electron.launch(launchOptions);
  desktop.process().stderr.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n")) {
      try {
        const value = JSON.parse(line);
        if (value.event === "launcher-show") {
          evidence.showTimings.push(value.milliseconds);
          evidence.showMeasurements.push({
            mode: value.mode,
            milliseconds: value.milliseconds,
          });
        }
      } catch {
        /* Native diagnostics are not persisted. */
      }
    }
  });
  const page = await desktop.firstWindow();
  await page.waitForFunction(() => !!window.jinav);
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  return page;
}
try {
  let page = await launch();
  const security = await desktop.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    const p = w.webContents.getLastWebPreferences();
    return {
      contextIsolation: p.contextIsolation,
      nodeIntegration: p.nodeIntegration,
      sandbox: p.sandbox,
    };
  });
  expect(security).toEqual({
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  });
  evidence.checks.push("renderer isolation and sandbox");
  const stored = await page.evaluate(() =>
    window.jinav.saveKey("jinav-test-key-not-a-real-credential"),
  );
  expect(stored.ok, JSON.stringify(stored)).toBe(true);
  const userData = await desktop.evaluate(({ app }) => app.getPath("userData"));
  if (stored.value.includes("protected")) {
    const encrypted = await readFile(join(userData, "credential.bin"));
    expect(
      encrypted.includes(Buffer.from("jinav-test-key-not-a-real-credential")),
    ).toBe(false);
    evidence.checks.push("real OS credential encryption");
  } else evidence.checks.push("explicit session-only credential fallback");
  const found = await page.evaluate(() => window.jinav.discover());
  expect(found.ok).toBe(true);
  const editor = found.value?.find((e) =>
    /system32\\notepad\.exe$/i.test(e.path),
  );
  const explorer = found.value?.find((e) =>
    /windows\\explorer\.exe$/i.test(e.path),
  );
  expect(editor).toBeTruthy();
  expect(explorer).toBeTruthy();
  evidence.checks.push(
    "native installed catalogue includes verified executable paths",
  );
  const config = (await page.evaluate(() => window.jinav.bootstrap())).value
    .config;
  const save = await page.evaluate(
    async ({ config, editor, explorer }) =>
      window.jinav.saveConfig({
        ...config,
        apps: [editor, explorer],
        aiEnabled: false,
      }),
    { config, editor, explorer },
  );
  expect(save.ok).toBe(true);
  const reboot = await page.evaluate(() => window.jinav.bootstrap());
  expect(reboot.value.config.apps.map((e) => e.id)).toEqual([
    editor.id,
    explorer.id,
  ]);
  // Activate a real installed editor through the launcher's validated capability.
  const opened = await page.evaluate(
    (id) => window.jinav.launch(id),
    editor.id,
  );
  if (!opened.ok) {
    expect(opened.error).toContain("foreground focus");
    evidence.checks.push(
      "AI-disabled launcher reports Windows foreground restriction without opening duplicates",
    );
  } else evidence.checks.push("AI-disabled editor launch/focus request");
  await desktop.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.show();
    w.focus();
  });
  const focused = await page.evaluate(
    (id) => window.jinav.launch(id),
    editor.id,
  );
  if (!focused.ok) {
    expect(focused.error).toContain("foreground focus");
    evidence.checks.push("existing-window focus restriction handled honestly");
  } else evidence.checks.push("existing editor focus or native window chooser");
  await desktop.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.show();
    w.focus();
  });
  await page.evaluate(
    async ({ config, editor, explorer }) =>
      window.jinav.saveConfig({
        ...config,
        apps: [explorer, editor],
        aiEnabled: false,
      }),
    { config, editor, explorer },
  );
  await desktop.close();
  desktop = undefined;
  // The same settings directory must survive process recreation.
  desktop = await electron.launch(launchOptions);
  desktop.process().stderr.on("data", (chunk) => {
    for (const line of chunk.toString().split("\n"))
      try {
        const value = JSON.parse(line);
        if (value.event === "launcher-show") {
          evidence.showTimings.push(value.milliseconds);
          evidence.showMeasurements.push({
            mode: value.mode,
            milliseconds: value.milliseconds,
          });
        }
      } catch {
        /* Ignore native diagnostics. */
      }
  });
  page = await desktop.firstWindow();
  await page.waitForFunction(() => !!window.jinav);
  const persisted = await page.evaluate(() => window.jinav.bootstrap());
  expect(persisted.value.config.apps.map((e) => e.id)).toEqual([
    explorer.id,
    editor.id,
  ]);
  evidence.checks.push("application reorder persists after restart");
  await page.evaluate(() => window.jinav.saveKey(""));
  await expect(
    page.getByRole("button", { name: "Ask jinav", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ask jinav", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "What would you like me to do?" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Start task" })).toBeDisabled();
  evidence.checks.push("radial menu and disabled-AI prompt");
  const registered = await desktop.evaluate(({ globalShortcut }) =>
    globalShortcut.isRegistered("Alt+Shift+Space"),
  );
  expect(registered).toBe(true);
  evidence.checks.push("native global shortcut registration");
  const unconfigured = await page.evaluate(() => window.jinav.testModel());
  expect(unconfigured.ok).toBe(false);
  expect(unconfigured.error).toContain("unconfigured");
  evidence.checks.push("unconfigured model failure");
  const status = await page.evaluate(() => window.jinav.driverStatus());
  expect(status.ok).toBe(true);
  const driver = JSON.parse(status.value);
  expect(driver.data.version).toBe("1.3.1");
  evidence.driver = {
    version: driver.data.version,
    protocol: driver.version,
    platform: driver.data.platform,
    permissions: driver.data.permissions,
  };
  evidence.checks.push("bundled driver status and permissions");
  if (packaged) {
    const resources = await desktop.evaluate(() => process.resourcesPath);
    const manifest = JSON.parse(
      await readFile(join(resources, "driver/manifest.json"), "utf8"),
    );
    expect(manifest.platform).toBe("win32");
    expect(manifest.arch).toBe("x64");
    const executable = manifest.files.find(
      (file) => file.name === "agent-desktop-win32-x64.exe",
    );
    expect(executable).toBeTruthy();
    const hash = createHash("sha256")
      .update(await readFile(join(resources, "driver", executable.name)))
      .digest("hex");
    expect(hash).toBe(executable.sha256);
    evidence.checks.push("packaged driver architecture and SHA-256 integrity");
  }
  await page.keyboard.press("Escape");
  expect(
    await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
  ).toBe(false);
  evidence.checks.push("Escape dismissal");
  for (let index = 0; index < 3; index++) {
    await desktop.evaluate(({ app }) => app.emit("second-instance"));
    await expect
      .poll(() =>
        desktop.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isVisible(),
        ),
      )
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "Ask jinav", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Ask jinav", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("button", { name: explorer.name, exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
  }
  evidence.checks.push(
    "warm menu opening through single-instance route and keyboard navigation",
  );
  const bounds = await desktop.evaluate(({ screen, BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return {
      window: w.getBounds(),
      displays: screen
        .getAllDisplays()
        .map((d) => ({ workArea: d.workArea, scaleFactor: d.scaleFactor })),
    };
  });
  evidence.bounds = bounds;
  evidence.result = "passed";
} catch (error) {
  evidence.result = "failed";
  evidence.failure = error.message;
  process.exitCode = 1;
} finally {
  if (desktop) await desktop.close();
  await rm(directory, { recursive: true, force: true });
  await mkdir("evidence", { recursive: true });
  await writeFile(
    packaged ? "evidence/packaged-smoke.json" : "evidence/desktop-smoke.json",
    JSON.stringify(evidence, null, 2),
  );
  process.stdout.write(JSON.stringify(evidence, null, 2) + "\n");
}
