// Verifies real wheel clicks activate Notepad without duplicating existing windows.
import { _electron, expect } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const directory = await mkdtemp(join(tmpdir(), "jinav-focus-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
const packaged = process.argv.includes("--packaged");
let desktop;
const evidence = {
  kind: "real-wheel-focus",
  packaged,
  result: "failed",
  checks: [],
};
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
  const notepad = catalogue.value.find((e) => /^notepad$/i.test(e.name));
  if (!notepad)
    throw Error("Installed Notepad is required for this Windows test");
  const configured = await settings.evaluate(async (entry) => {
    const r = await window.jinav.bootstrap();
    if (!r.ok) return r;
    return window.jinav.saveConfig({
      ...r.value.config,
      apps: [entry],
      aiEnabled: false,
      cloudConsent: false,
    });
  }, notepad);
  if (!configured.ok) throw Error(configured.error);
  for (let attempt = 0; attempt < 2; attempt++) {
    await settings.evaluate(() => window.jinav.settings());
    const before = await settings.evaluate(() => window.jinav.windows());
    if (!before.ok) throw Error(before.error);
    const beforeCount = before.value.filter((w) =>
      /^notepad\.exe$/i.test(w.app),
    ).length;
    await settings
      .getByRole("button", { name: "Try menu", exact: true })
      .click();
    const wheel = desktop.windows().find((p) => !p.url().includes("view="));
    await expect
      .poll(() =>
        desktop.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => !w.webContents.getURL().includes("view="))
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
          const r = await settings.evaluate(() => window.jinav.windows());
          return (
            r.ok &&
            r.value.some((w) => /^notepad\.exe$/i.test(w.app) && w.focused)
          );
        },
        { timeout: 20000 },
      )
      .toBe(true);
    const after = await settings.evaluate(() => window.jinav.windows());
    if (!after.ok) throw Error(after.error);
    const afterCount = after.value.filter((w) =>
      /^notepad\.exe$/i.test(w.app),
    ).length;
    if (beforeCount > 0) expect(afterCount).toBe(beforeCount);
    else expect(afterCount).toBeGreaterThan(0);
    evidence.checks.push({
      attempt: attempt + 1,
      beforeCount,
      afterCount,
      foregroundVerified: true,
    });
  }
  evidence.result = "passed";
} catch (error) {
  evidence.failure = error.message;
  throw error;
} finally {
  if (desktop) await desktop.close();
  await writeFile(
    packaged ? "evidence/packaged-focus.json" : "evidence/desktop-focus.json",
    JSON.stringify(evidence, null, 2),
  );
  if (!directory.startsWith(join(tmpdir(), "jinav-focus-")))
    throw Error("Unexpected test profile");
  await rm(directory, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(evidence, null, 2));
