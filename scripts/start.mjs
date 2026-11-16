// Starts Electron with an app runtime environment rather than inherited Node-only mode.
import { spawn } from "node:child_process";
import electron from "electron";
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ["."], { stdio: "inherit", env: environment });
child.on("exit", (code) => (process.exitCode = code ?? 1));
