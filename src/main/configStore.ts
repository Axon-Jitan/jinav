// Persists validated configuration atomically; never stores credentials.
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { configSchema, defaultConfig, type Config } from "../shared/config";
import { configMigration } from "../shared/configMigration";
export class ConfigStore {
  config: Config = structuredClone(defaultConfig);
  notice = "";
  modelConnected = false;
  inputMonitoring = false;
  desktopReady = false;
  desktopUnavailable = false;
  managedModel = false;
  teamTestBuild = false;
  modelProvisioningBlocked = false;
  isNewProfile = false;
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly directory: string) {}
  async load() {
    await mkdir(this.directory, { recursive: true });
    try {
      this.config = configMigration(
        JSON.parse(
          await readFile(join(this.directory, "settings.json"), "utf8"),
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.isNewProfile = true;
        return;
      }
      await rename(
        join(this.directory, "settings.json"),
        join(this.directory, `settings.invalid-${Date.now()}.json`),
      );
      this.notice =
        "Settings could not be read. Defaults restored; the original was retained as settings.invalid-*.json.";
      try {
        this.config = configMigration(
          JSON.parse(
            await readFile(
              join(this.directory, "settings.previous.json"),
              "utf8",
            ),
          ),
        );
        this.notice =
          "Settings could not be read. The last valid settings were restored; the malformed file was retained.";
      } catch {
        /* No valid backup: documented defaults remain available. */
      }
      try {
        await this.save(this.config);
      } catch {
        this.notice +=
          " Recovered settings are session-only until this profile directory is writable.";
      }
    }
  }
  async save(value: unknown) {
    const config = configSchema.parse(value);
    const write = this.writes.then(() => this.persist(config));
    this.writes = write.catch(() => {
      /* The caller receives the error; later saves remain available. */
    });
    return write;
  }
  private async persist(config: Config) {
    const path = join(this.directory, "settings.json");
    await writeFile(
      `${path}.previous.tmp`,
      JSON.stringify(this.config, null, 2),
      { mode: 0o600 },
    );
    await rename(
      `${path}.previous.tmp`,
      join(this.directory, "settings.previous.json"),
    );
    await writeFile(`${path}.tmp`, JSON.stringify(config, null, 2), {
      mode: 0o600,
    });
    await rename(`${path}.tmp`, path);
    this.config = config;
  }
}
