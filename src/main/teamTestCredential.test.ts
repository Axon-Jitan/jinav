// Verifies shared test credentials are opt-in and cannot be redirected to other providers.
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { teamTestCredential } from "./teamTestCredential";
import { managedModel } from "./managedModel";
import { ConfigStore } from "./configStore";
import type { SecretStore } from "./secretStore";
it("imports the opted-in test key through SecretStore without enabling AI or consent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jinav-team-"));
  try {
    const key = "fixture-only-credential";
    await writeFile(
      join(dir, "team-test-credential.bin"),
      Buffer.from("JINAV-TEAM-TEST-V1\0" + key),
    );
    const model = {
      version: 1,
      provider: "openai",
      model: "gpt-4.1-mini",
      endpoint: "https://api.openai.com/v1/responses",
      credentialSource: "bundled-test",
    };
    await writeFile(join(dir, "managed-model.json"), JSON.stringify(model));
    const store = new ConfigStore(dir);
    await store.load();
    let saved = "";
    const secrets = {
      get: () => saved,
      save: async (value: string) => {
        saved = value;
      },
    } as unknown as SecretStore;
    await managedModel(store, secrets, join(dir, "managed-model.json"), {});
    expect(saved).toBe(key);
    expect(store.teamTestBuild).toBe(true);
    expect(store.modelProvisioningBlocked).toBe(false);
    expect(store.config.aiEnabled).toBe(false);
    expect(store.config.cloudConsent).toBe(false);
    expect(store.config.allowedApps).toEqual([]);
    await expect(
      teamTestCredential(
        dir,
        "openai",
        "https://untrusted.example/v1/responses",
      ),
    ).rejects.toThrow("approved OpenAI endpoint");
    await writeFile(join(dir, "team-test-credential.bin"), "invalid");
    await expect(
      teamTestCredential(dir, "openai", model.endpoint),
    ).rejects.toThrow("Invalid team-test");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("does not import a bundled file when the metadata has not opted in", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jinav-team-opt-"));
  try {
    const store = new ConfigStore(dir);
    await store.load();
    await writeFile(
      join(dir, "team-test-credential.bin"),
      "must never be read",
    );
    await writeFile(
      join(dir, "managed-model.json"),
      JSON.stringify({
        version: 1,
        model: store.config.model,
        endpoint: store.config.endpoint,
      }),
    );
    const secrets = {
      get: () => "",
      save: async () => {
        throw Error("Unexpected save");
      },
    } as unknown as SecretStore;
    await managedModel(store, secrets, join(dir, "managed-model.json"), {});
    expect(store.managedModel).toBe(true);
    expect(store.teamTestBuild).toBe(false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
