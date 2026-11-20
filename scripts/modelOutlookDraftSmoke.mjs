// Opt-in real model Outlook draft check; rejects sending, unknown controls, and non-test text.
import { _electron, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
if (!process.argv.includes("--real-model"))
  throw Error(
    "Pass --real-model to authorize a real provider request and Outlook launch test.",
  );
const directory = await mkdtemp(join(tmpdir(), "jinav-model-outlook-"));
const executable = resolve(
  "out/private-team/package/jinav-win32-x64/jinav.exe",
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
let desktop, settings;
const evidence = {
  kind: "real-model-outlook-draft",
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
    const outlook = apps.value.find((a) => /OUTLOOK\.EXE$/i.test(a.path));
    if (!outlook) throw Error("Outlook is not installed.");
    const saved = await window.jinav.saveConfig({
      ...b.value.config,
      aiEnabled: true,
      cloudConsent: true,
      appCatalogConsent: true,
      appAccess: "selected",
      allowedApps: [outlook],
      pauseOnUserInput: true,
      physicalInput: false,
      keepTaskHistory: false,
      maxSteps: 20,
      maxSeconds: 180,
      maxTokens: 20000,
    });
    if (!saved.ok) throw Error(saved.error);
    return { appName: outlook.name, model: b.value.config.model };
  });
  evidence.model = configured.model;
  evidence.modelUsed = false;
  const started = await settings.evaluate(() =>
    window.jinav.startTask({
      goal: 'Use only Outlook classic. Create a NEW email draft with subject "jinav test" and body "This is a test draft from jinav. Please ignore." Leave To, Cc and Bcc completely blank. Do not send, delete, discard or modify existing messages or other drafts. Prefer semantic set-value actions. After opening a new compose window, if it is outside the current target scope, request input to select that window. Complete only when both the subject and body are verified in the new compose window.',
    }),
  );
  if (!started.ok) throw Error(started.error);
  let lastPhase = "";
  const deadline = Date.now() + 190000;
  let launchApproved = false;
  while (Date.now() < deadline) {
    const r = await settings.evaluate(() => window.jinav.taskState());
    if (!r.ok) throw Error(r.error);
    const state = r.value;
    if (state.step > 0) evidence.modelUsed = true;
    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      console.log(`Task phase: ${state.phase}, step: ${state.step}`);
    }
    if (state.phase === "waiting_for_approval") {
      const approval = JSON.parse(state.approval || "{}");
      let safe = false;
      if (approval.action === "Open application") {
        safe = approval.application === configured.appName && !launchApproved;
        if (safe) {
          launchApproved = true;
          evidence.launchApproved = true;
        }
      } else if (["set-value", "type"].includes(approval.kind)) {
        safe = [
          "jinav test",
          "This is a test draft from jinav. Please ignore.",
        ].includes(approval.text);
      } else if (approval.kind === "click") {
        const match = state.message.match(/^Confirm click ?([^?]+)?/);
        const label = match?.[1] || "";
        safe = /^(New (?:Email|E-mail|Message)|Subject:?|Message|Body)$/i.test(
          label,
        );
        console.log(`Proposed control: ${safe ? label : "unapproved control"}`);
      }
      if (!safe)
        throw Error(
          "The proposed action needs manual review; no further actions approved.",
        );
      console.log(
        `Approving draft-only action: ${approval.kind || "launch-app"}`,
      );
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
      expect(windows.value.some((w) => /outlook/i.test(w.app))).toBe(true);
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
        "real Outlook-only model run completed",
        "only exact draft text and recognized compose controls approved",
        "no recipient supplied and no Send action approved",
      );
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (evidence.result !== "passed")
    throw Error("Draft-only test deadline exceeded.");
} catch (error) {
  evidence.error = String(error.message).split(/\r?\n/)[0];
  throw error;
} finally {
  if (settings)
    await settings.evaluate(() => window.jinav.stopTask()).catch(() => {});
  if (desktop) await desktop.close();
  await mkdir("evidence", { recursive: true });
  await writeFile(
    "evidence/model-outlook-draft.json",
    JSON.stringify(evidence, null, 2),
  );
  await rm(directory, { recursive: true, force: true });
}
console.log(JSON.stringify(evidence));
