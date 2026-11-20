# Windows installer

The Windows x64 MSI installs for the signed-in user. Its default application folder is `%LOCALAPPDATA%\Programs\jinav`. The setup wizard shows that location and an optional **Change** button for another folder the user can write to. This package does not offer an all-users installation or request elevation. Selecting a protected system folder can still fail; keep the default for a standard installation.

Cancel the previous failed installer before opening the rebuilt `out/release/jinav-0.0.1.msi`. Existing 0.1.x test installations must be removed first because 0.0.1 is a lower version. The package remains unsigned and intended for private team testing. Use normal organizational software approval; do not disable Windows security controls.

After setup, open **jinav (team test)** from the Start menu. Its shortcut opens Settings. Setup does not run the application as SYSTEM or start an AI task. Closing Settings leaves the launcher in the tray; use the actual shortcut shown under General. New profiles currently use Ctrl+Alt+Space; existing profiles keep their combination. Launch on login is optional and off by default.

The install location is recorded in the current user's installer registration and restored for repair/uninstall. User-profile file components use HKCU registry key paths. Uninstall removes installed files and empty folders; it does not recursively purge a custom location or remove unrelated files. Personal settings and protected credentials are separate from the application directory.

## Build and checks

- `npm run test:installer`: deterministic checks against the pinned upstream templates, including scope, directory choice, repair/uninstall location, user component key paths, and file preservation. Also included in `npm run check`.
- `npm run make:team-msi`: rebuild source and the private MSI using the already authorized test credential. Do not publish this credential-bearing artifact.
- `npm run make:team-msi -- --from-package`: rebuild only installer authoring from the existing private package. Appropriate for this installer-only correction; it does not include new application code.
- `powershell.exe -NoProfile -File scripts/inspectUserMsi.ps1 -MsiPath out/release/jinav-0.0.1.msi`: inspect compiled MSI tables without installing. The builder runs this check before replacing the release artifact.
- `powershell.exe -NoProfile -File scripts/userMsiSmoke.ps1`: on a clean, non-elevated Windows test account, install to the default directory, repair a removed tracked file, uninstall, install to a custom folder containing spaces and Unicode, then uninstall while preserving a pre-existing sentinel file. Refuses an existing jinav installation or default directory. The check leaves no registered test installation when successful. Private MSI logs stay under `out/private-team/install-evidence/`; the minimal result is `evidence/windows-msi-install.json`.

The fix explicitly uses LocalAppData instead of relying on ProgramFiles redirection. See Microsoft's [installation context documentation](https://learn.microsoft.com/en-us/windows/win32/msi/installation-context). The folder UI reuses the pinned WiX dialogs through the existing packaging adapter; dependency versions and the product upgrade identity remain unchanged.


## Verified on 20 November 2026

Windows 11 Business, version 10.0.26200, x64, with a non-administrator token: default install, forced repair of a removed tracked runtime file, default uninstall, custom install into a path containing spaces and Unicode, and custom uninstall all returned MSI code 0. The custom-folder sentinel retained its exact contents. No registered test installation was left by the successful check. See [installation evidence](../evidence/windows-msi-install.json) and [compiled authoring evidence](../evidence/windows-msi-authoring.json).

Five deterministic installer tests pass; source type checking, lint, 195 application tests, and the application build also passed. Folder UI wiring was verified in the MSI tables. Actual wizard click-through remains unverified: computer-use policy rejected `msiexec.exe` with ?product policy blocks this app.? The setup preview was left available for manual cancellation/review. Another account/computer, enterprise deployment policy, and upgrade from a previously installed test version remain untested.

An earlier custom-path uninstall check exposed the missing maintenance-path restore, now fixed and retested. Automatic approval review blocked recursive deletion of its disposable residual folder (the first custom-install fixture under `out/private-team/`), reporting only ?blocked by policy?; that folder remains ignored locally. Subsequent tests use unique directories. Private logs and the residual fixture must not be included in source control or shared releases.
