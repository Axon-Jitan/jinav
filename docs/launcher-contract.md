# Approved launcher implementation contract

The design reference is Figma file `LWGhVrGwED8SNHOjFJsgM0`: wheel `21:290`, Settings `39:873`, `39:1164`, `39:1281`, `39:1433`, prompt `40:1085`, picker `40:1190`, source selector `56:1356`. Layer geometry, Manrope and colours were inspected through the Figma connector. The Settings vector comes from `50:1290`. Sample Office/SAP app artwork was not turned into installed shortcuts. The subsequent user request for adjustable spacing supersedes the reference's fixed diameter: targets are now 44-pixel circles with a bounded 58–110-DIP radius and the original 60-DIP default preserved. The closest bound follows eight-target separation, not arbitrary shrinking.

## Module boundaries

The later Settings request supersedes the fixed visual defaults with persisted choices: toggle/open-only activation, 20/24/32-pixel icons, none/soft/solid wheel backgrounds, hover/focus or hidden names, automatic/above/below captions, and light/dark/system themes. Target sizes remain 44 pixels; task permissions and required sensitive-action confirmations are unchanged. Light, no background, 24-pixel icons and toggle activation remain defaults for existing profiles.

| Module | Contract |
| --- | --- |
| `shared/wheelGeometry.ts`, `renderer/RadialMenu.tsx` | Stable eight angles with bounded adjustable radius; holes remain empty; no initial item focus; no OS work |
| `main/launcherWindow.ts` | Captured pointer/origin, frozen apps/radius, usable-area clamping and a render-ready session handshake |
| `main/settingsWindow.ts` | One separate 1040×760-DIP reference window; smaller work areas scroll; closing keeps background service |
| `main/wheelTooltip.ts` | Separate small mouse-transparent, non-focusable tooltip, clamped independently |
| `main/appCatalogue.ts`, `platform/` | Cached installed identities/icons and native MRU activation; no model dependency |
| `shared/appRanking.ts`, `main/usageTracker.ts`, `usageStore.ts` | Pure ranking; event-based, deduplicated primary launches; separate local store |
| `main/configStore.ts`, `shared/configMigration.ts` | Validated migration, serialized atomic writes, recovery and last-good in-memory state |
| `main/deploymentDefaults.ts` | New-profile seeds only; no policy enforcement or administrator console |
| `renderer/useSettings.ts` | Single in-flight commit; visible saved preferences change only after successful persistence |
| `main/taskIpc.ts`, `taskHost.ts`, `tasks/pauseGate.ts` | Explicit task entry, independent allowed apps, readiness, pending-start interruption, worker gates and cancellation |

The launcher imports no model/task engine. Main composition attaches the optional task service. Renderer access is restricted to validated named IPC from the two trusted application surfaces; the tooltip has no trusted mutation capability.

## Persistence

`settings.json` has `version: 2`. Existing fields remain, including `apps`, `shortcut`, `launchOnLogin`, `reducedMotion`, provider fields and task limits. Added fields:

| Field | Default / meaning |
| --- | --- |
| `appSource` | `selected`; other identifiers are `recent`, `frequent`, `running` |
| `showAsk` | `true`; visibility only |
| `startQuietly` | `true`; `--settings` explicitly opens Settings |
| `readyNotified` | `false`; per-user one-time ready notification |
| `allowedApps` | `[]`; independent native application identities, never inherited from wheel selections |
| `pauseOnUserInput` | `true`; real non-injected Windows input pauses work |
| `confirmExternal`, `confirmDeletion` | `true`, mandatory in this conservative preview |
| `keepTaskHistory` | `false`; enables minimal local outcome metadata |

Ordinary app entries retain stable `id`, display `name`, supported native `path`, and optional cached icon. Arrays reject duplicate IDs. Existing version-1 shortcuts are preserved; only new profiles default to Ctrl+Alt+Space. `settings.previous.json` is the previous valid commit; malformed primary files are renamed before recovery. The backup may be one ordinary change behind the malformed primary. Secrets remain in OS-encrypted `credential.bin`, with session-only fallback when protected storage is unavailable.

`app-usage.json` stores IDs, launch timestamps and activation recency, never titles or content. Frequency uses timestamps in the last 30 days; recent keeps the latest known launch even when older. Recent/Frequent fill from the saved manual list; running never does. Clearing ranking does not touch task outcomes or settings. `task-history.json` is opt-in terminal outcome metadata (up to 100 runs), not a transcript. Clear task history deletes it separately.

## Behaviour and deliberate limits

- Ask jinav offers Selected apps (the migration/default policy) or explicitly approved All installed apps. All mode resolves a new supported catalogue for each submitted task, capped at 500 identities. Selected mode retains its independent permission list without the former 100-app selection cap. The per-task backend catalogue remains bounded at 500 entries. Switching back preserves that list. The task host checks selected contexts against the resolved installed scope before observation and still requires task-scoped IDs and application-opening approval. App permissions, metadata consent, AI/cloud consent and physical-input changes stop the current or pending task before committing the preference change. Failed persistence can therefore leave the previous preference in place with the task safely stopped. This is host policy, not an OS sandbox or a promise of every-app compatibility.

- Pointer capture happens before asynchronous work. The overlay waits for its session’s React render acknowledgement before showing, so prior item focus/order cannot appear during reopening. One snapshot remains fixed until dismissal.
- Windows uses native visible-window/foreground events and non-injected input hooks in a hidden helper process. No continuous process polling occurs. The native bindings emit no typed keys, pointer coordinates or window text. Primary process start identity deduplicates focus and extra windows. Unsupported/existing processes, denied path access, some hosted apps and activity while jinav is closed are detection limits; history is not reconstructed from OS private activity.
- Native MRU activation follows observed foreground recency, then native window Z-order. Distinct executable paths with the same process basename remain a matching limitation. AI execution remains more conservative: ambiguous target windows require explicit selection.
- Windows focus verifies the actual foreground handle for a bounded interval after requesting activation. Minimized targets are restored; maximized targets are left maximized. If the long-lived inventory helper is refused, jinav starts a bounded one-shot helper from the foreground launcher and retries activation of the same validated window. It never relaunches an existing app to hide a focus failure. This uses the normal [Windows foreground-process rules](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow), without synthetic keystrokes, input-queue attachment or system-setting changes. Windows may still refuse elevated, locked-session or other restricted targets; that remains an explicit failure.
- Outside-click dismisses without restoring over the newly clicked application. Escape/shortcut dismissal attempts origin restoration; Windows can refuse. Try menu restores Settings.
- Try menu captures the invocation point before hiding Settings and shows the real desktop wheel only after it is ready. This prevents the floating wheel from appearing on top of the Settings preview. Escape restores Settings; focus-loss dismissal leaves Settings hidden to preserve the user's chosen focus. Startup failure restores Settings with an actionable error. The Settings hint explains Escape before invocation.
- Native hover/focus names sit beyond the entire wheel with a 12-DIP gap, rather than beside an individual icon where they could cover adjacent icons. The preferred side points outward; display-edge fallback selects another available side. Labels stay in the active display work area, permit wrapped long names, ignore mouse input and do not take focus. On a work area too small to contain both surfaces without intersection, the label is clamped to the available area. Geometry tests cover normal display sizes, corners, negative coordinates and multiple DPI scales; native validation remains host-specific.
- Appearance exposes only working choices. The approved light palette remains in use until a dark palette is supplied; system high contrast and reduced motion are honoured. No alternative icon/background designs were invented.
- Confirmations cannot be disabled in this preview. Task history intentionally stores metadata rather than full task descriptions. Permission changes while paused stop the existing run and require resubmission.
- Pause gates future model/actions/observations; an already-dispatched request/action may finish. Resume refreshes observation and discards interrupted proposals. Stop aborts supported outstanding work and suppresses late scheduling. Deadlines keep running while paused.
- A connected provider means a structured tool response was tested during this session. It does not establish reliable computer use. Backend permission status is checked separately without content capture and again before starting a task. No screenshot/AI observation occurs simply by opening the wheel or prompt.

## Remaining acceptance

### Installed-app picker

The picker shows real discovered apps with familiar application labels and genuine icons where available. Windows discovery excludes shortcuts whose executable targets are missing or unreadable and packaged Start entries without a verified current-user manifest registration. Each picker opening refreshes the catalogue; cached entries remain available for the warm launcher. This does not remove Windows shortcuts or delete saved preferences. Common work apps sort first. A small English-name heuristic hides Windows administration shortcuts from the initial list; Show system tools reveals them, and search always includes them. This is presentation filtering, not a complete installed-app inventory or a security boundary. Localized utility names may still appear. Known duplicate Windows built-in registrations collapse into one row, preferring an already-selected identity. Other same-named shortcuts remain distinct.

Selections appear as removable chips, whole rows select, and the primary button describes saving the selection. Search matches multiple words in any order. Empty results offer browsing. Changes stay staged until saved; Escape or Cancel preserves the previous selection. Ask jinav's app permissions remain separate from launcher shortcuts. Saved launcher apps have no six-app cap; a compact six-app page is browsed with the centre page control, wheel scrolling or Page Up / Page Down. The picker keeps its footer visible while the app list scrolls. Windows 11 at 125% is the verified host; other scaling, screen readers and platforms still need manual acceptance.

Real cloud-model editor/save execution and live interruption/Stop remain unverified; a temporary OpenAI credential has passed connection tests. Physical held-hotkey, pointer corners/edges, mixed-DPI hotplug, screen readers, login/relogin, toast delivery and external-launch accounting across a representative enterprise app set need manual acceptance. macOS, X11 and Wayland need separate native work. The unsigned Windows ZIP is a development artifact, not an IT deployment approval.
