jinav - private Windows x64 team test

Share {{MSI_FILENAME}} privately with the authorized test team.
Do not upload this installer to GitHub, public downloads, or a release.

Setup:
1. Quit any older jinav instance before installing or starting this test build.
2. Install the MSI using your organization's normal software approval process.
   Keep the recommended local Programs folder, or use Change to choose another
   folder you can write to. Normal installation does not require administrator
   access. Cancel an older failed installer before using this rebuilt package.
   If a previous test build labelled 0.1.0 or 0.1.1 is installed, uninstall it
   first. The corrected product version is 0.0.1; Windows blocks version downgrades.
3. Open "jinav (team test)" from the Start menu. Access is already configured.
4. In Menu, add installed apps to the launcher.
   To change the shortcut, open General > Change. Record keys or choose "Type
   instead" and enter a combination such as Ctrl+Alt+J. Conflicts appear in the
   dialog and keep the previous shortcut working. Version 0.0.1 includes this fix.
5. In Ask jinav, enable AI, read and accept the provider disclosure, and choose
   allowed apps or All installed apps. Physical input is a separate permission.
6. Use the configured shortcut (new profiles: Ctrl+Alt+Space), then Ask jinav.
   Start with: "Open Notepad and leave it ready for me to type."
7. Use Stop to cancel a task. Stop does not undo actions already delivered.

Do not use personal, confidential, production, or customer data for testing.
Internet and active testing access are required for Ask jinav; the basic launcher
works without them.

Validated on Windows 11 x64: MSI administrative extraction, a fresh-profile launch,
automatic credential import, Windows-protected storage, packaged driver status,
and a real provider tool call without desktop content. A complete autonomous
editor-save workflow and install/upgrade/uninstall on teammates' PCs remain
untested. This is not a signed production release. Do not disable Windows security
controls; have IT review/sign the build if organizational policy requires it.

The .sha256 sidecar can be used to compare file integrity with the sender's copy.
It is not a publisher signature.

The rebuilt installer passed default and custom-folder install, repair, and
uninstall on a non-administrator Windows 11 x64 account. A pre-existing file in
the custom folder was preserved. Wizard click-through was blocked by the test
environment; folder controls were checked in compiled MSI tables.
