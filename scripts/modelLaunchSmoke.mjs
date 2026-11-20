// Opt-in real provider/driver test restricted to opening Calculator; never approves edits or other apps.
import { _electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
if (!process.argv.includes("--real-model"))
  throw Error(
    "Pass --real-model to authorize a real provider request and Calculator launch test.",
  );
const directory = await mkdtemp(join(tmpdir(), "jinav-model-launch-"));
const executable = resolve(
  "out/private-team/package/jinav-win32-x64/jinav.exe",
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
let desktop, settings;
const evidence = {
  kind: "real-model-app-launch",
  packaged: true,
  result: "failed",
  checks: [],
};
async function launch() {
  desktop = await _electron.launch({
    executablePath: executable,
    args: ["--settings", `--user-data-dir=${directory}`],
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
  const configured = await settings.evaluate(async () => {
    const b = await window.jinav.bootstrap();
    if (!b.ok || !b.value.modelProvisioned)
      throw Error("Test model is not provisioned.");
    const apps = await window.jinav.discover();
    if (!apps.ok) throw Error(apps.error);
    const calculator = apps.value.find((a) => /^calculator$/i.test(a.name));
    if (!calculator) throw Error("Calculator is not installed.");
    const saved = await window.jinav.saveConfig({
      ...b.value.config,
      aiEnabled: true,
      cloudConsent: true,
      appCatalogConsent: true,
      appAccess: "selected",
      allowedApps: [calculator],
      pauseOnUserInput: false,
      physicalInput: false,
      keepTaskHistory: false,
      maxSteps: 6,
      maxSeconds: 90,
      maxTokens: 10000,
    });
    if (!saved.ok) throw Error(saved.error);
    return { appName: calculator.name, model: b.value.config.model };
  });
  evidence.model = configured.model;
  evidence.modelUsed = true;
  const started = await settings.evaluate(() =>
    window.jinav.startTask({
      goal: "Open Calculator. Do not type, click controls, perform calculations, edit, or save anything. Finish only after fresh accessibility observation confirms Calculator is visible.",
    }),
  );
  if (!started.ok) throw Error(started.error);
  let lastPhase = "";
  const deadline = Date.now() + 100000;
  let launchApproved = false;
  while (Date.now() < deadline) {
    const r = await settings.evaluate(() => window.jinav.taskState());
    if (!r.ok) throw Error(r.error);
    const state = r.value;
    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      console.log(`Task phase: ${state.phase}, step: ${state.step}`);
    }
    if (state.phase === "waiting_for_approval") {
      const approval = JSON.parse(state.approval || "{}");
      if (
        approval.action !== "Open application" ||
        approval.application !== configured.appName ||
        launchApproved
      )
        throw Error("Model requested an action outside this launch-only test.");
      launchApproved = true;
      evidence.launchApproved = true;
      const approved = await settings.evaluate(() =>
        window.jinav.approve(true),
      );
      if (!approved.ok) throw Error(approved.error);
    }
    if (["completed", "failed", "cancelled"].includes(state.phase)) {
      evidence.finalPhase = state.phase;
      evidence.steps = state.step;
      if (state.phase !== "completed") throw Error(state.message);
      expect(launchApproved).toBe(true);
      const windows = await settings.evaluate(() => window.jinav.windows());
      if (!windows.ok) throw Error(windows.error);
      expect(
        windows.value.some((w) => /calculator|calc\.exe/i.test(w.app)),
      ).toBe(true);
      evidence.nativeWindowVerified = true;
      const progress = desktop
        .windows()
        .find((p) => !p.url().includes("view="));
      await expect(
        progress.getByRole("button", { name: "Back to task", exact: true }),
      ).toBeVisible();
      await progress
        .getByRole("button", { name: "Back to task", exact: true })
        .click();
      await expect(
        progress.getByRole("textbox", {
          name: "What would you like me to do?",
          exact: true,
        }),
      ).toBeVisible();
      evidence.returnToPromptVerified = true;
      evidence.result = "passed";
      evidence.checks.push(
        "real provider chose Calculator from a one-app catalogue",
        "only exact Calculator launch approved; physical input disabled",
        "native launch/focus followed by fresh accessibility observation and model completion evidence",
      );
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (evidence.result !== "passed")
    throw Error("Launch-only test deadline exceeded.");
} catch (error) {
  evidence.error = error.message;
  throw error;
} finally {
  if (settings)
    await settings.evaluate(() => window.jinav.stopTask()).catch(() => {});
  if (desktop) await desktop.close();
  await mkdir("evidence", { recursive: true });
  await writeFile(
    "evidence/model-app-launch.json",
    JSON.stringify(evidence, null, 2),
  );
  await rm(directory, { recursive: true, force: true });
}
console.log(JSON.stringify(evidence));
