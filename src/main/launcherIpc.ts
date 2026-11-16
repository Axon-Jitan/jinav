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
) {
  register(channels.discover, async () => catalogue.discover());
  register(channels.manualApp, async () => {
    const result = await dialog.showOpenDialog(launcher.window, {
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
    });
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
  register(channels.saveConfig, async (value) => {
    const next = configSchema.parse(value);
    for (const entry of next.apps) {
      if (
        !catalogue.entries.some(
          (e) => e.id === entry.id && e.path === entry.path,
        ) &&
        !store.config.apps.some(
          (e) => e.id === entry.id && e.path === entry.path,
        )
      )
        throw Error("Select applications from the native picker.");
    }
    const previous = store.config;
    if (!shortcuts.replace(next.shortcut))
      throw Error(
        "Shortcut unavailable. The previous working shortcut is retained; choose another combination or use the tray.",
      );
    try {
      next.apps = await Promise.all(next.apps.map((e) => catalogue.icon(e)));
      await store.save(next);
    } catch (error) {
      shortcuts.replace(previous.shortcut);
      throw error;
    }
    app.setLoginItemSettings({ openAtLogin: next.launchOnLogin });
    return "Settings saved";
  });
  register(channels.launch, async (value) => {
    const { id, windowId } = z
      .object({ id: z.string().max(2048), windowId: z.string().optional() })
      .strict()
      .parse(value);
    const entry = store.config.apps.find((e) => e.id === id);
    if (!entry)
      throw Error("Application is not configured. Select it in settings.");
    const windows = await catalogue.launch(entry, windowId);
    if (windows.length === 0) launcher.window.hide();
    return windows;
  });
  register(channels.windows, async () =>
    (await platform.windows())
      .sort(
        (a, b) =>
          Number(b.id === launcher.origin?.id) -
          Number(a.id === launcher.origin?.id),
      )
      .filter((w) => !/^jinav|electron\.exe$/i.test(w.app)),
  );
  register(channels.hide, () => launcher.window.hide());
  register(channels.settings, () => launcher.show("settings"));
}
