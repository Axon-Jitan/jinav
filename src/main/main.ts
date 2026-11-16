// Composes desktop services at startup; contains no launcher or task business logic.
import { app, globalShortcut } from "electron";
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
app.setName("jinav");
if (!app.requestSingleInstanceLock()) app.quit();
else
  void app
    .whenReady()
    .then(async () => {
      const platform = adapterFactory();
      const store = new ConfigStore(app.getPath("userData"));
      await store.load();
      const secrets = new SecretStore(app.getPath("userData"));
      await secrets.load();
      const launcher = new LauncherWindow(platform);
      const shortcuts = new ShortcutRegistrar(globalShortcut, () =>
        launcher.toggle(),
      );
      if (!shortcuts.replace(store.config.shortcut))
        store.notice +=
          " Global shortcut unavailable. Use the tray and select a different shortcut.";
      const catalogue = new AppCatalogue(platform);
      const cache = new TaskCache(
        join(app.getPath("userData"), "driver-cache"),
      );
      await cache.reset();
      const host = new TaskHost(
        (state) => launcher.window.webContents.send(channels.task, state),
        cache,
      );
      const register = ipcRegistrar(launcher.window);
      register(channels.bootstrap, () => ({
        config: store.config,
        notice: store.notice,
        credential: secrets.status,
        platform: platform.label,
      }));
      launcherIpc(register, store, catalogue, shortcuts, launcher, platform);
      const executable = app.isPackaged
        ? join(process.resourcesPath, "driver", driverFilename())
        : join(app.getAppPath(), "resources/driver", driverFilename());
      const stopTask = taskIpc(
        register,
        store,
        secrets,
        host,
        launcher,
        platform,
        executable,
        new AgentDesktopDriver(executable, "jinav-diagnostics"),
      );
      const tray = trayIcon(
        () => launcher.toggle(),
        () => {
          void launcher.show("settings");
        },
        stopTask,
        () => app.quit(),
      );
      app.on("second-instance", () => {
        void launcher.show();
      });
      app.on("activate", () => {
        void launcher.show();
      });
      app.on("before-quit", (event) => {
        if (host.active) {
          event.preventDefault();
          void host.shutdown().then(() => app.quit());
          return;
        }
        globalShortcut.unregisterAll();
        platform.dispose?.();
        tray.destroy();
      });
      app.on("window-all-closed", () => {
        /* Tray owns application lifetime. */
      });
      await launcher.show(store.config.apps.length ? "menu" : "settings");
    })
    .catch((error) => {
      logger.error(
        "startup",
        error instanceof Error ? error.message : "Startup failed",
      );
      app.quit();
    });
