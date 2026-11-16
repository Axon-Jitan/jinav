// Protects provider credentials with OS encryption; refuses plaintext persistence.
import { safeStorage } from "electron";
import { readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
export class SecretStore {
  private key = "";
  status = "No credential configured";
  constructor(private readonly directory: string) {}
  private async available() {
    return (
      (await safeStorage.isAsyncEncryptionAvailable()) &&
      (!("getSelectedStorageBackend" in safeStorage) ||
        safeStorage.getSelectedStorageBackend() !== "basic_text")
    );
  }
  async load() {
    try {
      const bytes = await readFile(join(this.directory, "credential.bin"));
      if (await this.available()) {
        const decrypted = await safeStorage.decryptStringAsync(bytes);
        this.key = decrypted.result;
        if (decrypted.shouldReEncrypt) await this.save(this.key);
        this.status = "Credential protected by OS storage";
      } else
        this.status =
          "Protected storage unavailable. Enter a session-only key.";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        this.status = "Credential could not be decrypted. Enter it again.";
    }
  }
  get() {
    return this.key;
  }
  async save(key: string) {
    this.key = key;
    if (!key) {
      await rm(join(this.directory, "credential.bin"), { force: true });
      return (this.status = "Credential removed");
    }
    if (!(await this.available())) {
      await rm(join(this.directory, "credential.bin"), { force: true });
      return (this.status =
        "Session-only credential: protected storage unavailable");
    }
    await writeFile(
      join(this.directory, "credential.bin"),
      await safeStorage.encryptStringAsync(key),
      { mode: 0o600 },
    );
    return (this.status = "Credential protected by OS storage");
  }
}
