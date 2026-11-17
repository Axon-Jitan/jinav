// Loads IT-owned model metadata; credentials arrive through protected per-user provisioning.
// Never accepts an API key in the distributable JSON file.
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { configSchema } from "../shared/config";
import type { ConfigStore } from "./configStore";
import type { SecretStore } from "./secretStore";
const schema = z
  .object({
    version: z.literal(1),
    provider: configSchema.shape.provider,
    model: configSchema.shape.model,
    endpoint: configSchema.shape.endpoint,
  })
  .strict();
export async function managedModel(
  store: ConfigStore,
  secrets: SecretStore,
  path: string,
  environment: Record<string, string | undefined>,
) {
  const credential = environment.JINAV_API_KEY;
  delete environment.JINAV_API_KEY;
  try {
    const model = schema.parse(JSON.parse(await readFile(path, "utf8")));
    if (
      (store.config.endpoint !== model.endpoint ||
        store.config.provider !== model.provider) &&
      !credential &&
      secrets.get()
    )
      throw Error("A provider change needs a replacement credential from IT.");
    await store.save({
      ...store.config,
      model: model.model,
      provider: model.provider,
      endpoint: model.endpoint,
      cloudConsent:
        store.config.endpoint === model.endpoint &&
        store.config.provider === model.provider &&
        store.config.cloudConsent,
    });
    store.managedModel = true;
    if (credential)
      await secrets.save(z.string().min(1).max(4096).parse(credential));
  } catch (error) {
    store.modelProvisioningBlocked =
      (error as NodeJS.ErrnoException).code !== "ENOENT" || !!credential;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      store.notice +=
        " IT model provisioning could not be loaded. Contact your administrator.";
    else if (credential)
      store.notice +=
        " A provisioning credential was ignored because the IT model configuration is missing.";
  }
}
