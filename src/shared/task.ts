// Defines task messages without granting desktop capabilities.
import { z } from "zod";
export const actionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("launch-app"),
      appId: z.string().regex(/^app-\d+$/),
      reason: z.string().min(1).max(300),
    })
    .strict(),
  z
    .object({
      kind: z.literal("click"),
      ref: z.string().regex(/^@[a-zA-Z0-9_-]+:e\d+$/),
      reason: z.string().min(1).max(300),
    })
    .strict(),
  z
    .object({
      kind: z.enum(["set-value", "type"]),
      ref: z.string().regex(/^@[a-zA-Z0-9_-]+:e\d+$/),
      text: z.string().max(16000),
      reason: z.string().min(1).max(300),
    })
    .strict(),
  z
    .object({
      kind: z.literal("press"),
      key: z.enum([
        "ctrl+s",
        "ctrl+shift+s",
        "return",
        "escape",
        "tab",
        "shift+tab",
        "up",
        "down",
        "left",
        "right",
      ]),
      reason: z.string().min(1).max(300),
    })
    .strict(),
  z
    .object({
      kind: z.literal("complete"),
      evidence: z.string().min(1).max(2000),
      expectedText: z.string().max(100000).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("request-input"),
      question: z.string().min(1).max(1000),
    })
    .strict(),
]);
export type Action = z.infer<typeof actionSchema>;
export type TaskPhase =
  | "idle"
  | "planning"
  | "running"
  | "paused"
  | "waiting_for_approval"
  | "stopping"
  | "completed"
  | "failed"
  | "cancelled";
export interface TaskState {
  runId: string;
  phase: TaskPhase;
  message: string;
  step: number;
  approval?: string;
  application?: string;
}
export interface TargetWindow {
  id: string;
  app: string;
  title: string;
}
export const targetWindowSchema = z.object({
  id: z.string().min(1).max(100),
  app: z.string().min(1).max(2048),
  title: z.string().max(1000),
});
export const taskRequestSchema = z
  .object({
    goal: z.string().min(1).max(8000),
    verificationFile: z.string().max(4096).optional(),
    target: targetWindowSchema.optional(),
  })
  .strict();
export type TaskRequest = z.infer<typeof taskRequestSchema>;
