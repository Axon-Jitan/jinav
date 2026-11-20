// Packages the compiled application with native driver resources outside ASAR.
const { resolve, join, sep } = require("node:path");
const { configurePerUserMsi } = require("./scripts/configurePerUserMsi.cjs");
const teamDirectory = process.env.JINAV_TEAM_TEST_DIR
  ? resolve(process.env.JINAV_TEAM_TEST_DIR)
  : undefined;
if (
  teamDirectory &&
  !teamDirectory.startsWith(resolve(__dirname, "out/private-team") + sep)
)
  throw Error("Team-test resources must stay inside out/private-team");
const modelPath = teamDirectory
  ? join(teamDirectory, "managed-model.json")
  : "managed-model.json";
module.exports = {
  ...(teamDirectory
    ? { outDir: resolve(__dirname, "out/private-team/package") }
    : {}),
  hooks: {
    prePackage: async (_config, platform, arch) => {
      if (require("node:fs").existsSync(modelPath)) {
        const { z } = require("zod");
        try {
          z.object({
            version: z.literal(1),
            provider: z.enum(["anthropic", "openai"]).default("anthropic"),
            model: z.string().min(1).max(150),
            endpoint: z.string().url(),
            credentialSource: z.enum(["os", "bundled-test"]).default("os"),
          })
            .strict()
            .parse(
              JSON.parse(require("node:fs").readFileSync(modelPath, "utf8")),
            );
        } catch {
          throw Error(
            "Invalid managed-model.json. Supply only version, model and endpoint; never package API keys.",
          );
          const model = JSON.parse(
            require("node:fs").readFileSync(modelPath, "utf8"),
          );
          if (model.credentialSource === "bundled-test" && !teamDirectory)
            throw Error(
              "Bundled credentials require the explicit private team-test build",
            );
        }
      }
      const { execFile } = require("node:child_process");
      const { promisify } = require("node:util");
      await promisify(execFile)(
        process.execPath,
        ["scripts/prepareDriver.mjs"],
        {
          env: {
            ...process.env,
            JINAV_TARGET_PLATFORM: platform,
            JINAV_TARGET_ARCH: arch,
          },
        },
      );
    },
  },
  packagerConfig: {
    icon: "resources/icon",
    asar: true,
    executableName: "jinav",
    extraResource: [
      "resources/driver",
      "resources/licenses",
      "resources/icon.png",
      "resources/icon.ico",
      "THIRD_PARTY_NOTICES.md",
      ...(require("node:fs").existsSync(modelPath) ? [modelPath] : []),
      ...(teamDirectory
        ? [join(teamDirectory, "team-test-credential.bin")]
        : []),
    ],
    ignore: [
      /^\/src/,
      /^\/evidence/,
      /^\/scripts/,
      /^\/node_modules/,
      /^\/resources/,
      /^\/out/,
      /^\/\.git/,
    ],
  },
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["win32", "darwin", "linux"],
    },
    ...(process.env.JINAV_BUILD_MSI === "1"
      ? [
          {
            name: "@electron-forge/maker-wix",
            platforms: ["win32"],
            config: {
              manufacturer: "jinav",
              name: "jinav",
              exe: "jinav.exe",
              description: "jinav desktop launcher - private team test",
              appUserModelId: "com.jinav.desktop",
              upgradeCode: "6cfb3ff2-1713-46ad-b501-e3df7fbcabf8",
              defaultInstallMode: "perUser",
              features: false,
              ui: { chooseDirectory: true },
              autoRun: false,
              shortcutFolderName: "jinav team test",
              shortcutName: "jinav (team test)",
              programFilesFolderName: "jinav",
              icon: resolve(__dirname, "resources/icon.ico"),
              beforeCreate: (creator) => {
                configurePerUserMsi(creator);
                creator.wixTemplate = creator.wixTemplate.replace(
                  "{{ApplicationName}} (Machine - MSI)",
                  "{{ApplicationName}} (team test)",
                );
                creator.wixTemplate = creator.wixTemplate.replaceAll(
                  'Target="[APPLICATIONROOTDIRECTORY]{{ApplicationBinary}}.exe"',
                  'Target="[APPLICATIONROOTDIRECTORY]{{ApplicationBinary}}.exe" Arguments="--settings"',
                );
              },
            },
          },
        ]
      : []),
  ],
};
