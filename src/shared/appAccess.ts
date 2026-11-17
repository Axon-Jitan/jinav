// Defines app-scope comparisons without granting arbitrary process access.
import type { Config, AppEntry } from "./config";
export function supportsTaskApp(entry: Pick<AppEntry, "name" | "path">) {
  return (
    !!entry.path &&
    !/jinav|electron|powershell|cmd\.exe|terminal|credential|password|security|lockapp/i.test(
      entry.name + " " + entry.path,
    )
  );
}
export function appScope(config: Config) {
  return JSON.stringify([
    config.appAccess,
    config.appCatalogConsent,
    config.allowedApps.map((e) => [e.id, e.path]),
  ]);
}
export function taskPermissions(config: Config) {
  return JSON.stringify([
    config.aiEnabled,
    config.cloudConsent,
    appScope(config),
    config.physicalInput,
    config.pauseOnUserInput,
  ]);
}
