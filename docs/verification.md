# Validation record — 16 November 2026

## Environment

Actual host: **Microsoft Windows 11 Business, 10.0.26200, x64**, normal signed-in desktop. The older `Get-ComputerInfo` product label reported Windows 10; the OS CIM record identifies Windows 11 build 26200. Node 25.0.0, npm 11.6.2, Electron 45.3.3, Vite 8.3.8. Two monitors at 125% scaling: usable areas 1536×816 and 2048×1104 DIPs, with the second display starting at x=1536. No live model credentials were found in the environment. No optional evidence archive was supplied.

## Deterministic checks

`npm run check` passes strict TypeScript, zero-warning ESLint with hooks/import-cycle checks, **65 tests in 13 files**, and the production build. Tests use fake model/driver/network interfaces and disposable test data. They are not evidence of autonomous computer use.

Coverage includes multi-monitor/negative-coordinate geometry at 100/150/200% virtual scale, malformed configuration recovery, shortcut replacement failures, window choosers/stale selections, schema/scope rejection, stale references, uncertain delivery without retry, late responses after cancellation, pending-start cancellation, native output-file authorization, approval cancellation, worker termination/late completion races, repeated no-progress actions, task step limits, Unicode process input/output and streaming provider response limits. The pinned driver's actual `ref_id` envelope shape is contract-tested.

The source CI workflow prepares Windows/macOS/Linux checks with Node 24 and a tracked-file credential-pattern scan. It has **not run remotely**; no repository was pushed. That simple pattern scan is not comprehensive secret detection. `npm audit` currently reports seven moderate development-tool advisories through TypeScript ESLint's minimatch dependency; runtime-only audit is checked separately. No forced dependency downgrade was applied to conceal them.

## Actual Electron checks

`npm run test:desktop` and `npm run test:package` exercise the native desktop application, not a browser mockup. Machine-readable evidence: [development](../evidence/desktop-smoke.json), [packaged](../evidence/packaged-smoke.json).

Verified paths include isolated/sandboxed renderer settings, real OS encryption of a synthetic test credential, native installed catalogue entries, AI-disabled application activation requests, existing-window selection/focus or actionable Windows foreground refusal, application reordering across a process restart, radial Ask UI, native shortcut registration, keyboard navigation, Escape dismissal, unconfigured-model errors, bundled native-driver status, and reopening through the single-instance entry route. Native tests leave application document contents untouched.

Focus was accepted on some runs and refused on others while the desktop was in use. The evidence explicitly records which outcome occurred. A passing smoke test accepts a correctly reported OS foreground restriction; it does **not** assert universal focus success. No duplicate window is deliberately opened after a refusal.

The latest warm main-process menu show measurements were approximately **64, 20 and 20 ms**; the startup menu opening took about 231 ms. These measure through `BrowserWindow.show()` and origin lookup, not end-to-end first rendered frame. The provisional under-100-ms target is therefore only a warm-path observation, not a general performance guarantee. Exact values are retained in development evidence.

## Driver foundation

The native **agent-desktop 1.3.1** executable reports **JSON protocol 2.6**. Its status reports Windows accessibility granted, automation not required, screen recording not required. The embedded desktop/platform skills plus snapshot, set-value, type, click, press, list-windows and focus-window help were inspected before mapping commands. A direct accessibility snapshot confirmed the Windows `ref_id` representation; no document mutation was performed.

The test helper repeatedly refused Windows input with “user input was detected” after refreshed observations. Manual hotkey invocation at physical screen corners, outside desktop clicks, held-key repeat, physical DPI changes, screen-reader operation, display removal, and denied-permission UI journeys remain **unverified**. Their pure logic/failure paths have deterministic coverage where listed above. Existing personal editor content was not edited for a test.

## Packaging

`npm run make` produces an unsigned Windows x64 application and ZIP. The built executable passed the packaged smoke workflow, including native-driver status from its external resources directory. Native resources and licence copies live outside ASAR; executable hashes are checked during preparation. The package includes Electron/Chromium notices and retained dependency licences. No release was published, signed or uploaded.

The Forge hook prepares the selected target's driver/helper during packaging. macOS/Linux packaging is configured but not built or verified on this host. Permissions, focus, native dependencies, signing/notarization and Wayland compositor behavior must be checked on those systems separately. Office and SAP task workflows are untested.

## Outstanding acceptance work

**The end-to-end AI acceptance criterion is not met.** A real model-driven task must enter and save a meeting checklist through a real editor GUI, then independently verify the resulting file. No key was available, so no fake workflow or directly written expected file is presented as that result. The interface currently supports a selected existing window rather than model-driven application launching or cross-window expansion. Common save-dialog behavior still needs live validation.

Next concrete task: configure an authorized provider/model, use an isolated disposable editor document, run the selected-file checklist journey, and check Stop during real planning/action/approval/verification. Resolve any actual dialog-scope, accessibility or newline/readback failures before advertising that workflow as supported. Then validate native hotkey/edge/blur/tray behavior on an idle desktop, improve capability-specific approvals, and complete the other OS adapters.

One diagnostic snapshot created by direct CLI inspection remains in agent-desktop's user cache: automatic approval review blocked its deletion, reporting only “blocked by policy.” No attempt was made to bypass that rejection. It is not included in the repository or package. Application task caches are separately isolated beneath jinav's userData directory.
