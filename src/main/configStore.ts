// Persists validated configuration atomically; never stores credentials.
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { configSchema, defaultConfig, type Config } from "../shared/config";
export class ConfigStore {
  config: Config = structuredClone(defaultConfig);
  notice = "";
  constructor(private readonly directory: string) {}
  async load() {
    await mkdir(this.directory, { recursive: true });
    try {
      this.config = configSchema.parse(
        JSON.parse(
          await readFile(join(this.directory, "settings.json"), "utf8"),
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      await rename(
        join(this.directory, "settings.json"),
        join(this.directory, `settings.invalid-${Date.now()}.json`),
      );
      this.notice =
        "Settings could not be read. Defaults restored; the original was retained as settings.invalid-*.json.";
    }
  }
  async save(value: unknown) {
    const config = configSchema.parse(value);
    const path = join(this.directory, "settings.json");
    await writeFile(`${path}.tmp`, JSON.stringify(config, null, 2), {
      mode: 0o600,
    });
    await rename(`${path}.tmp`, path);
    this.config = config;
  }
}
