// Composes desktop services at startup; contains no launcher or task business logic.
import { app, globalShortcut, Notification } from "electron";
import { join } from "node:path";
import { adapterFactory, driverFilename } from "../platform/adapterFactory";
import { ConfigStore } from "./configStore";
import { SecretStore } from "./secretStore";
import { AppCatalogue } from "./appCatalogue";
import { ShortcutRegistrar } from "./shortcutRegistrar";
import { LauncherWindow } from "./launcherWindow";
import { trayIcon } from "./trayIcon";
import { TaskHost } from "./taskHost";
import { ipcRegistrar } from "./ipcRegistrar";
import { launcherIpc } from "./launcherIpc";
import { taskIpc } from "./taskIpc";
import { channels } from "../shared/bridge";
import { TaskCache } from "./taskCache";
import { AgentDesktopDriver } from "../desktop/agentDesktopDriver";
import { logger } from "./logger";
import { UsageStore } from "./usageStore";
import { wheelSource } from "./wheelSource";
import { deploymentDefaults } from "./deploymentDefaults";
import { TaskHistoryStore } from "./taskHistoryStore";
import { UsageTracker } from "./usageTracker";
import { managedModel } from "./managedModel";
import { appIconPath } from "./appIconPath";
import { appRuntime } from "./appRuntime";
app.setName("jinav");
const provisioningEnvironment = { JINAV_API_KEY: process.env.JINAV_API_KEY };
delete process.env.JINAV_API_KEY;
let pendingSettings = false;
let openSettings: (() => void) | undefined;
app.on("second-instance", () => {
  pendingSettings = true;
  openSettings?.();
});
if (!app.requestSingleInstanceLock()) app.quit();
else
  void app
    .whenReady()
    .then(async () => {
      const platform = adapterFactory();
      platform.configureBrand?.(appIconPath());
      const store = new ConfigStore(app.getPath("userData"));
      await store.load();
      const secrets = new SecretStore(app.getPath("userData"));
      await secrets.load();
      const usage = new UsageStore(app.getPath("userData"));
      await usage.load();
      const catalogue = new AppCatalogue(platform, usage);
      await deploymentDefaults(
        store,
        catalogue,
        join(appRuntime().configuration, "deployment-defaults.json"),
      );
      await managedModel(
        store,
        secrets,
        join(appRuntime().configuration, "managed-model.json"),
        provisioningEnvironment,
      );
      const cache = new TaskCache(
        join(app.getPath("userData"), "driver-cache"),
      );
      await cache.reset();
      const taskHistory = new TaskHistoryStore(app.getPath("userData"));
      await taskHistory.load();
      const launcher = new LauncherWindow(platform);
      openSettings = () => {
        pendingSettings = false;
        void launcher.show("settings");
      };
      const shortcuts = new ShortcutRegistrar(globalShortcut, () =>
        launcher.toggle(),
      );
      if (!shortcuts.replace(store.config.shortcut))
        store.notice +=
          " Global shortcut unavailable. Use the tray and select a different shortcut.";
      launcher.resolveApps = wheelSource(store, catalogue, usage, platform);
      launcher.resolveRadius = () => store.config.menuRadius;
      launcher.resolvePreferences = () => store.config;
      void catalogue.discover().catch(() => {
        store.notice +=
          " Application discovery unavailable. Use the native picker.";
      });
      const host = new TaskHost((state) => {
        if (store.config.keepTaskHistory)
          void taskHistory
            .record(state)
            .catch(() =>
              logger.error(
                "usage-save",
                "Task outcome history could not be saved",
              ),
            );
        for (const window of [launcher.window, launcher.settings.window])
          window.webContents.send(channels.task, state);
        if (["completed", "failed", "cancelled", "idle"].includes(state.phase))
          globalShortcut.unregister("Escape");
      }, cache);
      launcher.taskActive = () =>
        [
          "planning",
          "running",
          "paused",
          "waiting_for_approval",
          "stopping",
        ].includes(host.state.phase);
      const register = ipcRegistrar(launcher.window, [
        launcher.settings.window,
      ]);
      register(channels.bootstrap, () => ({
        config: store.config,
        notice: store.notice,
        credential: secrets.status,
        platform: platform.label,
        wheelApps: launcher.wheelApps,
        wheelRadius: launcher.wheelRadius,
        origin: launcher.origin,
        modelConnected: store.modelConnected,
        inputMonitoring: store.inputMonitoring,
        desktopReady: store.desktopReady,
        desktopUnavailable: store.desktopUnavailable,
        modelProvisioned: !!secrets.get() && !store.modelProvisioningBlocked,
        teamTestBuild: store.teamTestBuild,
      }));
      register(channels.clearAppHistory, () => usage.clear());
      launcherIpc(
        register,
        store,
        catalogue,
        shortcuts,
        launcher,
        platform,
        () => stopTask(),
      );
      const executable = join(
        appRuntime().resources,
        "driver",
        driverFilename(),
      );
      const stopTask = taskIpc(
        register,
        store,
        secrets,
        host,
        launcher,
        platform,
        executable,
        new AgentDesktopDriver(executable, "jinav-diagnostics"),
        taskHistory,
      );
      const tracker = new UsageTracker(store, catalogue, usage);
      const unsubscribe = platform.subscribeEvents?.((event) => {
        if (event.kind === "ready") {
          shortcuts.trackRelease(true);
          store.inputMonitoring = true;
          return;
        }
        if (event.kind === "unavailable") {
          shortcuts.trackRelease(false);
          store.inputMonitoring = false;
          if (host.active) host.stop();
          return;
        }
        if (event.kind === "input") {
          if (launcher.ownsInputWindow(event.windowId)) return;
          if (store.config.pauseOnUserInput) stopTask.userInput(event.at);
          return;
        }
        if (event.kind === "release") {
          shortcuts.release();
          return;
        }
        void tracker
          .accept(event)
          .catch(() =>
            logger.error("usage-save", "Ranking history could not be saved"),
          );
      });
      const tray = trayIcon(
        () => launcher.toggle(),
        () => {
          void launcher.show("settings");
        },
        stopTask,
        () => app.quit(),
        platform.nativeIconPath?.(appRuntime().resources),
      );
      app.on("activate", () => {
        void launcher.show("settings");
      });
      app.on("before-quit", (event) => {
        if (host.active) {
          event.preventDefault();
          void host.shutdown().then(() => app.quit());
          return;
        }
        globalShortcut.unregisterAll();
        platform.dispose?.();
        unsubscribe?.();
        tray.destroy();
      });
      app.on("window-all-closed", () => {
        /* Tray owns application lifetime. */
      });
      if (!store.config.readyNotified && Notification.isSupported()) {
        const notification = new Notification({
          title: "jinav is ready",
          icon: appIconPath(),
          body: `${store.config.shortcut} opens the menu. Click for Settings.`,
          silent: true,
        });
        notification.on("click", () => void launcher.show("settings"));
        notification.show();
        await store.save({ ...store.config, readyNotified: true });
      }
      if (
        !store.config.startQuietly ||
        pendingSettings ||
        store.notice ||
        process.argv.includes("--settings")
      )
        await launcher.show("settings");
    })
    .catch((error) => {
      logger.error(
        "startup",
        error instanceof Error ? error.message : "Startup failed",
      );
      app.quit();
    });
