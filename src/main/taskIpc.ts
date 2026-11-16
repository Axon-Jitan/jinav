// Registers explicit task entry points; never observes when the launcher opens.
import { dialog } from "electron";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { channels } from "../shared/bridge";
import { taskRequestSchema } from "../shared/task";
import type { DesktopDriver } from "../desktop/desktopDriver";
import { AnthropicProvider } from "../ai/anthropicProvider";
import type { ConfigStore } from "./configStore";
import type { SecretStore } from "./secretStore";
import type { TaskHost } from "./taskHost";
import type { LauncherWindow } from "./launcherWindow";
import type { PlatformAdapter } from "../platform/platformAdapter";
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
) {
  let verificationFile: string | undefined;
  let pending = false,
    epoch = 0;
  register(channels.saveKey, async (value) =>
    secrets.save(z.string().max(4096).parse(value)),
  );
  register(channels.driverStatus, async () => {
    const value = await desktop.status(AbortSignal.timeout(15000));
    return JSON.stringify(value, null, 2);
  });
  register(channels.testModel, async () => {
    if (!secrets.get())
      throw Error("Model unconfigured: enter a provider API key.");
    if (!store.config.cloudConsent)
      throw Error("Accept the provider disclosure before testing.");
    const provider = new AnthropicProvider(
      store.config.endpoint,
      store.config.model,
      secrets.get(),
    );
    await provider.next(
      "Connection test only. Return request-input asking for a desktop task.",
      "No UI content was captured.",
      [],
      AbortSignal.timeout(45000),
    );
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
    if (!secrets.get())
      throw Error("Model unconfigured. Add a provider key in settings.");
    if (!store.config.cloudConsent)
      throw Error("Review the provider disclosure before submitting.");
    const request = taskRequestSchema.parse(value);
    const selectedFile = request.verificationFile;
    if (selectedFile && selectedFile !== verificationFile)
      throw Error(
        "Choose the verification file using the native output picker.",
      );
    const runId = randomUUID(),
      generation = ++epoch;
    pending = true;
    host.state = {
      runId,
      phase: "planning",
      message: "Validating the selected application window",
      step: 0,
    };
    launcher.window.webContents.send(channels.task, host.state);
    try {
      await launcher.show("progress");
      const windows = await platform.windows();
      if (generation !== epoch)
        throw Error("Task cancelled before desktop observation.");
      const target = windows.find(
        (w) => w.id === request.target.id && w.app === request.target.app,
      );
      if (!target)
        throw Error(
          "Selected window is no longer available. Refresh the context.",
        );
      if (
        /jinav|electron|powershell|cmd\.exe|terminal|credential|password|security|lockapp/i.test(
          target.app + " " + target.title,
        )
      )
        throw Error("This target is not supported for automation.");
      request.target = {
        ...target,
        id: platform.executableSuffix ? `w-${target.id}` : target.id,
      };
      host.start(
        request,
        structuredClone(store.config),
        secrets.get(),
        executable,
        selectedFile,
        runId,
      );
      launcher.window.setAlwaysOnTop(true);
    } catch (error) {
      if (generation === epoch) {
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
    }
  });
  const stop = () => {
    epoch++;
    if (pending && !host.active) {
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
  register(channels.approve, (value) => host.approve(z.boolean().parse(value)));
  register(channels.taskState, () => host.state);
  // This MVP persists no task content or history; clearing removes its volatile summary.
  register(channels.clearHistory, async () => {
    if (host.active || pending)
      throw Error("Stop the active task before clearing its summary.");
    await host.clearHistory();
  });
  return stop;
}
