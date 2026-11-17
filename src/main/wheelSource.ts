// Resolves ranked wheel snapshots from cached app identities and native windows.
import { basename } from "node:path";
import type { ConfigStore } from "./configStore";
import type { AppCatalogue } from "./appCatalogue";
import type { UsageStore } from "./usageStore";
import type { PlatformAdapter } from "../platform/platformAdapter";
import { appRanking } from "../shared/appRanking";
export function wheelSource(
  store: ConfigStore,
  catalogue: AppCatalogue,
  usage: UsageStore,
  platform: PlatformAdapter,
) {
  return async () => {
    if (store.config.appSource === "selected") return store.config.apps;
    const entries = await catalogue.discover();
    const windows =
      store.config.appSource === "running" ? await platform.windows() : [];
    const running = entries
      .filter((e) =>
        windows.some(
          (w) => basename(e.path).toLowerCase() === w.app.toLowerCase(),
        ),
      )
      .map((e) => e.id);
    return Promise.all(
      appRanking(store.config, entries, usage.entries, running).map((e) =>
        catalogue.icon(e),
      ),
    );
  };
}
