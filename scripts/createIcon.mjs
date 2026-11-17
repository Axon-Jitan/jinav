// Renders the canonical user-supplied SVG into native icon formats using pinned Electron.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const require = createRequire(import.meta.url);
const profile = await mkdtemp(join(tmpdir(), "jinav-logo-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
try {
  await promisify(execFile)(
    require("electron"),
    [resolve("scripts/renderLogo.cjs"), `--user-data-dir=${profile}`],
    { env, windowsHide: true, timeout: 30000, maxBuffer: 16384 },
  );
} finally {
  if (!resolve(profile).startsWith(join(tmpdir(), "jinav-logo-")))
    throw Error("Unexpected logo rendering profile");
  await rm(profile, { recursive: true, force: true });
}
