# Privacy and troubleshooting

Menu invocation never starts accessibility snapshots, screenshots or AI requests. The native launcher may read foreground-window identity/title metadata. There is no background desktop-monitoring schedule.

Submitted tasks send selected-window accessibility text to the configured provider. Other panes in the same window can contain private data. No screenshots are captured. Consent is explicit; editing the endpoint clears its checkbox. The configuration is fixed for each run.

Credentials use Electron 45's async OS-backed safeStorage API. `credential.bin` is separate from `settings.json` under jinav's Electron userData directory. Weak/plaintext fallback is rejected; unavailable storage means an explicitly disclosed session-only key. Windows DPAPI does not defend against other programs running as the same user. A local endpoint alone does not establish that all processing stays local.

History is an in-memory summary with a clear control. Full prompts/snapshots/keys are excluded from default logs. The driver requires a transient on-disk snapshot cache for references, isolated at `driver-cache/<run-id>` under userData. The host removes it after each run; startup clears abandoned caches. Cleanup failure is reported. Deletion is not a promise of forensic secure erasure. Interrupted tasks never resume automatically.

## Recovery

- **Shortcut conflict:** choose another combination. Failed replacement retains the working registration. The tray remains available. Application-local conflicts may exist even when global registration succeeds.
- **Missing application:** repair/remove the slot using discovery/manual selection. Windows foreground restrictions can prevent focus; choose the existing window from the taskbar. Refusal does not intentionally open duplicates. UWP exact multi-window matching is incomplete.
- **Settings recovery:** malformed JSON is renamed to `settings.invalid-<timestamp>.json` with a visible notice. Backups contain ordinary settings, never keys. Directory permission errors need access repaired.
- **Model failures:** add a key, save model/endpoint settings, review consent and test the connection. Authentication/rate-limit errors are surfaced. An endpoint must support Anthropic Messages tools; generic compatibility is not assumed.
- **Stale/inaccessible targets:** the driver fails closed on stale/ambiguous refs. Uncertain delivery is observed again without blind retry. Perform the requested manual step, then submit a new task with fresh context.
- **Stop:** progress and tray controls cancel further work. Stopping does not undo dispatched actions. Cancelling validation invalidates the pending start; cancelling requests suppresses late results.
- **Windows:** use the unlocked signed-in desktop. UAC secure prompts, other sessions and elevation boundaries are unsupported. No administrator requirement or bypass is introduced. Policy-blocked PowerShell/native helpers produce an error, not instructions to weaken security.
- **macOS:** computer use requires Accessibility consent for the actual host/package. Screen Recording is unnecessary without capture. Development-host consent does not validate a packaged build.
- **Linux X11:** validate graphical session, accessibility bus and window manager. A background service outside the logged-in session is not equivalent.
- **Native Wayland:** cursor-positioning APIs are deliberately avoided. Placement is compositor-controlled. Portal shortcuts, tray availability and desktop input need compositor-specific validation.

Unsigned packages still need signing/notarization work before production distribution. Keep upstream notices; do not disable OS security controls.
