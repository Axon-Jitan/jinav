# Architecture

## Current launcher revision — 17 November 2026

The approved compact wheel and separate Settings window now replace the original 420-pixel shared panel. [launcher-contract.md](launcher-contract.md) specifies the version-2 settings/deployment contract and deliberate limits. Rendering, ranking, native discovery/activation, preferences and task execution remain separate modules. Main composition wires them together; the launcher has no model dependency.

`LauncherWindow` captures the pointer before asynchronous work, clones the ranked apps, clamps the 160-DIP overlay and waits for a run-specific render acknowledgement. This prevents old keyboard focus or a stale app list flashing on reopening. `SettingsWindow` owns the single scrollable reference-size Settings surface. A separate, non-focusable, mouse-transparent tooltip avoids expanding the wheel’s input region.

Windows emits minimal native window/foreground events instead of continuously polling processes. The usage tracker resolves known identities and counts first visible windows from new primary process instances, separating launch counts from activation. The cached catalogue supplies real icons; mode changes preserve manual selections. Ranking history has its own local file and deletion flow.

The task lifecycle additionally supports `paused`. A revisioned gate holds future requests, observations and actions, invalidates proposals interrupted by physical input, and forces fresh observation on resume. Pending startup has its own cancellation/pause gate before the utility process exists. Input events over the task-control overlay are ignored so Approve/Resume/Stop remain usable; input elsewhere pauses. Injected input is excluded by native flags. Current permission settings are checked on resume; revoked scope requires a new task. No task is silently resumed after restart.

Task scope is now an independent explicit Allowed apps list. Only those catalogue entries reach the provider’s ephemeral app IDs. Native context IDs are normalized against freshly validated driver IDs. Backend permission status and model connection are tested separately; readiness is session-only. Task history is off by default and optionally persists only terminal outcome/time/step metadata, not goals, screenshots, model responses or UI content.

The remainder records the underlying backend architecture introduced before the visual revision. Earlier descriptions of manual window selection refer to the conservative AI target policy; ordinary launcher activation now prefers the native MRU window as required by the current handoff.

Electron, React, TypeScript, Vite and Electron Forge follow the requested stack. Runtime JavaScript is bundled. The standalone launcher does not require a hosted service.

| Layer | Responsibility |
| --- | --- |
| `main/main.ts` | Composition of optional desktop services |
| `main/launcherWindow.ts`, `shortcutRegistrar.ts`, `trayIcon.ts` | Native launcher entry points |
| `main/appCatalogue.ts`, `platform/` | Installed identities and native activation |
| `main/configStore.ts`, `secretStore.ts` | Separate configuration and credential persistence |
| `main/ipcRegistrar.ts`, `preload/` | Trusted named renderer capabilities |
| `renderer/` | UI components with bridge-based state hooks |
| `shared/` | Pure contracts, schemas and geometry |
| `main/taskHost.ts` | Utility-process supervision |
| `tasks/taskRunner.ts` | Bounded observe-act-verify orchestration |
| `desktop/agentDesktopDriver.ts` | Pinned native CLI mapping |
| `ai/anthropicProvider.ts` | Messages API tool decisions |

Launcher feature modules import neither `ai/` nor `tasks/`. The composition root attaches the optional task service. This resolves the old specification's conflicting directory-wide wording: `main/` owns composition, but its launcher features remain independent of AI availability.

The Windows launcher reads Start Menu shortcuts, App Paths registrations and StartApps identities. In-box executable paths are checked before inclusion. Its hidden native window service accepts only inventory/foreground/focus JSON requests, keeping native work off Electron's event loop. Service preparation compiles a fixed Win32 binding without observing UI. When not ready, the launcher opens with unknown origin context. macOS uses bundle discovery and `/usr/bin/open`; Linux delegates desktop entries to `gio launch`, without evaluating Exec as shell code.

## Task lifecycle

`idle → planning → running → planning` repeats per action. Approvals enter `waiting_for_approval`; terminal states are `completed`, `failed`, `cancelled`. Stop enters `stopping` until acknowledgement, with a three-second termination deadline for an unresponsive worker. A requested manual step currently fails with an explanation; restart with fresh context afterward.

The main process fixes configuration and any selected window for a unique run. With explicit catalogue-disclosure consent, it discovers installed apps and assigns ephemeral opaque IDs. A task can start without a window: the model selects a `launch-app` ID, the user approves the named app, and the utility process sends a run-bound request to the native host. The host consumes that exact one-use approval, activates the known native entry, and resolves its window. Agent-desktop then supplies a fresh scoped observation. Switching apps repeats this approval flow; paths and launch arguments never come from the model. Multiple windows require explicit selection.

App-opening approval explicitly includes bringing the existing app to the front. That specific grant permits a focus-only headed driver command; it does not authorize physical typing or coordinates. Existing Store-app instances are focused rather than reactivated. The existing-window picker uses driver identities so hosted apps retain their actual owner instead of the generic frame-host process.

Policy accepts only references in the latest scoped snapshot; the CLI re-identifies them at action time. Partial/foreign observations are rejected. Commands use argument arrays with shell disabled, text uses supported stdin, and process time/output is bounded. Headed mode is never an automatic fallback. The app-launch broker observes cancellation and suppresses late replies; a launch already dispatched to Windows may still have happened.

The runner obtains a new observation after each action. The next model decision assesses its visible effect. Completion requires an exact quote from that observation; selected-file tasks additionally compare the complete expected text against a read-only file readback. These are limited forms of evidence, not proof of arbitrary business outcomes. A real model-driven saved-file acceptance journey remains outstanding.

Uncertain delivery triggers a new observation and failure, not a mutation retry. Safely refused stale references can proceed with fresh observations. Repeated actions/no progress, steps, elapsed time, request deadlines and reported cumulative token usage bound execution. Automatic network retries are zero. Token limits do not guarantee a monetary ceiling because a request may already have incurred charges.

Each provider request is an independent one-action Messages turn. Tool ID/name/input are checked. Previous steps become plain task context; no unresolved assistant tool call is replayed with missing or invented result IDs. This reduces retained conversational context while keeping the protocol inspectable. Local endpoints must implement the same Messages/tool protocol; arbitrary endpoints are not advertised as compatible.

## Security

Every window enables isolation and sandboxing, disables Node integration, loads local bundled assets under a CSP, and denies navigation/new windows. IPC checks sender WebContents, main frame and local origin before payload validation. Native application requests resolve against selected/configured catalogue entries.

UI text and application names are serialized as untrusted task content. The model has no shell, filesystem-writing, credential or coordinate tool. Its only app-launch capability accepts an opaque catalogue ID backed by one-use user approval. Requests/actions accept cancellation signals and the runner checks them after awaits. The host rejects cancelled/superseded responses. After physical input begins, subsequent physical input checks target focus. The first physical action can focus the explicitly selected window.

Every click/Enter and text entry outside recognized editors requires review. This conservative policy needs capability-specific refinement. It is not an OS sandbox or a perfect classifier of arbitrary application effects.

## Dependencies and packaging

Runtime dependencies: React/React DOM for UI, Zod for schemas, agent-desktop 1.3.1 for native accessibility. Electron is pinned at 45.3.3. Development dependencies supply Vite/esbuild compilation, TypeScript checks, ESLint hooks/cycle rules, Prettier, Vitest, Forge ZIP packaging and Playwright's Electron-only smoke harness. That harness needs no browser download.

The driver preparation script checks SHA-256 sidecars from the pinned npm dependency. The lockfile records tarball integrity. Executables/helpers/licences are extra resources outside ASAR; helpers retain required sibling names. Build each target on its actual OS to validate native dependencies, permissions and signing.

Official references checked:

- [Pinned source](https://github.com/vercel-labs/agent-desktop/tree/v1.3.1), [desktop](https://agent-browser.dev/desktop), [Windows](https://agent-browser.dev/desktop/platforms/windows), [macOS](https://agent-browser.dev/desktop/platforms/macos), [Linux](https://agent-browser.dev/desktop/platforms/linux), [headed mode](https://agent-browser.dev/desktop/guides/headed-mode). The binary's status, desktop/platform skills and command help establish the exact 1.3.1 mappings. JSON protocol 2.6 is a different version.
- Electron [shortcuts](https://www.electronjs.org/docs/latest/api/global-shortcut), [screen](https://www.electronjs.org/docs/latest/api/screen), [safe storage](https://www.electronjs.org/docs/latest/api/safe-storage), [security](https://www.electronjs.org/docs/latest/tutorial/security).
- Anthropic [tool definitions](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools), [model IDs](https://platform.claude.com/docs/en/models/overview).
- Windows [registered app manifests](https://learn.microsoft.com/en-us/powershell/module/appx/get-appxpackagemanifest?view=windowsserver2025-ps) and [native Store app activation](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-iapplicationactivationmanager-activateapplication). Store-app task windows are resolved through the driver's hosted-window identities rather than assuming the frame process is the app.
