// Seeds new profiles from optional IT defaults; never overrides an existing profile.
import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { ConfigStore } from "./configStore";
import type { AppCatalogue } from "./appCatalogue";
const schema = z
  .object({
    shortcut: z.string().min(1).max(100).optional(),
    appIds: z.array(z.string().min(1).max(2048)).default([]),
  })
  .strict();
export async function deploymentDefaults(
  store: ConfigStore,
  catalogue: AppCatalogue,
  path: string,
) {
  if (!store.isNewProfile) return;
  try {
    const defaults = schema.parse(JSON.parse(await readFile(path, "utf8")));
    const installed = await catalogue.discover();
    const apps = defaults.appIds
      .map((id) => installed.find((e) => e.id === id))
      .filter((e) => e !== undefined);
    if (apps.length !== defaults.appIds.length)
      store.notice +=
        " Some deployment applications were not installed. Add them in Settings.";
    await store.save({
      ...store.config,
      shortcut: defaults.shortcut ?? store.config.shortcut,
      apps: await Promise.all(apps.map((e) => catalogue.icon(e))),
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      store.notice +=
        " Deployment defaults could not be loaded; personal settings were not changed.";
  }
}
