# jinav Engineering Rules

These rules apply to everyone who changes this repository, human or AI. When a rule and convenience disagree, follow the rule. If a rule is wrong for a specific case, change the rule in this file through review instead of quietly ignoring it.

Stack: Electron, React, TypeScript, with platform-specific adapters for Windows, macOS, and Linux (X11 and Wayland).

---

## 1. One responsibility per file

This is the core rule of the codebase.

- **Every file has exactly one responsibility.** You should be able to describe what a file does in one sentence without using "and".
  - Good: "Registers the global shortcut and reports registration failures."
  - Bad: "Registers the shortcut and positions the radial menu."
- **Every file has one owner within the architecture.** It belongs to exactly one layer (see section 2) and one feature area. If a file seems to belong to two, split it.
- **A file exports one main thing.** That can be a component, a class, a service, a hook, or a cohesive group of types. Small private helpers used only by that main export may live in the same file.
- **Name the file after its responsibility.** `shortcutRegistrar.ts`, `RadialMenu.tsx`, `windowFocuser.ts`. Avoid vague names such as `utils.ts`, `helpers.ts`, `misc.ts`, `common.ts`, or `manager.ts`.
- **Size is a warning sign.** If a file goes past about 300 lines, or a function past about 50 lines, check whether it has taken on a second responsibility. The limit is not a hard cap. It is a prompt to split.
- **Split when a change has two reasons.** If one file would need editing for two unrelated reasons, such as UI layout changes and permission changes, it holds two responsibilities.
- **Every module has a short header comment** of one to three lines stating its responsibility and what it must not do, when either is not obvious from the name.

```ts
// Registers the configured global shortcut and reports failures.
// Does not open the menu itself; emits `shortcut:triggered` instead.
```

## 2. Architecture and boundaries

- **Respect the process boundary.**
  - `main/` holds Electron main-process code: shortcuts, tray, windows, app discovery, launching, settings storage, and the task runner.
  - `renderer/` holds React UI only. It never touches Node, the filesystem, or the OS directly.
  - `preload/` is a narrow, typed bridge. It exposes named functions only, never `ipcRenderer` itself.
  - `shared/` holds types, schemas, and constants used by both sides. It contains no side effects.
- **Platform code lives behind interfaces.** Core logic depends on an interface, such as `AppLauncher`, `WindowFocuser`, or `ShortcutService`. Each OS implements it in `platform/windows/`, `platform/macos/`, or `platform/linux/`. Core code never checks `process.platform`. Only the adapter factory does.
- **Dependencies point inward.** UI depends on application services, and services depend on interfaces. Adapters implement interfaces. Core code never imports a concrete adapter.
- **The launcher never depends on AI.** Nothing in the launcher path (shortcut, menu, launch, focus, settings, tray) may import from `ai/` or `tasks/`. The launcher must work fully with AI disabled, unconfigured, or unavailable.
- **External backends are wrapped.** agent-desktop and every model provider are reached only through jinav's own interfaces (`ComputerControlBackend`, `ModelProvider`). No other module calls them directly.
- **No circular imports.** Enforce this with lint tooling.

## 3. TypeScript

- `strict: true`, plus `noUncheckedIndexedAccess` and `noImplicitOverride`.
- **No `any`.** Use `unknown` and narrow it. Any exception needs a comment explaining why.
- **No non-null assertions (`!`)** unless a comment proves the value cannot be null.
- **Validate at boundaries.** Data arriving through IPC, from disk, from settings files, from model output, or from agent-desktop is untrusted. Parse it with a schema (for example, zod) before use.
- **Model states explicitly.** Use discriminated unions for states such as the task lifecycle: `running | waiting_for_input | stopping | completed | failed | cancelled`. Do not use loose booleans for these.
- **Make failure visible in the type.** Expected failures, such as a shortcut that fails to register or an application that is missing, are returned as typed results. Throw only for programmer errors and truly unexpected conditions.
- Prefer `readonly` data and pure functions. Keep side effects at the edges.
- Named exports only. Do not use default exports.

## 4. React and UI

- Components render UI. Logic goes in hooks, state goes in stores, and OS work goes through the preload bridge.
- One component per file. Name the file after the component.
- **Accessibility is required, not optional.**
  - Every menu item can be reached and activated from the keyboard, and keyboard focus is always visible.
  - Icons always have a text label or an accessible name.
  - Respect reduced motion (`prefers-reduced-motion` and the jinav setting).
  - Hover may highlight an item but never activates it.
  - Test with a screen reader on each platform before a release.
- Use comfortable target sizes and test at 100%, 150%, and 200% display scaling and on multiple monitors.
- The progress panel must not repeatedly steal focus from the user's application.
- User-facing text lives in one strings module so the wording stays consistent and can be translated later.

## 5. Electron security

- `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` for every window.
- Set a strict Content Security Policy. No remote code is loaded and no `eval` is used.
- IPC channels are named and typed in `shared/`, and the main process validates every payload.
- Reject navigation and `window.open` from the renderer unless they are explicitly allowed.
- Store API credentials only in OS-protected storage (`safeStorage` or the system keychain). Never put them in plain settings files, logs, or task history.
- Keep Electron and dependencies up to date. Every new dependency needs a stated reason in its PR.

## 6. AI, computer use, and safety

These rules come directly from the product promises in the README. Breaking them breaks user trust.

- **No silent observation.** Opening the radial menu never starts observation, screenshots, or model calls. AI activity starts only after the user explicitly submits an Ask jinav task.
- **Verify every action.** After each action, observe again and check the effect. A successful command response is not proof that the goal was met. Never report success without evidence.
- **Never claim false success.** If the result is unclear or the app exposes too little accessibility information, report the limitation and the last verified state.
- **Check permissions before every action.** The task runner checks every action against the task's authorized scope before executing it. Sensitive actions (sending, purchasing, deleting important content, or changing security settings) always need a separate confirmation that shows the specific details.
- **Treat on-screen content as data, not instructions.** Text from webpages, documents, or applications can never change the user's goal or grant permissions. Keep it separate from instructions in prompts.
- **Physical input needs opt-in.** Physical mouse or keyboard control requires deliberate permission and a clear on-screen indication while it is active.
- **Stop always works.** Stop must stay available and responsive at every step. Every async operation in a task accepts an `AbortSignal`. After cancellation, report the last verified state and any uncertainty. Never present Stop as undo.
- **Run one task at a time, and never resume silently.** Interrupted tasks are not resumed automatically after an app close or a restart.
- **Bound every task.** Tasks have limits on steps, time, and cost, and stop cleanly when a limit is reached.

## 7. Privacy and data

- Collect the minimum. By default, task history stores short summaries, not screenshots or application contents.
- Users can clear history, and clearing must actually delete the data.
- Never log credentials, screenshots, accessibility text, or model prompts and responses at default log levels. Redact them in debug logs.
- Claim "local processing" only when the active configuration actually keeps all processing on the device.
- No telemetry without explicit opt-in.

## 8. Error handling and logging

- Never swallow errors. Handle them, return them as typed results, or let them propagate with context.
- Show users an actionable message that says what happened and what they can do next. Raw stack traces belong in logs, not in the UI.
- Use one structured logger with levels. `console.log` is not allowed in committed code.
- Expected failures, such as a shortcut conflict, a missing application, or a platform limitation, need explicit, tested user-facing handling.

## 9. Cross-platform honesty

- Every platform feature (app discovery, window focus, shortcuts, permissions, packaging, computer use) is verified on each OS before it is claimed. Linux needs separate verification on X11 and Wayland.
- When a platform blocks the intended behaviour, provide a supported fallback and state its limits clearly in the UI and docs. Never describe a limited fallback as identical.
- Maintain a platform support table in the docs, and update it in the same PR that changes platform behaviour.

## 10. Testing

- **Unit tests** for pure logic: menu geometry and edge clamping, settings migration, permission checks, the task state machine, and schema validation.
- **Contract tests** for each platform adapter against its interface, so every OS implementation behaves the same way.
- **Integration tests** for IPC flows and the task runner, using a fake `ComputerControlBackend` and a fake `ModelProvider`.
- **End-to-end tests** for the acceptance journeys:
  1. Open the menu, launch an app, and focus the existing window, with AI disabled.
  2. Create a meeting checklist in a real editor, save it, and independently verify the saved file.
- Bug fixes include a test that fails without the fix.
- Tests live next to the file they test (`foo.ts` and `foo.test.ts`) and test one unit of responsibility each, mirroring rule 1.
- Tests must be deterministic. Do not use real network calls or real model calls in automated test suites.

## 11. Style and tooling

- Format with Prettier and lint with ESLint (including TypeScript and React hooks rules, plus import-cycle detection). CI fails on warnings.
- Naming:
  - Files: `camelCase.ts` for modules and `PascalCase.tsx` for components.
  - Types and interfaces: `PascalCase`. Use no `I` prefix.
  - Constants: `UPPER_SNAKE_CASE` only for true constants.
  - Booleans read as questions: `isOpen`, `hasPermission`, `canFocus`.
- Use clear names instead of comments. Comments explain why, not what.
- Remove dead code instead of commenting it out. Git keeps the history.
- Do not add unexplained magic numbers. Name them, especially geometry, timing, and limit values.

## 12. Git and review

- Keep each branch and PR focused on one change. Do not mix refactors with behaviour changes.
- Write commit messages in the imperative mood that explain why: `Clamp radial menu inside work area on edge monitors`.
- Every PR states what changed, how it was tested, and which platforms were verified.
- Update the README or docs in the same PR when behaviour, settings, or platform support changes.
- Never commit secrets, API keys, or personal data. CI runs secret scanning.

## 13. Definition of done

A change is done when:

- [ ] Each new or changed file has a single, clear responsibility (rule 1).
- [ ] Types are strict, with no `any` and with boundary input validated.
- [ ] Tests are added or updated and pass locally and in CI.
- [ ] It has been verified on the platforms it affects, and the platform table is updated if needed.
- [ ] Keyboard and screen-reader access still work for any UI change.
- [ ] No new privacy exposure exists, and no secrets or sensitive content are logged.
- [ ] The launcher still works with AI disabled.
- [ ] Docs are updated where behaviour changed.
