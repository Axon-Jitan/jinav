// Packages the compiled application with native driver resources outside ASAR.
module.exports = {
  hooks: {
    prePackage: async (_config, platform, arch) => {
      if (require("node:fs").existsSync("managed-model.json")) {
        const { z } = require("zod");
        try {
          z.object({
            version: z.literal(1),
            provider: z.enum(["anthropic", "openai"]).default("anthropic"),
            model: z.string().min(1).max(150),
            endpoint: z.string().url(),
          })
            .strict()
            .parse(
              JSON.parse(
                require("node:fs").readFileSync("managed-model.json", "utf8"),
              ),
            );
        } catch {
          throw Error(
            "Invalid managed-model.json. Supply only version, model and endpoint; never package API keys.",
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
      ...(require("node:fs").existsSync("managed-model.json")
        ? ["managed-model.json"]
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
  ],
};
