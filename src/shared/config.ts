// Defines the persisted configuration contract; contains no storage operations.
import { z } from "zod";
export const appSchema = z.object({
  id: z.string().min(1).max(2048),
  name: z.string().min(1).max(150),
  path: z.string().max(4096),
  icon: z.string().max(200000).optional(),
});
export type AppEntry = z.infer<typeof appSchema>;
export const configSchema = z.object({
  version: z.literal(1),
  apps: z.array(appSchema).max(6),
  shortcut: z.string().min(1).max(100),
  launchOnLogin: z.boolean(),
  reducedMotion: z.boolean(),
  aiEnabled: z.boolean(),
  cloudConsent: z.boolean(),
  physicalInput: z.boolean(),
  model: z.string().min(1).max(150),
  endpoint: z
    .string()
    .url()
    .refine(
      (s) =>
        s.startsWith("https://") ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(s),
    ),
  maxSteps: z.number().int().min(1).max(100),
  maxSeconds: z.number().int().min(10).max(1800),
  maxTokens: z.number().int().min(1000).max(100000),
});
export type Config = z.infer<typeof configSchema>;
export const defaultConfig: Config = {
  version: 1,
  apps: [],
  shortcut: "Alt+Shift+Space",
  launchOnLogin: false,
  reducedMotion: false,
  aiEnabled: false,
  cloudConsent: false,
  physicalInput: false,
  model: "claude-sonnet-4-5",
  endpoint: "https://api.anthropic.com/v1/messages",
  maxSteps: 25,
  maxSeconds: 180,
  maxTokens: 20000,
};
