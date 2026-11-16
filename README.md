# jinav

A real Electron desktop launcher with an optional, scoped computer-use task engine.

**Development preview.** The Windows launcher runs on Windows 11 x64 with two displays at 125% scaling. The Anthropic provider and agent-desktop loop are implemented, but a live model-driven editor/save journey has **not** passed: no provider credential was available. This is not a production release. See [verification](docs/verification.md) for tested behavior and remaining work.

## Run

Use Node 22.12+ and npm. The development host used Node 25.0.0 and npm 11.6.2.

```sh
npm ci
npm start
```

Electron 45 downloads its pinned runtime on first use; initial install/start needs network access. Subsequent launcher use is offline. The exact `agent-desktop` 1.3.1 dependency supplies native binaries, copied with SHA-256 checks at build time. No global CLI or executable download at application launch is required.

First launch opens Settings. Find installed applications, search the catalogue, choose up to six, reorder them and save. Manual selection is available. There are no pretend application shortcuts. **Alt+Shift+Space** opens the radial menu; release the keys and it stays open. Escape or loss of focus dismisses the inactive menu. The tray provides Open, Settings, Stop and Quit. Change conflicting shortcuts in settings.

The launcher works with AI disabled and without credentials. Opening it never captures accessibility trees, takes screenshots, contacts a provider or starts agent actions. Native foreground-window metadata may be read for application context. The menu never moves your pointer.

## Optional computer use

1. Open the intended application yourself. This preview authorizes one existing window per task; the model cannot launch another application or expand that scope.
2. Enable Ask jinav in Settings. Review the disclosure that observed application text is sent to the configured provider. Screenshots are not supported.
3. Configure an Anthropic Messages-compatible endpoint, a model ID available to your account, and a key. Store the key, save settings, then Test connection. The default model ID does not prove your account has access. Provider charges may apply.
4. Check desktop permissions. Deliberately enable physical keyboard input if needed; semantic actions remain the default. No coordinate fallback is exposed.
5. Open Ask jinav, select the exact window, and submit a goal. For a save task, choose an output file for independent verification. The agent must save through the GUI; jinav only reads the file afterward.

Pending acceptance example: “Write a short meeting checklist in this editor and save it to the selected meeting-checklist.txt file.” Use a disposable folder. A connection test proves a structured response, not reliable application automation.

This preview conservatively requires approval for **every click and Enter**, text input outside recognized editors, and actions flagged as sensitive. That is more restrictive than the intended finished UX. Authentication, terminals, password/security tools and jinav itself are excluded. Scope checks are application policy, **not an OS sandbox**. Inaccessible controls or another required window stop the task with a manual-step message; there is no automatic resume.

Stop cancels outstanding requests/CLI processes and suppresses late replies. The UI stays in Stopping until acknowledgement or the supervisor deadline. An OS action already dispatched may have happened. Stop is not undo.

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` / `npm run dev` | Build and run Electron |
| `npm run check` | Strict types, zero-warning lint, deterministic tests, build |
| `npm test` | Pure logic and fake provider/driver tests; no real network/model calls |
| `npm run test:desktop` | Actual Windows Electron checks with temporary settings |
| `npm run package` | Host application directory |
| `npm run make` | Host ZIP distributable |
| `npm run test:package` | Test the built host executable |
| `npm run format` | Format source/configuration |

Native smoke tests can launch/focus Notepad but do not modify its content. Run them with the signed-in desktop available. These tests are Windows-specific and separate from deterministic tests.

Windows executable: `out/jinav-win32-x64/jinav.exe`; ZIP: `out/make/zip/win32/x64/`. Keep the complete application directory together. The unsigned package is not a production release. Signing/notarization remains required for distribution; do not disable OS protections.

## Platform status

| Environment | Launcher | Computer use | Packaging |
| --- | --- | --- | --- |
| Windows 11 x64, build 26200 | **Partial, tested:** discovery, persistence, radial UI, shortcut registration, Escape, keyboard navigation, native focus/refusal handling | Driver status/accessibility checked; live model/save journey **blocked** | Unsigned host build; executable results in verification record |
| macOS | **Untested:** bundle discovery/native launch implemented; window inventory/focus incomplete | Driver/helper preparation available; consent/workflows untested | Prepared, not built/signed/notarized here |
| Linux X11 | **Untested:** desktop-entry discovery and `gio launch`; window inventory/focus incomplete | Session, accessibility bus, WM not verified | Prepared, not built here |
| Linux native Wayland | **Experimental, untested:** compositor-positioned fallback; no cursor positioning calls | Portal/input behavior unverified | Not built here |

Windows UWP activation delegates to the shell; exact multi-window matching is available for executable-backed entries, not every UWP app. Discovery may miss installations. macOS/Linux manual picking, login startup and focus need native validation. Office and SAP workflows are untested even if discoverable.

## Further reading

[Architecture](docs/architecture.md), [privacy/troubleshooting](docs/privacy.md), [verification](docs/verification.md), [engineering rules](RULES.md). The original product direction is retained in [product-concept.md](docs/product-concept.md); it describes intended behavior beyond this preview.

Settings are validated, versioned and atomically written. Malformed originals are retained for recovery. Keys use separate OS-backed async encryption, with an explicit session-only fallback if unavailable. Task history is a volatile summary. The driver uses a transient per-run snapshot cache, removed after the run or on next startup after a crash. No telemetry is collected.

Upstream licences are in `resources/licenses` and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). No licence for jinav's own source has been selected.
