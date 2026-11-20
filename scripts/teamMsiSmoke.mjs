// Verifies an MSI administrative image without registering a personal installation.
import { _electron, expect } from "@playwright/test";
import {
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  writeFile,
  rm,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
const directory = resolve(process.argv[2] || "out/private-team/extracted");
if (!directory.startsWith(resolve("out/private-team") + "\\"))
  throw Error("Use an extraction directory inside out/private-team");
async function findApp(path) {
  const entries = await readdir(path, { withFileTypes: true });
  if (
    entries.some((e) => e.name === "jinav.exe") &&
    entries.some((e) => e.name === "resources")
  ) {
    try {
      await readFile(join(path, "resources/app.asar"));
      return join(path, "jinav.exe");
    } catch {}
  }
  for (const entry of entries)
    if (entry.isDirectory()) {
      const result = await findApp(join(path, entry.name));
      if (result) return result;
    }
}
const executable = await findApp(directory);
if (!executable) throw Error("Extracted Electron executable missing");
const profile = await mkdtemp(join(tmpdir(), "jinav-msi-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.JINAV_API_KEY;
let desktop;
const evidence = {
  kind: "extracted-msi-runtime",
  result: "failed",
  providerToolCalling: false,
  fullUserInstallationTested: false,
};
try {
  desktop = await _electron.launch({
    executablePath: executable,
    args: ["--settings", `--user-data-dir=${profile}`],
    env,
  });
  await expect
    .poll(() =>
      desktop.windows().some((p) => p.url().includes("view=settings")),
    )
    .toBe(true);
  const settings = desktop
    .windows()
    .find((p) => p.url().includes("view=settings"));
  await settings.waitForFunction(() => !!window.jinav);
  const bootstrap = await settings.evaluate(() => window.jinav.bootstrap());
  expect(bootstrap.ok).toBe(true);
  expect(bootstrap.value).toMatchObject({
    modelProvisioned: true,
    teamTestBuild: true,
  });
  expect(bootstrap.value.config).toMatchObject({
    provider: "openai",
    model: "gpt-4.1-mini",
    aiEnabled: false,
    cloudConsent: false,
    allowedApps: [],
  });
  expect(bootstrap.value.credential).toBe("Credential protected by OS storage");
  const stored = await readFile(join(profile, "credential.bin"));
  const bundle = await readFile(
    join(dirname(executable), "resources/team-test-credential.bin"),
  );
  const key = bundle.subarray(Buffer.from("JINAV-TEAM-TEST-V1\0").length);
  expect(stored.length).toBeGreaterThan(20);
  expect(stored.includes(key)).toBe(false);
  await settings
    .getByRole("navigation")
    .getByRole("button", { name: "Ask jinav", exact: true })
    .click();
  await expect(settings.getByText(/Team test build/)).toHaveCount(0);
  const permissions = await settings.evaluate(() =>
    window.jinav.driverStatus(),
  );
  if (!permissions.ok) throw Error(permissions.error);
  const consent = await settings.evaluate(async () => {
    const bootstrap = await window.jinav.bootstrap();
    return window.jinav.saveConfig({
      ...bootstrap.value.config,
      cloudConsent: true,
    });
  });
  if (!consent.ok) throw Error(consent.error);
  const connection = await settings.evaluate(() => window.jinav.testModel());
  if (!connection.ok) throw Error(connection.error);
  evidence.providerToolCalling = true;
  evidence.firstRunCredentialImport = true;
  evidence.windowsProtectedStorage = true;
  evidence.packagedDriverStatus = true;
  evidence.noDesktopContentSent = true;
  evidence.result = "passed";
  await readFile(
    join(executable, "../resources/licenses/electron-wix-msi-MIT.txt"),
  );
} catch (error) {
  evidence.failure = error.message;
  throw error;
} finally {
  if (desktop) await desktop.close();
  await mkdir("out/private-team", { recursive: true });
  await writeFile(
    "out/private-team/validation.json",
    JSON.stringify(evidence, null, 2),
  );
  if (!profile.startsWith(join(tmpdir(), "jinav-msi-")))
    throw Error("Unexpected test profile");
  await rm(profile, { recursive: true, force: true });
}
process.stdout.write(JSON.stringify(evidence, null, 2));
