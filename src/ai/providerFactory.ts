// Selects the explicit model API protocol; never infers it from a secret.
import type { Config } from "../shared/config";
import { AnthropicProvider } from "./anthropicProvider";
import { OpenAIProvider } from "./openaiProvider";
import type { ModelProvider } from "./modelProvider";
export function providerFactory(
  config: Pick<Config, "provider" | "endpoint" | "model">,
  key: string,
): ModelProvider {
  return config.provider === "openai"
    ? new OpenAIProvider(config.endpoint, config.model, key)
    : new AnthropicProvider(config.endpoint, config.model, key);
}
