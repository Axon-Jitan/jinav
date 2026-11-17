// Exercises shortcut editing in a disposable profile, including native registration conflicts.
import { _electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { prepareRuntime } from "./prepareRuntime.mjs";
const profile = await mkdtemp(join(tmpdir(), "jinav-shortcut-"));
const packaged = process.argv.includes("--packaged"),
  native = process.argv.includes("--native-check");
const privatePackage = process.argv.includes("--team-package");
if (native && !process.stdin.isTTY)
  throw Error("Run --native-check in an interactive terminal (TTY required)");
const executable = privatePackage
  ? resolve("out/private-team/package/jinav-win32-x64/jinav.exe")
  : resolve("out/jinav-win32-x64/jinav.exe");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
let desktop, page;
const evidence = {
  kind: "real-shortcut-editor",
  packaged: packaged || privatePackage,
  result: "failed",
  nativeKeyDelivery: false,
  checks: [],
};
async function launch() {
  desktop = await _electron.launch({
    executablePath:
      packaged || privatePackage ? executable : await prepareRuntime(),
    args: [
      ...(packaged || privatePackage ? [] : [resolve(".")]),
      "--settings",
      `--user-data-dir=${profile}`,
    ],
    env,
  });
  await desktop.firstWindow();
  await expect
    .poll(() =>
      desktop.windows().some((p) => p.url().includes("view=settings")),
    )
    .toBe(true);
  page = desktop.windows().find((p) => p.url().includes("view=settings"));
  await page.waitForFunction(() => !!window.jinav);
}
async function config() {
  const r = await page.evaluate(() => window.jinav.bootstrap());
  if (!r.ok) throw Error(r.error);
  return r.value.config;
}
async function seed(shortcut) {
  const r = await page.evaluate(async (shortcut) => {
    const b = await window.jinav.bootstrap();
    return window.jinav.saveConfig({ ...b.value.config, shortcut });
  }, shortcut);
  if (!r.ok) throw Error(r.error);
  await page.reload();
  await page.waitForFunction(() => !!window.jinav);
  await general();
}
async function general() {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "General", exact: true })
    .click();
}
async function change() {
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
const textbox = () =>
  page.getByRole("textbox", { name: "Press your new shortcut", exact: true });
try {
  await launch();
  await seed("Ctrl+Alt+Shift+F6");
  await change();
  await expect(textbox()).toHaveValue("Ctrl+Alt+Shift+F6");
  await expect(textbox()).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Confirm", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Type instead", exact: true }).click();
  await textbox().fill("Ctrl+");
  await expect(
    page.getByRole("button", { name: "Confirm", exact: true }),
  ).toBeDisabled();
  await textbox().fill("Ctrl+Alt+Shift+F8");
  expect(
    await desktop.evaluate(({ globalShortcut }) =>
      globalShortcut.register("Ctrl+Alt+Shift+F8", () => {}),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Shortcut unavailable",
  );
  expect((await config()).shortcut).toBe("Ctrl+Alt+Shift+F6");
  expect(
    await desktop.evaluate(({ globalShortcut }) =>
      globalShortcut.isRegistered("Ctrl+Alt+Shift+F6"),
    ),
  ).toBe(true);
  await textbox().fill(" alt + ctrl + shift + f9 ");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await config()).shortcut).toBe("Ctrl+Alt+Shift+F9");
  await expect(page.locator(".error")).toHaveCount(0);
  await change();
  await page.getByRole("button", { name: "Type instead", exact: true }).click();
  await textbox().fill("Ctrl+Alt+Shift+F10");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await config()).shortcut).toBe("Ctrl+Alt+Shift+F9");
  await seed("Control+Alt+Shift+F11");
  await change();
  await page.getByRole("button", { name: "Type instead", exact: true }).click();
  await textbox().fill("alt+ctrl+shift+f11");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await config()).shortcut).toBe("Control+Alt+Shift+F11");
  await change();
  await textbox().press("Control+Alt+Shift+F12");
  await expect(
    page.getByRole("button", { name: "Record keys", exact: true }),
  ).toBeVisible();
  await expect(textbox()).toHaveValue("Ctrl+Alt+Shift+F12");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  evidence.checks.push(
    "Initial focus/current value, key recording, manual typing, invalid input, inline real-registration conflict, unchanged registration on failure, cancellation and modifier aliases",
  );
  await desktop.close();
  desktop = undefined;
  await launch();
  await general();
  expect((await config()).shortcut).toBe("Ctrl+Alt+Shift+F12");
  evidence.checks.push("Saved shortcut survives restart");
  if (native) {
    await desktop.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().includes("view=settings"))
        .setTitle("jinav shortcut recording test"),
    );
    await change();
    process.stdout.write(
      "NATIVE_READY: press Ctrl+Alt+Shift+F12 in jinav shortcut recording test.\n",
    );
    await expect(
      page.getByRole("button", { name: "Record keys", exact: true }),
    ).toBeVisible({ timeout: 120000 });
    await expect(textbox()).toHaveValue("Ctrl+Alt+Shift+F12");
    expect(
      await desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => !w.webContents.getURL().includes("view="))
          .isVisible(),
      ),
    ).toBe(false);
    evidence.nativeKeyDelivery = true;
    process.stdout.write(
      "NATIVE_CAPTURED: recorder received the registered shortcut without opening the launcher. Send a line to finish.\n",
    );
    await new Promise((resolve) => process.stdin.once("data", resolve));
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  await mkdir("evidence/screenshots", { recursive: true });
  await change();
  await page.screenshot({ path: "evidence/screenshots/shortcut-editor.png" });
  evidence.result = "passed";
} catch (error) {
  evidence.failure = error.message;
  throw error;
} finally {
  if (desktop) await desktop.close();
  await mkdir("evidence", { recursive: true });
  await writeFile(
    `evidence/shortcut-${packaged || privatePackage ? "packaged" : "source"}${native ? "-native" : ""}.json`,
    JSON.stringify(evidence, null, 2),
  );
  if (!profile.startsWith(join(tmpdir(), "jinav-shortcut-")))
    throw Error("Unexpected test profile");
  await rm(profile, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(evidence, null, 2));
