// Exercises real Settings choices in an isolated profile without desktop observation.
import { _electron, expect } from "@playwright/test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const directory = await mkdtemp(join(tmpdir(), "jinav-settings-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
const packaged = process.argv.includes("--packaged");
let desktop, page;
const evidence = {
  kind: "real-settings-ui",
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
  await expect
    .poll(() =>
      desktop.windows().some((p) => p.url().includes("view=settings")),
    )
    .toBe(true);
  page = desktop.windows().find((p) => p.url().includes("view=settings"));
  await page.waitForFunction(() => !!window.jinav);
}
async function nav(name) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
async function config() {
  const r = await page.evaluate(() => window.jinav.bootstrap());
  if (!r.ok) throw Error(r.error);
  return r.value.config;
}
async function choose(label, value, key) {
  await page
    .getByRole("combobox", { name: label, exact: true })
    .selectOption(value);
  await expect.poll(async () => (await config())[key]).toBe(value);
  await expect(
    page.getByRole("combobox", { name: label, exact: true }),
  ).toBeEnabled();
}
try {
  await launch();
  await nav("General");
  await choose("Activation style", "open", "activationStyle");
  await choose("Activation style", "toggle", "activationStyle");
  await page
    .getByRole("checkbox", { name: "Start quietly", exact: true })
    .click();
  await expect.poll(async () => (await config()).startQuietly).toBe(false);
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Press your new shortcut" })
    .press("Control+Alt+Shift+F7");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect
    .poll(async () => (await config()).shortcut)
    .toBe("Ctrl+Alt+Shift+F7");
  evidence.checks.push(
    "General activation choices, Start quietly and real global shortcut replacement save successfully",
  );
  await nav("Appearance");
  expect(
    await page.evaluate(() => CSS.supports("appearance", "base-select")),
  ).toBe(true);
  for (const [value, pixels] of [
    ["small", 20],
    ["medium", 24],
    ["large", 32],
  ]) {
    await choose("Icon size", value, "iconSize");
    await expect(page.locator(".preview-wheel .ask-slot img")).toHaveCSS(
      "width",
      `${pixels}px`,
    );
    await expect(page.locator(".preview-wheel .ask-slot")).toHaveCSS(
      "width",
      "44px",
    );
  }
  for (const value of ["none", "soft", "solid"]) {
    await choose("Background", value, "menuBackground");
    await expect(page.locator(".preview-wheel")).toHaveClass(
      new RegExp(`background-${value}`),
    );
  }
  await choose("App names", "hidden", "appNames");
  await page.locator(".preview-wheel .ask-slot").hover();
  await expect(page.locator(".preview-caption")).toHaveCount(0);
  await choose("App names", "hover", "appNames");
  await choose("Label position", "bottom", "labelPosition");
  await page.locator(".preview-wheel .ask-slot").hover();
  await expect(page.locator(".preview-caption")).toHaveAttribute(
    "data-side",
    "bottom",
  );
  await choose("Label position", "top", "labelPosition");
  await page.locator(".preview-wheel .ask-slot").hover();
  await expect(page.locator(".preview-caption")).toHaveAttribute(
    "data-side",
    "top",
  );
  await page
    .getByRole("combobox", { name: "Animation", exact: true })
    .selectOption("reduced");
  await expect.poll(async () => (await config()).reducedMotion).toBe(true);
  await choose("Theme", "dark", "theme");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".settings-layout")).toHaveCSS(
    "background-color",
    "rgb(32, 32, 32)",
  );
  await mkdir("evidence/screenshots", { recursive: true });
  await page.screenshot({ path: "evidence/screenshots/settings-dark.png" });
  await page.getByRole("button", { name: "Try menu", exact: true }).click();
  const darkWheel = desktop.windows().find((p) => !p.url().includes("view="));
  await expect
    .poll(() =>
      desktop.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some(
          (w) =>
            !w.webContents.getURL().includes("view=") &&
            w.isVisible() &&
            w.isFocused(),
        ),
      ),
    )
    .toBe(true);
  await darkWheel
    .getByRole("button", { name: "Ask jinav", exact: true })
    .click();
  await expect(darkWheel.locator(".prompt-panel")).toHaveCSS(
    "background-color",
    "rgb(32, 32, 32)",
  );
  await darkWheel.keyboard.press("Escape");
  await nav("Appearance");
  await choose("Theme", "system", "theme");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await choose("Theme", "light", "theme");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: "evidence/screenshots/settings-light.png" });
  await page.getByRole("button", { name: "Try menu", exact: true }).click();
  const wheel = desktop.windows().find((p) => !p.url().includes("view="));
  await expect(wheel.locator(".radial")).toHaveClass(
    /icons-large background-solid/,
  );
  await expect(wheel.locator(".ask-slot img")).toHaveCSS("width", "32px");
  await wheel.keyboard.press("Escape");
  await expect(page.getByRole("navigation")).toBeVisible();
  evidence.checks.push(
    "All icon sizes, background styles, hidden/hover labels, above/below captions, reduced motion and light/dark/live system theme affect the rendered UI",
  );
  await nav("Ask jinav");
  await expect(page.getByText("Always required", { exact: true })).toHaveCount(
    2,
  );
  await expect(
    page.getByRole("checkbox", { name: "Confirm external actions" }),
  ).toHaveCount(0);
  expect((await config()).aiEnabled).toBe(false);
  await desktop.close();
  desktop = undefined;
  await launch();
  const saved = await config();
  expect(saved).toMatchObject({
    iconSize: "large",
    menuBackground: "solid",
    appNames: "hover",
    labelPosition: "top",
    reducedMotion: true,
    theme: "light",
    startQuietly: false,
    shortcut: "Ctrl+Alt+Shift+F7",
  });
  evidence.checks.push(
    "Preferences persist across actual app restart; mandatory security policies are plain text; AI stays disabled",
  );
  evidence.result = "passed";
} catch (error) {
  evidence.failure = error.message;
  throw error;
} finally {
  if (desktop) await desktop.close();
  await mkdir("evidence", { recursive: true });
  await writeFile(
    `evidence/settings-${packaged ? "packaged" : "source"}.json`,
    JSON.stringify(evidence, null, 2),
  );
  if (!directory.startsWith(join(tmpdir(), "jinav-settings-")))
    throw Error("Unexpected test profile");
  await rm(directory, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(evidence, null, 2));
