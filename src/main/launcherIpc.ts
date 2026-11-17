// Registers validated launcher capabilities independently of AI services.
import { app, dialog } from "electron";
import { basename } from "node:path";
import { z } from "zod";
import { channels } from "../shared/bridge";
import { configSchema } from "../shared/config";
import type { ConfigStore } from "./configStore";
import type { AppCatalogue } from "./appCatalogue";
import type { ShortcutRegistrar } from "./shortcutRegistrar";
import type { LauncherWindow } from "./launcherWindow";
import type { PlatformAdapter } from "../platform/platformAdapter";
import { taskPermissions } from "../shared/appAccess";
import { appRuntime } from "./appRuntime";
export function launcherIpc(
  register: (
    channel: string,
    handler: (payload: unknown) => Promise<unknown> | unknown,
  ) => void,
  store: ConfigStore,
  catalogue: AppCatalogue,
  shortcuts: ShortcutRegistrar,
  launcher: LauncherWindow,
  platform: PlatformAdapter,
  onPermissionsChanged: () => void = () => {},
) {
  register(channels.shortcutCapture, (value) => {
    const enabled = z.boolean().parse(value);
    shortcuts.capture = enabled
      ? (key) => {
          if (
            !launcher.settings.window.isVisible() ||
            !launcher.settings.window.isFocused()
          )
            return false;
          launcher.settings.window.webContents.send(
            channels.shortcutRecorded,
            key,
          );
          return true;
        }
      : undefined;
  });
  register(channels.discover, async () => catalogue.discover(true));
  register(channels.manualApp, async () => {
    const result = await dialog.showOpenDialog(
      launcher.settings.window.isVisible()
        ? launcher.settings.window
        : launcher.window,
      {
        title: "Choose an installed application",
        properties: ["openFile"],
        filters: [
          {
            name: "Applications",
            extensions: platform.executableSuffix
              ? ["exe", "lnk"]
              : ["app", "desktop"],
          },
        ],
      },
    );
    const path = result.filePaths[0];
    if (result.canceled || !path) return null;
    const allowed = platform.executableSuffix
      ? /\.(exe|lnk)$/i
      : /\.(app|desktop)$/i;
    if (!allowed.test(path))
      throw Error(
        "Choose a supported executable, application bundle or desktop entry.",
      );
    const entry = await catalogue.icon({
      id: path,
      name: basename(path).replace(/\.(exe|lnk|app|desktop)$/i, ""),
      path,
    });
    catalogue.entries.push(entry);
    return entry;
  });
  const saveConfig = async (value: unknown) => {
    const next = configSchema.parse(value);
    if (
      store.managedModel &&
      (next.provider !== store.config.provider ||
        next.model !== store.config.model ||
        next.endpoint !== store.config.endpoint)
    )
      throw Error("Model settings are managed by IT.");
    for (const entry of [...next.apps, ...next.allowedApps]) {
      if (
        !catalogue.entries.some(
          (e) => e.id === entry.id && e.path === entry.path,
        ) &&
        ![...store.config.apps, ...store.config.allowedApps].some(
          (e) => e.id === entry.id && e.path === entry.path,
        )
      )
        throw Error("Select applications from the native picker.");
    }
    const previous = store.config;
    if (
      next.model !== previous.model ||
      next.provider !== previous.provider ||
      next.endpoint !== previous.endpoint ||
      next.cloudConsent !== previous.cloudConsent
    )
      store.modelConnected = false;
    if (!shortcuts.replace(next.shortcut))
      throw Error(
        "Shortcut unavailable. The previous working shortcut is retained; choose another combination or use the tray.",
      );
    try {
      next.apps = await Promise.all(next.apps.map((e) => catalogue.icon(e)));
      if (next.launchOnLogin !== previous.launchOnLogin)
        app.setLoginItemSettings({
          openAtLogin: next.launchOnLogin,
          args: appRuntime().development
            ? [app.getAppPath(), "--background"]
            : ["--background"],
        });
      if (taskPermissions(previous) !== taskPermissions(next))
        onPermissionsChanged();
      await store.save(next);
    } catch (error) {
      shortcuts.replace(previous.shortcut);
      if (next.launchOnLogin !== previous.launchOnLogin) {
        try {
          app.setLoginItemSettings({
            openAtLogin: previous.launchOnLogin,
            args: appRuntime().development
              ? [app.getAppPath(), "--background"]
              : ["--background"],
          });
        } catch {
          store.notice =
            "Startup preferences could not be restored. Check Windows startup settings.";
        }
      }
      throw error;
    }
    return "Settings saved";
  };
  let writes: Promise<unknown> = Promise.resolve();
  register(channels.saveConfig, (value) => {
    const next = writes.then(() => saveConfig(value));
    writes = next.catch(() => {
      /* Caller receives the failure. */
    });
    return next;
  });
  register(channels.launch, async (value) => {
    const { id, windowId } = z
      .object({ id: z.string().max(2048), windowId: z.string().optional() })
      .strict()
      .parse(value);
    const entry =
      launcher.wheelApps.find((e) => e.id === id) ??
      store.config.apps.find((e) => e.id === id);
    if (!entry)
      throw Error("Application is not configured. Select it in settings.");
    let windows;
    try {
      windows = await catalogue.launch(entry, windowId);
    } catch (error) {
      store.notice =
        error instanceof Error
          ? error.message
          : "Application launch failed. Repair its shortcut in Settings.";
      await launcher.show("settings");
      throw error;
    }
    if (windows.length === 0) launcher.window.hide();
    return windows;
  });
  register(channels.hide, () => {
    if (launcher.settings.window.isFocused()) launcher.settings.window.hide();
    else launcher.dismiss();
  });
  register(channels.settings, () => launcher.show("settings"));
  register(channels.settingsWindow, (value) =>
    launcher.settings.control(
      z.enum(["state", "minimize", "maximize", "close"]).parse(value),
    ),
  );
  register(channels.viewReady, (value) =>
    launcher.viewReady(z.string().uuid().parse(value)),
  );
  register(channels.prompt, () => launcher.show("prompt"));
  register(channels.tryMenu, () => launcher.tryMenu());
  register(channels.tooltip, (value) =>
    launcher.label(z.string().max(2048).nullable().parse(value)),
  );
  register(channels.wheelApps, () => launcher.resolveApps());
}
