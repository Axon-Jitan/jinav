// Registers explicit task entry points; never observes when the launcher opens.
import { supportsTaskTarget } from "../shared/supportsTaskTarget";
import { dialog, globalShortcut } from "electron";
import { basename } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { channels } from "../shared/bridge";
import { taskRequestSchema } from "../shared/task";
import type { DesktopDriver } from "../desktop/desktopDriver";
import { providerFactory } from "../ai/providerFactory";
import type { ConfigStore } from "./configStore";
import type { SecretStore } from "./secretStore";
import type { TaskHost } from "./taskHost";
import type { LauncherWindow } from "./launcherWindow";
import type { PlatformAdapter } from "../platform/platformAdapter";
import { TaskApplications } from "./taskApplications";
import type { TaskHistoryStore } from "./taskHistoryStore";
import { PauseGate } from "../tasks/pauseGate";
import { desktopPermissions } from "./desktopPermissions";
import { appScope } from "../shared/appAccess";
export function taskIpc(
  register: (
    channel: string,
    handler: (payload: unknown) => Promise<unknown> | unknown,
  ) => void,
  store: ConfigStore,
  secrets: SecretStore,
  host: TaskHost,
  launcher: LauncherWindow,
  platform: PlatformAdapter,
  executable: string,
  desktop: DesktopDriver,
  taskHistory?: TaskHistoryStore,
) {
  let verificationFile: string | undefined;
  let pending = false,
    epoch = 0;
  let pendingController: AbortController | undefined;
  const pendingGate = new PauseGate();
  let pendingPaused = false;
  let submittedAt = Infinity;
  let taskDeadline: ReturnType<typeof setTimeout> | undefined;
  register(channels.windows, async () => {
    const windows = await platform.windows();
    const origin = launcher.origin?.id;
    return windows
      .filter((window) => !/^jinav|electron\.exe$/i.test(window.app))
      .sort(
        (a, b) =>
          Number(b.id === origin || b.id === `w-${origin}`) -
          Number(a.id === origin || a.id === `w-${origin}`),
      );
  });
  register(channels.saveKey, async (value) => {
    store.modelConnected = false;
    return secrets.save(z.string().max(4096).parse(value));
  });
  const checkDesktop = async (signal: AbortSignal) => {
    try {
      desktopPermissions(await desktop.status(signal));
      signal.throwIfAborted();
      store.desktopReady = true;
      store.desktopUnavailable = false;
    } catch (error) {
      if (!signal.aborted) {
        store.desktopReady = false;
        store.desktopUnavailable = true;
      }
      throw error;
    }
  };
  register(channels.driverStatus, async () => {
    await checkDesktop(AbortSignal.timeout(15000));
    return "Desktop accessibility is available. Observation starts only after Run.";
  });
  register(channels.testModel, async () => {
    store.modelConnected = false;
    if (!secrets.get())
      throw Error("Model unconfigured: enter a provider API key.");
    if (!store.config.cloudConsent)
      throw Error("Accept the provider disclosure before testing.");
    const provider = providerFactory(store.config, secrets.get());
    await provider.next(
      "Connection test only. Return request-input asking for a desktop task.",
      "No UI content was captured.",
      [],
      AbortSignal.timeout(45000),
    );
    store.modelConnected = true;
    return "Connection and structured tool response verified. Desktop task capability still requires a real workflow test.";
  });
  register(channels.chooseVerificationFile, async () => {
    const result = await dialog.showSaveDialog(launcher.window, {
      title: "Choose the exact output file to verify after GUI saving",
      defaultPath: "meeting-checklist.txt",
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
    verificationFile = result.canceled ? undefined : result.filePath;
    return verificationFile ?? "";
  });
  register(channels.startTask, async (value) => {
    if (pending || host.active) throw Error("A task is already running.");
    if (!store.config.aiEnabled)
      throw Error("AI is disabled. Enable it in settings.");
    if (store.modelProvisioningBlocked)
      throw Error("IT model provisioning is incomplete. Contact your IT team.");
    if (!secrets.get())
      throw Error("Ask jinav has not been provisioned. Contact your IT team.");
    if (!store.config.cloudConsent)
      throw Error("Review the provider disclosure before submitting.");
    const request = taskRequestSchema.parse(value);
    const initialScope = appScope(store.config);
    if (store.config.appAccess === "all" && !store.config.appCatalogConsent)
      throw Error(
        "Review All installed apps access in Settings before submitting.",
      );
    if (!request.target && !store.config.appCatalogConsent)
      throw Error(
        "Allow installed app names in Settings so jinav can choose an app, or select an existing window.",
      );
    const selectedFile = request.verificationFile;
    if (selectedFile && selectedFile !== verificationFile)
      throw Error(
        "Choose the verification file using the native output picker.",
      );
    if (store.config.pauseOnUserInput && !store.inputMonitoring)
      throw Error(
        "Physical user-input monitoring is unavailable. Check permissions, or explicitly turn off pause on mouse input in Settings.",
      );
    if (
      store.config.appAccess === "selected" &&
      !store.config.allowedApps.length
    )
      throw Error("Choose Allowed apps in Ask jinav settings first.");
    if (
      request.target &&
      store.config.appAccess === "selected" &&
      !store.config.allowedApps.some(
        (e) =>
          basename(e.path).toLowerCase() === request.target?.app.toLowerCase(),
      )
    )
      throw Error(
        "The context application is outside Allowed apps. Change it in Settings.",
      );
    const runId = randomUUID(),
      generation = ++epoch;
    pending = true;
    submittedAt = Date.now();
    if (taskDeadline) clearTimeout(taskDeadline);
    taskDeadline = setTimeout(() => {
      if (host.state.runId !== runId || (!pending && !host.active)) return;
      stop();
      host.state = {
        ...host.state,
        message: "Task time limit reached. " + host.state.message,
      };
      launcher.window.webContents.send(channels.task, host.state);
    }, store.config.maxSeconds * 1000);
    taskDeadline.unref();
    pendingPaused = false;
    pendingGate.set(false);
    pendingController = new AbortController();
    host.state = {
      runId,
      phase: "planning",
      message: request.target
        ? "Validating the selected application window"
        : "Finding installed applications",
      step: 0,
    };
    launcher.window.webContents.send(channels.task, host.state);
    try {
      await launcher.show("progress");
      await checkDesktop(pendingController.signal);
      pendingController.signal.throwIfAborted();
      if (globalShortcut && !globalShortcut.register("Escape", stop))
        throw Error(
          "Cannot register Escape to stop. Close the conflicting shortcut before running a task.",
        );
      const applications = store.config.appCatalogConsent
        ? await TaskApplications.discover(
            platform,
            pendingController.signal,
            desktop,
            store.config.appAccess === "all"
              ? undefined
              : store.config.allowedApps,
          )
        : new TaskApplications(platform, []);
      if (generation !== epoch)
        throw Error("Task cancelled before desktop observation.");
      if (
        store.config.appAccess === "all" &&
        !applications.allowedEntries.length
      )
        throw Error(
          "No supported installed applications were found. Choose selected apps or check application discovery.",
        );
      await pendingGate.wait(pendingController.signal);
      if (request.target) {
        const selected = request.target;
        if (
          store.config.appAccess === "all" &&
          !applications.allowedEntries.some(
            (entry) =>
              basename(entry.path).toLowerCase() === selected.app.toLowerCase(),
          )
        )
          throw Error(
            "The context application is outside this task's supported installed apps.",
          );
        const windows = desktop.allWindows
          ? await desktop.allWindows(pendingController.signal)
          : await platform.windows();
        if (generation !== epoch)
          throw Error("Task cancelled before desktop observation.");
        const normalize = (id: string) =>
          platform.executableSuffix ? id.replace(/^w-/, "") : id;
        const target = windows.find(
          (w) =>
            normalize(w.id) === normalize(selected.id) &&
            w.app === selected.app,
        );
        if (!target)
          throw Error(
            "Selected window is no longer available. Refresh the context.",
          );
        if (!supportsTaskTarget(target))
          throw Error(
            "This application or window is protected from automation. Return to Ask jinav and choose another window, or let jinav choose and open an app.",
          );
        request.target = {
          ...target,
          id:
            platform.executableSuffix && !target.id.startsWith("w-")
              ? `w-${target.id}`
              : target.id,
        };
      }
      await pendingGate.wait(pendingController.signal);
      if (
        !store.config.aiEnabled ||
        !store.config.cloudConsent ||
        (store.config.appAccess === "selected" &&
          !store.config.allowedApps.length)
      )
        throw Error("Task permissions were revoked before execution.");
      if (initialScope !== appScope(store.config))
        throw Error(
          "Allowed apps changed while preparing this task. Submit it again.",
        );
      host.start(
        request,
        structuredClone(store.config),
        secrets.get(),
        executable,
        selectedFile,
        runId,
        applications,
      );
      launcher.window.setAlwaysOnTop(true);
    } catch (error) {
      if (generation !== epoch)
        throw Error("Task cancelled before desktop observation.");
      if (generation === epoch) {
        globalShortcut?.unregister("Escape");
        host.state = {
          runId,
          phase: "failed",
          message:
            error instanceof Error ? error.message : "Task could not start",
          step: 0,
        };
        launcher.window.webContents.send(channels.task, host.state);
      }
      throw error;
    } finally {
      pending = false;
      pendingController = undefined;
    }
  });
  const stop = () => {
    if (taskDeadline) clearTimeout(taskDeadline);
    epoch++;
    pendingController?.abort();
    if (pending && !host.active) {
      globalShortcut?.unregister("Escape");
      host.state = {
        ...host.state,
        phase: "cancelled",
        message: "Stopped before desktop observation.",
        step: 0,
      };
      launcher.window.webContents.send(channels.task, host.state);
    }
    host.stop();
  };
  register(channels.stopTask, stop);
  const pause = (paused: boolean) => {
    if (!paused) submittedAt = Date.now();
    if (pending && !host.active) {
      if (paused === pendingPaused) return;
      pendingPaused = paused;
      pendingGate.set(paused);
      host.state = {
        ...host.state,
        phase: paused ? "paused" : "planning",
        message: paused
          ? "Paused for user input. Resume to continue validating the task."
          : "Validating the task",
      };
      launcher.window.webContents.send(channels.task, host.state);
    } else host.pause(paused, store.config);
  };
  register(channels.pauseTask, (value) => pause(z.boolean().parse(value)));
  register(channels.approve, (value) => host.approve(z.boolean().parse(value)));
  register(channels.taskState, () => host.state);
  // This MVP persists no task content or history; clearing removes its volatile summary.
  register(channels.clearHistory, async () => {
    if (host.active || pending)
      throw Error("Stop the active task before clearing its summary.");
    await host.clearHistory();
    await taskHistory?.clear();
  });
  return Object.assign(stop, {
    pause,
    userInput: (at: number) => {
      if (at >= submittedAt) pause(true);
    },
  });
}
