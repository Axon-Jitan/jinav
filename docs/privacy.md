# Privacy and troubleshooting

Menu invocation never starts accessibility snapshots, screenshots or AI requests. The native launcher may read foreground-window identity/title metadata without persisting the title. Windows native event hooks support app ranking and task interruption; they report app/process/window identities, input timing and injected-input flags, not typed characters, pointer coordinates or window content. Coordinates are used transiently inside the native helper only to determine whether an input targets jinav’s task controls. There is no background AI observation or screenshot schedule.

Submitted tasks send approved-window accessibility text to the configured provider. Automatic app choice sends only explicitly Allowed app names after consent; wheel selections grant no such permission. Paths, executable arguments and app icons are excluded. Other panes in an approved window can contain private data. The production task adapter captures no screenshots. The diagnostic desktop test captures jinav over a disposable backdrop for transparency evidence; those screenshots are separate from tasks. Editing the endpoint requires renewed disclosure consent. Configuration is fixed for each run, and changing permissions while paused requires resubmission.

Credentials use Electron 45's async OS-backed safeStorage API. `credential.bin` is separate from `settings.json` under jinav's Electron userData directory. Weak/plaintext fallback is rejected; unavailable storage means an explicitly disclosed session-only key. Windows DPAPI does not defend against other programs running as the same user. A local endpoint alone does not establish that all processing stays local.

The explicitly requested private team-test MSI includes an extractable shared test credential in its installed resources. Per-user safeStorage protection does not protect that installer copy. It is not included in ordinary builds or the repository. See [private testing provisioning](managed-model.md#private-team-test-msi) for sharing, revocation and testing limitations.

App-use history is separate from AI task history. Recent/Frequent track resolvable primary app launches while jinav runs; Currently open uses native visible windows and activation recency. IDs, launch times and activation recency stay in `app-usage.json`, never go to the provider, and can be cleared independently with confirmation. No closed-session history is reconstructed. Task summaries remain in memory by default; optional `task-history.json` records only terminal outcome, time and step count for up to 100 runs. Clear task history removes that file separately. Full prompts/snapshots/keys are excluded from default logs.

The driver requires a transient on-disk snapshot cache for references, isolated at `driver-cache/<run-id>` under userData. The host removes it after each run; startup clears abandoned caches. Cleanup failure is reported. Deletion is not a promise of forensic secure erasure. Interrupted tasks never resume automatically.

## Recovery

- **Shortcut conflict:** choose another combination. Failed replacement retains the working registration. The tray remains available. Application-local conflicts may exist even when global registration succeeds.
- **Missing application:** repair/remove the slot using discovery/manual selection. Windows foreground restrictions can prevent focus; choose the existing window from the taskbar. Refusal does not intentionally open duplicates. UWP exact multi-window matching is incomplete.
- **Settings recovery:** malformed JSON is renamed to `settings.invalid-<timestamp>.json`. The previous valid `settings.previous.json` is recovered if possible; otherwise documented defaults apply. Both contain ordinary settings, never keys. Directory permission errors need access repaired.
- **Model failures:** add a key, save model/endpoint settings, review consent and test the connection. Authentication/rate-limit errors are surfaced. An endpoint must support Anthropic Messages tools; generic compatibility is not assumed.
- **Stale/inaccessible targets:** the driver fails closed on stale/ambiguous refs. Uncertain delivery is observed again without blind retry. Perform the requested manual step, then submit a new task with fresh context.
- **Stop/Pause:** progress, Escape and tray Stop cancel further work. Pause gates future model calls, observations and actions; a request/action already dispatched may finish. Interacting with the task controls does not itself cause a new pause. Resume refreshes state; deadlines continue while paused. Stop does not undo dispatched actions. Cancelling validation invalidates the pending start; late responses cannot schedule actions.
- **Windows:** use the unlocked signed-in desktop. UAC secure prompts, other sessions and elevation boundaries are unsupported. No administrator requirement or bypass is introduced. Policy-blocked PowerShell/native helpers produce an error, not instructions to weaken security.
- **macOS:** computer use requires Accessibility consent for the actual host/package. Screen Recording is unnecessary without capture. Development-host consent does not validate a packaged build.
- **Linux X11:** validate graphical session, accessibility bus and window manager. A background service outside the logged-in session is not equivalent.
- **Native Wayland:** cursor-positioning APIs are deliberately avoided. Placement is compositor-controlled. Portal shortcuts, tray availability and desktop input need compositor-specific validation.

Unsigned packages still need signing/notarization work before production distribution. Keep upstream notices; do not disable OS security controls.

## Selected apps and all installed apps

Ask jinav defaults to Selected apps. All installed apps is a separate explicit choice with a disclosure: supported app names may be sent to the configured provider, and newly installed supported apps are included in future submitted tasks. It does not enable AI, cloud-data consent or physical typing. The previous selected list is retained when switching modes.

All-app tasks discover a fresh, bounded catalogue (up to 500 supported executable identities). The model receives task-scoped IDs and names rather than arbitrary process-launch access. Selected windows must match that installed scope before observation. An open task never silently expands its catalogue; changing app permissions stops it and requires resubmission. Window observations remain scoped to one task app at a time. App-opening and sensitive-action confirmations remain in force.

These are host policy checks, not an OS security sandbox. Unsupported-app filtering and executable-basename window matching have the limitations documented in the launcher contract. Broad access does not prove support for every installed application or permission to operate elevated/locked desktops. No continuous all-app content capture is added.
