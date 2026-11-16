// Packages the compiled application with native driver resources outside ASAR.
module.exports = {
  hooks: {
    prePackage: async (_config, platform, arch) => {
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
    asar: true,
    executableName: "jinav",
    extraResource: [
      "resources/driver",
      "resources/licenses",
      "resources/icon.png",
      "THIRD_PARTY_NOTICES.md",
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
