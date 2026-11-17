// Creates a branded Windows development runtime without changing installed Electron files.
import electron from "electron";
import {
  cp,
  mkdir,
  readFile,
  writeFile,
  rename,
  access,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export async function prepareRuntime() {
  if (process.platform !== "win32") return electron;
  const root = resolve(projectRoot, "out/dev-runtime"),
    exe = join(root, "jinav.exe"),
    icon = resolve(projectRoot, "resources/icon.ico"),
    stamp = join(root, "brand.sha256");
  const hash = createHash("sha256")
    .update(await readFile(electron))
    .update(await readFile(icon))
    .digest("hex");
  try {
    if ((await readFile(stamp, "utf8")) === hash) {
      await access(exe);
      return exe;
    }
  } catch {
    /* Missing or changed cache is rebuilt below. */
  }
  if (!root.startsWith(resolve(projectRoot, "out") + "\\"))
    throw Error("Unexpected development runtime directory");
  await mkdir(root, { recursive: true });
  await cp(dirname(electron), root, { recursive: true });
  try {
    await rename(join(root, "electron.exe"), exe);
  } catch (error) {
    throw Error(
      "Close the running jinav development app before updating its runtime.",
      { cause: error },
    );
  }
  const { resedit } = await import("@electron/packager/resedit");
  await resedit(exe, {
    iconPath: icon,
    productName: "jinav",
    win32Metadata: {
      ProductName: "jinav",
      FileDescription: "jinav",
      OriginalFilename: "jinav.exe",
    },
  });
  await writeFile(stamp, hash);
  return exe;
}
