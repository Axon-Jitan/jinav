# Third-party notices

Manrope is bundled locally through @fontsource/manrope 5.2.8 to match the approved design, with no runtime font requests. Copyright 2019 The Manrope Project Authors; SIL Open Font License 1.1 is retained in `resources/licenses/Manrope-OFL.txt`. The Settings gear is an exported vector from the user-supplied Figma file (component 50:1290); it is used as an asset rather than a screenshot of the UI.

jinav includes unmodified agent-desktop 1.3.1 native executables from Vercel Labs, licensed under Apache-2.0. Source: https://github.com/vercel-labs/agent-desktop/tree/v1.3.1. Its licence is retained in `resources/licenses/agent-desktop-LICENSE`. Native executable SHA-256 checks are performed during preparation; npm tarball integrity is recorded in package-lock.json. Protocol version 2.6 is distinct from package version 1.3.1.

Bundled JavaScript includes React 19.3.1, React DOM 19.3.1 and scheduler (MIT), plus Zod 4.6.7 (MIT). Their copyright notices and complete licences are retained in resources/licenses. Electron 45.3.3 is MIT licensed; Electron's Chromium and other third-party notices ship in the packaged runtime's LICENSE and LICENSES.chromium.html. Build/test tooling is development-only and remains identified by the lockfile.

No licence for jinav's own source has been selected by its owner. `private: true` and `UNLICENSED` in package metadata prevent accidental npm publication; they do not select an open-source licence.

Windows MSI generation uses Electron Forge maker-wix 8.0.1 and electron-wix-msi (pinned by package-lock.json). Its generated launcher stub is MIT licensed, copyright (c) 2017 Felix Rieseberg; the complete notice is retained in `resources/licenses/electron-wix-msi-MIT.txt`. The pinned WiX 3.14.1 compiler is a local build tool and is not bundled in the application.
