// Builds an explicitly private testing MSI; never uploads its extractable test credential.
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import electron from "electron";
import { prepareWix } from "./prepareWix.mjs";
const root = fileURLToPath(new URL("../", import.meta.url)),
  privateRoot = resolve(root, "out/private-team"),
  staging = join(privateRoot, "provisioning");
process.chdir(root);
const run = promisify(execFile);
const wix = await prepareWix(root);
const fromPackage = process.argv.includes("--from-package");
await mkdir(staging, { recursive: true });
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
try {
  if (!fromPackage) {
    await run(
      electron,
      [join(root, "scripts/teamTestProvision.cjs"), staging],
      {
        env,
        timeout: 60000,
      },
    );
    await run(process.execPath, ["scripts/prepareDriver.mjs"], {
      cwd: root,
      env,
      maxBuffer: 1024 * 1024,
    });
    await run(process.execPath, ["scripts/build.mjs"], {
      cwd: root,
      env,
      maxBuffer: 1024 * 1024,
    });
  } else {
    const metadata = JSON.parse(
      await readFile(
        join(
          privateRoot,
          "package/jinav-win32-x64/resources/managed-model.json",
        ),
        "utf8",
      ),
    );
    if (metadata.credentialSource !== "bundled-test")
      throw Error("Expected an existing private team-test package");
    await readFile(
      join(
        privateRoot,
        "package/jinav-win32-x64/resources/team-test-credential.bin",
      ),
    );
  }
  process.env.JINAV_TEAM_TEST_DIR = staging;
  process.env.JINAV_BUILD_MSI = "1";
  process.env.PATH = wix + ";" + process.env.PATH;
  const { api } = await import("@electron-forge/core");
  const results = await api.make({
    dir: root,
    platform: "win32",
    arch: "x64",
    outDir: join(privateRoot, "package"),
    overrideTargets: ["@electron-forge/maker-wix"],
    fromPackage,
  });
  const source = results
    .flatMap((r) => r.artifacts)
    .find((path) => path.endsWith(".msi"));
  if (!source) throw Error("MSI output missing");
  const { version } = JSON.parse(await readFile("package.json", "utf8"));
  const target = join(privateRoot, `jinav-team-test-${version}-x64.msi`);
  await copyFile(source, target);
  await writeFile(
    target + ".sha256",
    createHash("sha256")
      .update(await readFile(target))
      .digest("hex") + "\n",
  );
  process.stdout.write(`Private test MSI built: ${target}\n`);
} finally {
  await rm(join(staging, "team-test-credential.bin"), { force: true });
  delete process.env.JINAV_TEAM_TEST_DIR;
  delete process.env.JINAV_BUILD_MSI;
}
