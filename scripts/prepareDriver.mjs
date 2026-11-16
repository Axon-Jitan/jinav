// Copies integrity-checked pinned native resources for the selected packaging target.
import {
  readFile,
  mkdir,
  copyFile,
  chmod,
  readdir,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
const target = process.env.JINAV_TARGET_PLATFORM || process.platform;
const arch = process.env.JINAV_TARGET_ARCH || process.arch;
if (
  !["win32", "darwin", "linux"].includes(target) ||
  !["x64", "arm64"].includes(arch)
)
  throw Error("Unsupported packaging target");
const source = "node_modules/agent-desktop/bin";
const files = [];
await mkdir("resources/driver", { recursive: true });
for (const name of (await readdir(source)).filter(
  (n) => n.includes(`${target}-${arch}`) && !n.endsWith(".sha256"),
)) {
  const bytes = await readFile(`${source}/${name}`);
  const expected = (await readFile(`${source}/${name}.sha256`, "utf8"))
    .trim()
    .split(/\s/)[0];
  if (createHash("sha256").update(bytes).digest("hex") !== expected)
    throw Error(`Integrity failure: ${name}`);
  await copyFile(`${source}/${name}`, `resources/driver/${name}`);
  await chmod(`resources/driver/${name}`, 0o755);
  files.push({ name, sha256: expected });
  const helper = name.includes("macos-helper")
    ? "agent-desktop-macos-helper"
    : name.includes("linux-clipboard-owner")
      ? "agent-desktop-linux-clipboard-owner"
      : undefined;
  if (helper) {
    await copyFile(`${source}/${name}`, `resources/driver/${helper}`);
    await chmod(`resources/driver/${helper}`, 0o755);
    files.push({ name: helper, sha256: expected });
  }
}
if (
  !files.some(
    (file) =>
      file.name ===
      `agent-desktop-${target}-${arch}${target === "win32" ? ".exe" : ""}`,
  )
)
  throw Error("Selected native executable is missing.");
await writeFile(
  "resources/driver/manifest.json",
  JSON.stringify(
    {
      package: "agent-desktop",
      version: "1.3.1",
      protocol: "2.6",
      platform: target,
      arch,
      files,
    },
    null,
    2,
  ),
);
