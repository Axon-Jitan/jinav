// Checks tracked text for common credential patterns without printing matching secrets.
import { spawnSync } from "node:child_process";
const result = spawnSync(
  "git",
  [
    "grep",
    "-q",
    "-I",
    "-E",
    "-e",
    "sk-ant-api[0-9]+-[A-Za-z0-9_-]{25,}",
    "-e",
    "sk-proj-[A-Za-z0-9_-]{30,}",
    "-e",
    "-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "--",
    ".",
  ],
  { stdio: "ignore", shell: false },
);
if (result.status === 0)
  throw Error(
    "Potential credential found in tracked files. Remove it before committing.",
  );
if (result.status !== 1)
  throw Error("Secret scan requires a Git checkout with tracked source files.");
process.stdout.write("Tracked-file credential pattern scan passed.\n");
