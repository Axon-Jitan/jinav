// Prepares a pinned, project-local Windows MSI compiler without a global installation.
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const hash = "6ac824e1642d6f7277d0ed7ea09411a508f6116ba6fae0aa5f2c7daa2ff43d31";
export async function prepareWix(root) {
  if (process.platform !== "win32") throw Error("Build MSI on Windows");
  const directory = resolve(root, "out/tools/wix-3.14.1"),
    archive = resolve(root, "out/tools/wix-3.14.1.zip");
  await mkdir(resolve(root, "out/tools"), { recursive: true });
  let bytes;
  try {
    bytes = await readFile(archive);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const response = await fetch(
      "https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip",
    );
    if (!response.ok)
      throw Error(`WiX download failed (HTTP ${response.status})`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (createHash("sha256").update(bytes).digest("hex") !== hash)
    throw Error("WiX compiler checksum mismatch");
  await writeFile(archive, bytes);
  try {
    await access(join(directory, "candle.exe"));
    await access(join(directory, "light.exe"));
  } catch {
    const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
    await promisify(execFile)("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(directory)} -Force`,
    ]);
  }
  return directory;
}
