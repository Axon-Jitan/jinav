// Defines the persisted configuration contract; contains no storage operations.
import { z } from "zod";
import {
  MIN_WHEEL_RADIUS,
  MAX_WHEEL_RADIUS,
  DEFAULT_WHEEL_RADIUS,
} from "./wheelGeometry";
export const appSchema = z.object({
  id: z.string().min(1).max(2048),
  name: z.string().min(1).max(150),
  path: z.string().max(4096),
  icon: z.string().max(200000).optional(),
});
export type AppEntry = z.infer<typeof appSchema>;
export const configSchema = z.object({
  version: z.literal(2),
  apps: z
    .array(appSchema)
    .refine(
      (entries) => new Set(entries.map((e) => e.id)).size === entries.length,
      "Choose distinct applications",
    ),
  appSource: z
    .enum(["selected", "recent", "frequent", "running"])
    .default("selected"),
  showAsk: z.boolean().default(true),
  activationStyle: z.enum(["toggle", "open"]).default("toggle"),
  iconSize: z.enum(["small", "medium", "large"]).default("medium"),
  menuBackground: z.enum(["none", "soft", "solid"]).default("none"),
  appNames: z.enum(["hover", "hidden"]).default("hover"),
  labelPosition: z.enum(["auto", "top", "bottom"]).default("auto"),
  theme: z.enum(["light", "dark", "system"]).default("light"),
  menuRadius: z
    .number()
    .int()
    .min(MIN_WHEEL_RADIUS)
    .max(MAX_WHEEL_RADIUS)
    .default(DEFAULT_WHEEL_RADIUS),
  startQuietly: z.boolean().default(true),
  readyNotified: z.boolean().default(false),
  allowedApps: z
    .array(appSchema)
    .refine(
      (entries) => new Set(entries.map((e) => e.id)).size === entries.length,
      "Choose distinct allowed applications",
    )
    .default([]),
  appAccess: z.enum(["selected", "all"]).default("selected"),
  pauseOnUserInput: z.boolean().default(true),
  confirmExternal: z.literal(true).default(true),
  confirmDeletion: z.literal(true).default(true),
  keepTaskHistory: z.boolean().default(false),
  shortcut: z.string().min(1).max(100),
  launchOnLogin: z.boolean(),
  reducedMotion: z.boolean(),
  aiEnabled: z.boolean(),
  cloudConsent: z.boolean(),
  appCatalogConsent: z.boolean().default(false),
  physicalInput: z.boolean(),
  provider: z.enum(["anthropic", "openai"]).default("anthropic"),
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
  version: 2,
  apps: [],
  appSource: "selected",
  showAsk: true,
  activationStyle: "toggle",
  iconSize: "medium",
  menuBackground: "none",
  appNames: "hover",
  labelPosition: "auto",
  theme: "light",
  menuRadius: DEFAULT_WHEEL_RADIUS,
  startQuietly: true,
  readyNotified: false,
  allowedApps: [],
  appAccess: "selected",
  pauseOnUserInput: true,
  confirmExternal: true,
  confirmDeletion: true,
  keepTaskHistory: false,
  shortcut: "Ctrl+Alt+Space",
  launchOnLogin: false,
  reducedMotion: false,
  aiEnabled: false,
  cloudConsent: false,
  appCatalogConsent: false,
  physicalInput: false,
  provider: "anthropic",
  model: "claude-sonnet-4-5",
  endpoint: "https://api.anthropic.com/v1/messages",
  maxSteps: 25,
  maxSeconds: 180,
  maxTokens: 20000,
};
