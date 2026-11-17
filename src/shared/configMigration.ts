// Migrates known settings versions without replacing personal choices.
import { configSchema, type Config } from "./config";
export function configMigration(value: unknown): Config {
  if (
    value &&
    typeof value === "object" &&
    "version" in value &&
    value.version === 1
  )
    return configSchema.parse({ ...value, version: 2 });
  return configSchema.parse(value);
}
