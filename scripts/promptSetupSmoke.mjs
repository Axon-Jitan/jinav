// Verifies removal reflows both preview and native wheel in a disposable profile.
import { _electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { prepareRuntime } from "./prepareRuntime.mjs";
const directory = await mkdtemp(join(tmpdir(), "jinav-prompt-"));
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
  kind: "real-prompt-setup",
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
try {
  await launch();
  await settings.evaluate(() => window.jinav.prompt());
  const prompt = desktop.windows().find((p) => !p.url().includes("view="));
  const input = prompt.getByRole("textbox", {
    name: "What would you like me to do?",
    exact: true,
  });
  const run = prompt.getByRole("button", { name: "Run", exact: true });
  await expect(input).toBeVisible();
  await expect(run).toBeDisabled();
  const goal = "Open an allowed editor and write a test checklist";
  await input.fill(goal);
  await expect(run).toBeEnabled();
  await expect(prompt.getByRole("status")).toHaveText(
    "Enable Ask jinav in Settings to run this task.",
  );
  await run.click();
  await expect(
    settings.getByRole("heading", { name: "Ask jinav", exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByRole("button", { name: "Open Ask jinav", exact: true }),
  ).toBeVisible();
  const after = await settings.evaluate(async () => {
    const b = await window.jinav.bootstrap();
    const task = await window.jinav.taskState();
    return {
      ai: b.value.config.aiEnabled,
      consent: b.value.config.cloudConsent,
      allowed: b.value.config.allowedApps.length,
      phase: task.value.phase,
    };
  });
  expect(after).toEqual({
    ai: false,
    consent: false,
    allowed: 0,
    phase: "idle",
  });
  await settings
    .getByRole("button", { name: "Open Ask jinav", exact: true })
    .click();
  await expect(input).toHaveValue(goal);
  await expect(run).toBeEnabled();
  await input.fill("   ");
  await expect(run).toBeDisabled();
  await input.fill(goal);
  await prompt.evaluate(() => window.jinav.settings("ask"));
  await settings.evaluate(async () => {
    const b = await window.jinav.bootstrap();
    return window.jinav.saveConfig({
      ...b.value.config,
      aiEnabled: true,
      cloudConsent: true,
    });
  });
  await settings.evaluate(() => window.jinav.prompt());
  await expect(input).toHaveValue(goal);
  const boot = await prompt.evaluate(() => window.jinav.bootstrap());
  const expected = boot.value.modelProvisioned
    ? "Choose the apps Ask jinav may use. Your launcher icons do not grant AI access."
    : "Your model connection is not configured. Contact your IT team.";
  await expect(prompt.getByRole("status")).toHaveText(expected);
  await expect(run).toBeEnabled();
  await run.click();
  await expect(
    settings.getByRole("heading", { name: "Ask jinav", exact: true }),
  ).toBeVisible();
  const task = await settings.evaluate(() => window.jinav.taskState());
  expect(task.value.phase).toBe("idle");
  evidence.result = "passed";
  evidence.checks.push(
    "empty/whitespace goal disables Run; typed goal enables Run",
    "Run routes incomplete setup directly to Ask settings without granting permissions or starting a task",
    "typed task survives settings and prompt reopening",
    "fresh setup metadata reflected on return; no desktop/model task dispatched",
  );
} finally {
  if (desktop) await desktop.close();
  await mkdir("evidence", { recursive: true });
  await writeFile(
    `evidence/prompt-setup-${team ? "team" : packaged ? "packaged" : "source"}.json`,
    JSON.stringify(evidence, null, 2),
  );
  await rm(directory, { recursive: true, force: true });
}
console.log(JSON.stringify(evidence));
