// Verifies explicit app-scope choices without enabling AI or sending desktop content.
import { _electron, expect } from "@playwright/test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const directory = await mkdtemp(join(tmpdir(), "jinav-access-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
const packaged = process.argv.includes("--packaged");
let desktop, settings;
const evidence = {
  kind: "real-app-access-settings",
  packaged,
  result: "failed",
  checks: [],
};
async function launch() {
  desktop = await _electron.launch({
    ...(packaged
      ? { executablePath: resolve("out/jinav-win32-x64/jinav.exe") }
      : {}),
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
  settings = desktop.windows().find((p) => p.url().includes("view=settings"));
  await settings.waitForFunction(() => !!window.jinav);
}
async function ask() {
  await settings
    .getByRole("navigation")
    .getByRole("button", { name: "Ask jinav", exact: true })
    .click();
}
async function config() {
  const r = await settings.evaluate(() => window.jinav.bootstrap());
  if (!r.ok) throw Error(r.error);
  return r.value.config;
}
try {
  await launch();
  const seeded = await settings.evaluate(async () => {
    const r = await window.jinav.bootstrap();
    return window.jinav.saveConfig({
      ...r.value.config,
      shortcut: "Control+Alt+Shift+F8",
    });
  });
  if (!seeded.ok) throw Error(seeded.error);
  await settings.reload();
  await settings.waitForFunction(() => !!window.jinav);
  await ask();
  const access = () =>
    settings.getByRole("combobox", { name: "Application access", exact: true });
  await expect(access()).toHaveValue("selected");
  await expect(
    settings.getByText("Task app only", { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByRole("combobox", { name: "Screen access", exact: true }),
  ).toHaveCount(0);
  await settings
    .getByRole("button", { name: "Choose apps", exact: true })
    .click();
  await settings
    .getByRole("textbox", {
      name: "Search installed applications",
      exact: true,
    })
    .fill("notepad");
  await expect(settings.locator(".picker-list")).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: 45000 },
  );
  await settings
    .getByRole("dialog")
    .getByRole("checkbox", { name: /^Notepad$/i })
    .check();
  await settings
    .getByRole("button", { name: "Save selection", exact: true })
    .click();
  await expect.poll(async () => (await config()).allowedApps.length).toBe(1);
  const selected = (await config()).allowedApps;
  await access().selectOption("all");
  await expect(
    settings.getByRole("alertdialog", {
      name: "Allow all installed apps?",
      exact: true,
    }),
  ).toBeVisible();
  expect((await config()).appAccess).toBe("selected");
  await settings.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(access()).toHaveValue("selected");
  await access().selectOption("all");
  await settings
    .getByRole("button", { name: "Allow all installed apps", exact: true })
    .click();
  await expect.poll(async () => (await config()).appAccess).toBe("all");
  const all = await config();
  expect(all.allowedApps).toEqual(selected);
  expect(all.appCatalogConsent).toBe(true);
  expect(all.aiEnabled).toBe(false);
  expect(all.cloudConsent).toBe(false);
  expect(all.physicalInput).toBe(false);
  await expect(
    settings.getByRole("button", { name: "Choose apps", exact: true }),
  ).toHaveCount(0);
  await access().selectOption("selected");
  await expect.poll(async () => (await config()).appAccess).toBe("selected");
  expect((await config()).allowedApps).toEqual(selected);
  await expect(
    settings.getByRole("button", { name: "Choose apps", exact: true }),
  ).toBeVisible();
  await access().selectOption("all");
  await settings
    .getByRole("button", { name: "Allow all installed apps", exact: true })
    .click();
  await expect.poll(async () => (await config()).appAccess).toBe("all");
  await desktop.close();
  desktop = undefined;
  await launch();
  await ask();
  await expect(access()).toHaveValue("all");
  expect((await config()).allowedApps).toEqual(selected);
  await mkdir("evidence/screenshots", { recursive: true });
  await settings.screenshot({
    path: "evidence/screenshots/app-access-settings.png",
  });
  evidence.checks.push(
    "default selected scope; native app selection; cancel does not grant; explicit all-app approval; narrower list preserved; AI/cloud/physical permissions remain off; restart persistence; honest task-app-only observation label",
  );
  evidence.result = "passed";
} catch (error) {
  evidence.failure = error.message;
  throw error;
} finally {
  if (desktop) await desktop.close();
  await writeFile(
    packaged
      ? "evidence/packaged-app-access.json"
      : "evidence/desktop-app-access.json",
    JSON.stringify(evidence, null, 2),
  );
  if (!directory.startsWith(join(tmpdir(), "jinav-access-")))
    throw Error("Unexpected test profile");
  await rm(directory, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(evidence, null, 2));
