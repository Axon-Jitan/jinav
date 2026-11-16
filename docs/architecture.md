# Architecture

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

The main process fixes configuration and authorized window identity for a unique run. An Electron utility process hosts the runner. Policy accepts only references in the latest scoped snapshot; the CLI re-identifies them at action time. Partial/foreign observations are rejected. Commands use argument arrays with shell disabled, text uses supported stdin, and process time/output is bounded. Headed mode is never an automatic fallback.

The runner obtains a new observation after each action. The next model decision assesses its visible effect. Completion requires an exact quote from that observation; selected-file tasks additionally compare the complete expected text against a read-only file readback. These are limited forms of evidence, not proof of arbitrary business outcomes. A real model-driven saved-file acceptance journey remains outstanding.

Uncertain delivery triggers a new observation and failure, not a mutation retry. Safely refused stale references can proceed with fresh observations. Repeated actions/no progress, steps, elapsed time, request deadlines and reported cumulative token usage bound execution. Automatic network retries are zero. Token limits do not guarantee a monetary ceiling because a request may already have incurred charges.

Each provider request is an independent one-action Messages turn. Tool ID/name/input are checked. Previous steps become plain task context; no unresolved assistant tool call is replayed with missing or invented result IDs. This reduces retained conversational context while keeping the protocol inspectable. Local endpoints must implement the same Messages/tool protocol; arbitrary endpoints are not advertised as compatible.

## Security

Every window enables isolation and sandboxing, disables Node integration, loads local bundled assets under a CSP, and denies navigation/new windows. IPC checks sender WebContents, main frame and local origin before payload validation. Native application requests resolve against selected/configured catalogue entries.

UI text is serialized as untrusted task content. The model has no shell, filesystem-writing, credential, coordinate or app-launch tool. Requests/actions accept cancellation signals and the runner checks them after awaits. The host rejects cancelled/superseded responses. After physical input begins, subsequent physical input checks target focus. The first physical action can focus the explicitly selected window.

Every click/Enter and text entry outside recognized editors requires review. This conservative policy needs capability-specific refinement. It is not an OS sandbox or a perfect classifier of arbitrary application effects.

## Dependencies and packaging

Runtime dependencies: React/React DOM for UI, Zod for schemas, agent-desktop 1.3.1 for native accessibility. Electron is pinned at 45.3.3. Development dependencies supply Vite/esbuild compilation, TypeScript checks, ESLint hooks/cycle rules, Prettier, Vitest, Forge ZIP packaging and Playwright's Electron-only smoke harness. That harness needs no browser download.

The driver preparation script checks SHA-256 sidecars from the pinned npm dependency. The lockfile records tarball integrity. Executables/helpers/licences are extra resources outside ASAR; helpers retain required sibling names. Build each target on its actual OS to validate native dependencies, permissions and signing.

Official references checked:

- [Pinned source](https://github.com/vercel-labs/agent-desktop/tree/v1.3.1), [desktop](https://agent-browser.dev/desktop), [Windows](https://agent-browser.dev/desktop/platforms/windows), [macOS](https://agent-browser.dev/desktop/platforms/macos), [Linux](https://agent-browser.dev/desktop/platforms/linux), [headed mode](https://agent-browser.dev/desktop/guides/headed-mode). The binary's status, desktop/platform skills and command help establish the exact 1.3.1 mappings. JSON protocol 2.6 is a different version.
- Electron [shortcuts](https://www.electronjs.org/docs/latest/api/global-shortcut), [screen](https://www.electronjs.org/docs/latest/api/screen), [safe storage](https://www.electronjs.org/docs/latest/api/safe-storage), [security](https://www.electronjs.org/docs/latest/tutorial/security).
- Anthropic [tool definitions](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools), [model IDs](https://platform.claude.com/docs/en/models/overview).
