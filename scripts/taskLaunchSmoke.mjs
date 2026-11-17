// Verifies the task application's native launch path without a model or document edits.
import { build } from "esbuild";
import { _electron as electron } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
const directory = await mkdtemp(join(tmpdir(), "jinav-app-launch-"));
await mkdir("evidence/private", { recursive: true });
const modulePath = resolve("evidence/private/nativeTaskApplications.cjs");
await build({
  stdin: {
    contents:
      "export {TaskApplications} from './src/main/taskApplications'; export {adapterFactory} from './src/platform/adapterFactory'; export {AgentDesktopDriver} from './src/desktop/agentDesktopDriver';",
    resolveDir: resolve("."),
  },
  outfile: modulePath,
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
let desktop;
const evidence = {
  date: "2026-11-17",
  kind: "native-task-app-launch",
  modelUsed: false,
};
try {
  desktop = await electron.launch({
    args: [resolve("."), `--user-data-dir=${directory}`],
    env: environment,
  });
  await desktop.firstWindow();
  const result = await desktop.evaluate(async (_electron, modulePath) => {
    const { TaskApplications, adapterFactory, AgentDesktopDriver } = process
      .getBuiltinModule("module")
      .createRequire(modulePath)(modulePath);
    const platform = adapterFactory();
    try {
      const driver = new AgentDesktopDriver(
        process
          .getBuiltinModule("path")
          .resolve("resources/driver/agent-desktop-win32-x64.exe"),
        "jinav-app-launch-check",
      );
      const applications = await TaskApplications.discover(
        platform,
        AbortSignal.timeout(40000),
        driver,
      );
      const calculator = applications.apps.find((app) =>
        /^calculator$/i.test(app.name),
      );
      if (!calculator)
        throw Error(
          "Installed Calculator was not found in the supported app catalogue.",
        );
      const initial = await driver.listWindows(
        "CalculatorApp.exe",
        AbortSignal.timeout(15000),
      );
      if (initial.length > 1) {
        let launches = 0;
        const launch = platform.launch.bind(platform);
        platform.launch = async (...args) => {
          launches++;
          return launch(...args);
        };
        try {
          await applications.open(calculator.id, AbortSignal.timeout(20000));
          throw Error("Ambiguous app windows were accepted unexpectedly.");
        } catch (error) {
          if (!error.message.includes("several windows")) throw error;
        }
        if (launches !== 0)
          throw Error(
            "An ambiguous app request launched an unwanted duplicate.",
          );
        return {
          application: calculator.name,
          process: "CalculatorApp.exe",
          ambiguousWindows: initial.length,
          duplicateLaunches: launches,
          outcome: "ambiguous-existing-windows-refused",
        };
      }
      const target = await applications.open(
        calculator.id,
        AbortSignal.timeout(20000),
      );
      const windows = await driver.listWindows(
        target.app,
        AbortSignal.timeout(15000),
      );
      const verified = windows.some(
        (window) => window.id === target.id && window.app === target.app,
      );
      if (!verified)
        throw Error(
          "Fresh native inventory did not confirm the opened window.",
        );
      return {
        application: calculator.name,
        process: target.app,
        windowVerified: true,
      };
    } finally {
      platform.dispose?.();
    }
  }, modulePath);
  Object.assign(evidence, result, { result: "passed" });
} catch (error) {
  Object.assign(evidence, { result: "failed", error: error.message });
  process.exitCode = 1;
} finally {
  if (desktop) await desktop.close();
  await rm(directory, { recursive: true, force: true });
  await writeFile(
    "evidence/task-app-launch-smoke.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  process.stdout.write(JSON.stringify(evidence, null, 2) + "\n");
}
