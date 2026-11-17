# jinav

A compact desktop launcher with optional, scoped computer use. The Electron / React / TypeScript application follows the approved [Figma wheel and Settings frames](https://www.figma.com/design/LWGhVrGwED8SNHOjFJsgM0?node-id=21-290). This is a Windows development preview; a real model-driven editor/save task remains unverified without provider credentials.

## Run

Use Node 24+ and npm, in the signed-in graphical session:

```powershell
npm ci
npm start -- --settings
```

`npm start` respects Start quietly. Use the tray, the configured shortcut, or `--settings` to open the interface. Starting another instance opens Settings in the existing process. No administrator privileges, account, provider or internet connection are required for the installed launcher. Initial dependency installation requires internet.

New profiles use **Ctrl+Alt+Space**. Existing profiles retain their shortcut, including the earlier Alt+Shift+Space default. The one-time ready notification shows the actual configured shortcut. Conflicts retain the previous working registration and expose Settings through the tray.

**General → Open menu → Change** supports key recording or **Type instead** (for example, `Ctrl+Alt+J`). The current shortcut is shown as an actual value, not an empty placeholder. While the dialog is focused, invoking that registered shortcut records it instead of opening the wheel. The previous registration stays active until a replacement succeeds; conflicts appear inside the dialog. Cancel preserves the saved combination.

Choose any number of real applications in **Settings → Menu → Add app**. Search or use Select shown for bulk selection; neither launcher nor Ask jinav selection has an app-count cap. Extra launcher apps appear on additional compact wheel pages. Click the centre page button, scroll, or use Page Up / Page Down to browse; app order stays fixed. Manual app order is preserved when changing between Selected apps, Recently opened, Frequently used and Currently open. Recent/Frequent use local launch metadata; frequency uses a rolling 30 days. Currently open never fills gaps with closed apps. Clear app-use history is separate from task history.

The wheel has adjustable spacing in **Appearance → Distance from cursor**: 58–110 DIPs from the cursor to icon centres, preserving the existing 60-DIP default. Its diameter is 160–264 DIPs (164 by default), with 24-pixel app icons by default and 44-pixel circular targets. Ask jinav stays at the top and the Settings gear at 4:30. The closest limit preserves separate targets and a neutral centre. No fake cursor or sample app shortcuts are shipped. Apps and spacing freeze for each opening. Arrow keys and Tab navigate; Enter activates; Escape dismisses. Clicking outside dismisses without replaying clicks. Try menu returns to Settings on Escape. Activation prefers the native MRU window; a refused focus request is reported without opening a duplicate.

Appearance offers 20/24/32-pixel icons, no/soft/solid circle background, hover/focus or hidden names, automatic/above/below captions, and light/dark/system themes. Labels stay within the screen, falling back from the preferred side when necessary. System theme follows changes live. Animation supports system preference or reduced motion. General offers **Press to toggle** (default) or **Press to open**; open-only leaves an already-visible menu open. These preferences save automatically. Security confirmations remain mandatory and are displayed as policy text. Focus, picker selections and range accents use jinav's neutral palette; OS high-contrast colors are respected.

Run `node scripts/settingsSmoke.mjs` after building, or add `--packaged` after packaging, to verify these controls and persistence in an isolated profile. The test never enables AI or changes the signed-in user's startup registration; launch-on-login still needs an actual sign-out/sign-in acceptance check.

## Optional Ask jinav

IT supplies the model connection and protected credential; coworkers do not enter API keys or choose a provider. See [IT-managed provisioning](docs/managed-model.md) for the installer configuration contract. The repository contains no credentials. `npm run make:team-msi` produces an explicitly private Windows x64 test MSI using the build owner's existing Windows-protected temporary key. This extractable-key testing mode is described in that guide; ordinary builds remain key-free.

1. In **Settings → Ask jinav**, enable the feature and review the provider disclosure.
2. Under **Allowed apps**, choose **Selected apps** and pick a list, or explicitly approve **All installed apps** to let jinav choose from supported installed apps for each submitted task. Switching back preserves the selected list. This permission is independent of wheel selections; observation still covers one task app at a time. Desktop permissions are checked before execution; a recovery check is available in Settings.
3. Click Ask jinav, describe the task and review the captured context. Run requires a provisioned model, consent and suitable permissions. Authentication and connectivity failures are reported honestly.
4. For the checklist acceptance task, use a disposable editor document and choose an exact output path under Output verification file. The agent must enter and save through the GUI; jinav only reads the file afterward.

Settings also provides working minimize, maximize/restore and Close controls. Closing Settings keeps the launcher running.

Windows development launches use the generated `out/dev-runtime/jinav.exe`, with the supplied logo embedded and the same `com.jinav.desktop` application identity as the packaged app. Windows windows and tray load the native multi-size ICO, whose small frames use Windows DIB encoding. This avoids inheriting the earlier Electron taskbar group without changing `node_modules`. Run `npx electron scripts/repairWindowsShortcut.cjs` after packaging this workspace to update its own Start-menu shortcut to the same identity. macOS explicitly sets its dock image; Linux sets its desktop name and window icon, with native validation still pending on those OSes. An old manually pinned Electron shortcut is a separate OS shortcut; replace it with the new jinav executable if that stale pin remains visible. No unrelated taskbar pins or Explorer settings are changed.

The existing **agent-desktop 1.3.1** native CLI is the only computer-use backend (JSON protocol **2.6** is a different version). Binaries/helpers are pinned, integrity checked and bundled outside ASAR. No globally installed CLI or launch-time download is needed. The model receives opaque allowed-app IDs, never shell commands or executable arguments. App opening requires a specific approval. This conservative preview also confirms every click/Enter and potentially sensitive text/action. External-action and deletion confirmations remain mandatory, with that restriction explained in Settings.

Progress provides Pause/Resume and Stop; Escape stops an active task. Resume discards pending proposals and obtains fresh state. A permission change requires a new task. Stop aborts pending requests/processes, rejects late responses and waits for acknowledgement; it does not undo an action already dispatched. Paused time counts toward the task deadline. Tasks never resume after restart.

## Commands

| Command | Purpose |
| --- | --- |
| `npm start -- --settings` | Build and run with Settings visible |
| `npm run check` | Strict types, zero-warning lint, deterministic tests, production build |
| `npm run test:desktop` | Real Windows Electron UI with an isolated temporary profile |
| `npm run make` | Build the host application and unsigned ZIP |
| `npm run test:package` | Run the desktop checks against the packaged executable |
| `npm run icons` | Regenerate native PNG/ICO/ICNS assets from the supplied `resources/jinav-logo.svg` using pinned Electron; requires the development host's graphical environment |
| `node scripts/brandingSmoke.mjs` | Check packaged Windows icon embedding and real Settings, wheel and prompt branding in an isolated profile |
| `node scripts/appAccessSmoke.mjs --packaged` | Verify selected/all-app access, explicit approval, cancellation, preserved selections and restart persistence without enabling AI |
| `node scripts/unlimitedAppsSmoke.mjs --packaged` | Save a real installed-app catalogue beyond six/100 entries, browse wheel pages and verify preview labels |
| `node scripts/focusSmoke.mjs` | Click the real Notepad wheel icon twice and verify foreground activation without duplicate windows; uses an isolated Windows profile |
| `node scripts/focusSmoke.mjs --packaged` | Run the same focused activation regression against the packaged executable |
| `node scripts/labelsSmoke.mjs --packaged` | Verify every real hover label stays outside the wheel with visible text, using the longest discovered app names in an isolated profile |
| `node scripts/radiusSmoke.mjs --packaged` | Check spacing controls, native menu size, exterior labels, frozen geometry and restart persistence in an isolated profile |
| `npm audit --omit=dev` | Audit runtime dependencies |

Windows executable: `out/jinav-win32-x64/jinav.exe`. ZIP: `out/make/zip/win32/x64/jinav-win32-x64-0.0.1.zip`. Keep the complete extracted application directory together. This unsigned package is not a production release; signing and IT acceptance remain outstanding. Do not disable OS protections.

## Platform status

| Environment | Actual validation |
| --- | --- |
| Windows 11 build 26200, x64, Electron 45.3.3 | Tested launcher/Settings, native app discovery, Notepad activation, persistence, native shortcut conflict, keyboard navigation, transparency and host packaging. Live AI task, physical held-hotkey/edge tests and screen-reader validation remain incomplete. |
| macOS | Untested. Bundle discovery/native launch exist; window inventory/focus and native input events need implementation/validation. |
| Linux X11 | Untested. Desktop-entry discovery / `gio launch` exist; native inventory/focus, accessibility bus and window manager need validation. |
| Linux native Wayland | Experimental, untested compositor placement fallback. Cursor-positioning APIs are not used; shortcut, placement and input capabilities need compositor-specific work. |

Office and SAP workflows are untested. Windows secure desktops, locked sessions, UAC and elevated-app automation are unsupported. IT policies that block PowerShell/native helpers can limit discovery, focus and interruption monitoring; jinav does not bypass them. External launch detection covers resolvable visible primary processes while jinav runs, not historical activity while it was closed; in-process launches and some hosted apps cannot be counted reliably.

## Settings and deployment

Preferences live per user under Electron userData (`%APPDATA%\jinav` on this host). Version 1 migrates to version 2 while retaining app order, shortcut and motion preferences. Writes are atomic and serialized, with a last-valid backup; malformed originals are retained. API keys never enter ordinary JSON. App-use ranking, task outcome history and credentials have separate stores. Task history is off by default; opt-in history stores only outcome/time/step metadata. No telemetry is collected.

IT may place an optional `deployment-defaults.json` in the packaged `resources` directory (project root during development):

```json
{ "shortcut": "Ctrl+Alt+Space", "appIds": [] }
```

`appIds` accepts exact installed catalogue identifiers without the former six-app count cap. Missing IDs are reported instead of creating pretend shortcuts. This file seeds new profiles only; updates never enforce it over personal choices. See [the implementation contract](docs/launcher-contract.md).

See [architecture](docs/architecture.md), [privacy and troubleshooting](docs/privacy.md), [verification evidence](docs/verification.md), and [screenshots](evidence/screenshots). Manrope and upstream notices are retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No licence for jinav’s own source has been selected.
