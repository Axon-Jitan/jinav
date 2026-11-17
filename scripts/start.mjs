// Starts Electron with an app runtime environment rather than inherited Node-only mode.
import { spawn } from "node:child_process";
import { prepareRuntime } from "./prepareRuntime.mjs";
import { fileURLToPath } from "node:url";
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(
  await prepareRuntime(),
  [projectRoot, ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: environment,
  },
);
child.on("exit", (code) => (process.exitCode = code ?? 1));
