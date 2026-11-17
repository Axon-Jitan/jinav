// Defines application capabilities available to an explicitly submitted task.
import { z } from "zod";
import { targetWindowSchema, type TargetWindow } from "./task";
export const taskApplicationSchema = z
  .object({
    id: z.string().regex(/^app-\d+$/),
    name: z.string().min(1).max(150),
  })
  .strict();
export type TaskApplication = z.infer<typeof taskApplicationSchema>;
export const appLaunchRequestSchema = z
  .object({
    kind: z.literal("launch-app"),
    runId: z.string().uuid(),
    requestId: z.string().uuid(),
    appId: z.string().regex(/^app-\d+$/),
  })
  .strict();
export const appLaunchResultSchema = z.discriminatedUnion("ok", [
  z
    .object({
      kind: z.literal("app-launch-result"),
      runId: z.string().uuid(),
      requestId: z.string().uuid(),
      ok: z.literal(true),
      target: targetWindowSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("app-launch-result"),
      runId: z.string().uuid(),
      requestId: z.string().uuid(),
      ok: z.literal(false),
      error: z.string().max(1000),
    })
    .strict(),
]);
export interface TaskApplicationLauncher {
  readonly apps: readonly TaskApplication[];
  open(appId: string, signal: AbortSignal): Promise<TargetWindow>;
}
