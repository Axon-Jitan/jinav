// Verifies IT metadata cannot carry plaintext credentials or reset user permissions.
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { managedModel } from "./managedModel";
import { ConfigStore } from "./configStore";
import type { SecretStore } from "./secretStore";
it("provisions without employee input and consumes the one-time environment credential", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jinav-managed-"));
  try {
    const store = new ConfigStore(directory);
    await store.load();
    const secret = {
      save: vi.fn().mockResolvedValue("Protected"),
    } as unknown as SecretStore;
    const path = join(directory, "managed-model.json");
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        model: "it-model",
        endpoint: "https://gateway.example.org/v1/messages",
      }),
    );
    const environment: { JINAV_API_KEY?: string } = {
      JINAV_API_KEY: "test-provisioning-secret",
    };
    await managedModel(store, secret, path, environment);
    expect(environment.JINAV_API_KEY).toBeUndefined();
    expect(secret.save).toHaveBeenCalledWith("test-provisioning-secret");
    expect(store.config.model).toBe("it-model");
    expect(store.config.cloudConsent).toBe(false);
    expect(store.config.aiEnabled).toBe(false);
    expect(store.managedModel).toBe(true);
    expect(
      await readFile(join(directory, "settings.json"), "utf8"),
    ).not.toContain("test-provisioning-secret");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
it("rejects a key baked into the distributable configuration without exposing it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jinav-managed-invalid-"));
  try {
    const store = new ConfigStore(directory);
    await store.load();
    const secret = { save: vi.fn() } as unknown as SecretStore;
    const path = join(directory, "managed-model.json");
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        model: "it-model",
        endpoint: "https://gateway.example.org/v1/messages",
        apiKey: "secret-value",
      }),
    );
    const environment = { JINAV_API_KEY: "ignored-secret" };
    await managedModel(store, secret, path, environment);
    expect(secret.save).not.toHaveBeenCalled();
    expect(store.managedModel).toBe(false);
    expect(store.notice).not.toContain("secret-value");
    expect("JINAV_API_KEY" in environment).toBe(false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
it("never forwards an existing protected key to a different provider without reprovisioning", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jinav-managed-scope-"));
  try {
    const store = new ConfigStore(directory);
    await store.load();
    const originalEndpoint = store.config.endpoint;
    const secret = {
      get: () => "existing-private-key",
      save: vi.fn(),
    } as unknown as SecretStore;
    const path = join(directory, "managed-model.json");
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        model: "it-model",
        endpoint: "https://different.example.org/v1/messages",
      }),
    );
    await managedModel(store, secret, path, {});
    expect(store.modelProvisioningBlocked).toBe(true);
    expect(store.config.endpoint).toBe(originalEndpoint);
    expect(secret.save).not.toHaveBeenCalled();
    expect(store.notice).not.toContain("existing-private-key");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
