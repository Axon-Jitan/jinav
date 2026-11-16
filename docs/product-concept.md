# jinav

**Your apps, and an optional AI assistant, at your cursor.**

jinav is a planned desktop application. Press one configurable shortcut and a small circular menu opens where you are working. From that menu you can open an application, return to a window that is already open, or ask jinav to carry out a task.

The goal is to shorten the distance between deciding what to do and starting it. You stay in control of which apps appear, how the menu opens, whether AI is available at all, which model powers it, and what it may access.

> **Status: in early development.** jinav is a product direction, not a released application. A preliminary test with the agent-desktop backend completed one Linux text-editor workflow. The radial interface, the integrated model-driven assistant, and the cross-platform experience still need to be implemented and tested. Nothing below is guaranteed to work yet.

---

## How it works

1. Move your cursor somewhere comfortable and press the shortcut.
2. A radial menu opens around that point and stays open after you release the keys.
3. Click an application to launch it or bring its window forward. You can also select **Ask jinav** to describe a task.
4. Press Escape or click outside the menu to dismiss it. Keyboard navigation also works.

The menu stays where it opened instead of following the pointer. Near a screen edge it shifts so every option remains visible.

A tray or menu-bar icon lets you open jinav, change settings, stop an active task, or quit.

### Proposed default shortcuts

| Operating system | Shortcut |
|---|---|
| Windows | Alt + Shift + Space |
| macOS | Option + Shift + Space |
| Linux | Alt + Shift + Space |

These are only suggestions. If the shortcut cannot be registered, jinav tells you and lets you choose a different one.

## The menu

- Up to **six application shortcuts** plus one clearly labelled **Ask jinav** option. Six is a starting limit, and usability testing may change it.
- **You choose the apps.** Examples include Word, Excel, Outlook, a browser, and File Explorer, or an editor, a terminal, and design tools.
- **Positions stay fixed** until you change them, so you learn where each app is.
- If an app is already running, jinav brings its window forward where the OS allows it. If the app has several windows, a compact chooser lets you pick one.
- If an app is missing, jinav explains why and offers to repair or remove the shortcut.

The launcher works on its own. **It needs no AI model and keeps working when AI is disabled, unconfigured, or unavailable.**

## Ask jinav (optional)

**Ask jinav** opens a compact panel: *"What would you like me to do?"* You describe the result you want in plain language, for example:

- "Open a text editor and create a meeting checklist."
- "Draft an email from these notes and let me review it."

These examples show intended workflows. Each workflow must be verified before it is advertised as supported. Being able to launch an app does not mean jinav can operate every feature inside it.

When possible, jinav identifies the app you were working in, and you can correct it or pick another target. jinav asks questions when a request is ambiguous.

### How tasks run

jinav uses the open-source **agent-desktop** backend for desktop control and a separate language model to decide each next step. jinav's own task runner connects them in a loop:

1. Observe the relevant application.
2. Choose the next action.
3. Check that the action is permitted.
4. Execute it.
5. Observe again and **verify** the effect.
6. Repeat until the task is complete or needs your input.

A command that returns success does not prove the goal was met. When jinav cannot confirm a result, it tells you so instead of reporting success.

### Progress and Stop

- Short progress updates, such as "Opening the editor" and "Checking the saved document".
- Clear states: running, waiting for input, stopping, completed, failed, cancelled.
- A **Stop** button is always visible, and another Stop option is in the tray.
- Stop prevents further actions. An action that was already sent may still have happened, so jinav reports the last verified state. **Stop is not undo.**
- One task runs at a time, and interrupted tasks never resume silently.

## Permissions

- When you approve a task, ordinary clicks and keystrokes inside that task don't need separate approval.
- **Sensitive actions always need separate confirmation**, with the specific details shown. These include sending email, making purchases, deleting important content, and changing security settings.
- Physical mouse or keyboard control needs deliberate permission and shows a clear indicator while active.
- Text found in webpages, documents, or apps is treated as task content. It can never change your goal or grant permissions.

## Privacy

- Opening the menu never starts observation or AI activity. jinav does not monitor your desktop in the background.
- With a **cloud model**, relevant app text, and screenshots if you enable them, are sent to that provider. Text read through accessibility can contain private information.
- **Local models** are planned through compatible adapters. jinav describes processing as local only when your configuration actually keeps it local.
- API keys are stored in OS-protected storage.
- Task history keeps short summaries by default, and you can clear it at any time.

## Settings

- Apps shown and their order
- Menu shortcut
- Start at login
- AI on or off
- Model connection and credentials
- App permissions and physical-input preferences
- Task limits and history controls
- Accessibility options, including reduced motion

The defaults work for a first-time user, and advanced options stay out of the way.

## Platform support

jinav targets **Windows, macOS, and Linux**. Each platform must be verified separately for app discovery, window focus, shortcuts, permissions, packaging, and computer use. Linux needs separate work for X11 and Wayland. When a desktop environment prevents the cursor-positioned menu, jinav uses a clearly explained fallback and does not present it as identical.

| Capability | Windows | macOS | Linux (X11) | Linux (Wayland) |
|---|---|---|---|---|
| Radial launcher | Planned | Planned | Planned | Planned (fallback may be needed) |
| Launch / focus | Planned | Planned | Planned | Planned |
| Ask jinav (agent-desktop) | Planned | Planned | Prototype: one editor workflow | Planned |

## First release scope

**Launcher:** configurable radial menu, real app picker, launch and focus behaviour, persistent settings, keyboard access, and tray entry.

**Ask jinav:** one working model integration, the agent-desktop backend, task progress, cancellation, bounded permissions, and a small set of verified workflows.

**Acceptance journeys:**

1. Create a meeting checklist in a real editor, save it, and verify the saved result independently.
2. Show that the launcher stays fully useful with AI disabled.

**Possible later work (not committed):** context-specific actions, saved routines, richer task history, more model providers, and more accessibility options.

## Tech stack

- [Electron](https://www.electronjs.org/), [React](https://react.dev/), and [TypeScript](https://www.typescriptlang.org/)
- Platform-specific adapters where native behaviour differs
- agent-desktop for desktop control, reached through a jinav interface
- Model providers reached through a jinav interface

### Proposed project layout

```
src/
  main/        Electron main process: shortcut, tray, windows, launcher, settings, task runner
  preload/     Narrow typed bridge between main and renderer
  renderer/    React UI: radial menu, Ask panel, progress panel, settings
  shared/      Types, IPC contracts, schemas, constants (no side effects)
  platform/    OS adapters: windows/, macos/, linux/
  ai/          Model provider interface and adapters
  tasks/       Task runner, permission checks, verification
```

The launcher code (`main/`, `renderer/`, `platform/`) never depends on `ai/` or `tasks/`.

## Contributing

All contributions follow [RULES.md](RULES.md). The most important rule is that **each file has one responsibility**. Every PR should state how it was tested and which platforms were verified.

## Who it's for

jinav is for people who move between desktop applications all day, and people who would benefit from help with repetitive computer tasks. Early development concentrates on a few common, reliable workflows before it expands to complex business applications.
