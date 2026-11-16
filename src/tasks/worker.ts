// Hosts the task engine in a utility process; owns cancellation acknowledgements.
import { z } from "zod";
import { configSchema } from "../shared/config";
import { taskRequestSchema } from "../shared/task";
import { AgentDesktopDriver } from "../desktop/agentDesktopDriver";
import { AnthropicProvider } from "../ai/anthropicProvider";
import { TaskRunner } from "./taskRunner";
const startSchema = z.object({
  kind: z.literal("start"),
  runId: z.string().uuid(),
  executable: z.string(),
  key: z.string(),
  config: configSchema,
  request: taskRequestSchema,
  verificationFile: z.string().optional(),
});
let controller: AbortController | undefined;
let resolveApproval: ((allow: boolean) => void) | undefined;
const parent = process.parentPort;
if (!parent) throw Error("Task worker requires an Electron utility process");
parent.on("message", async ({ data }: { data: unknown }) => {
  const control = z
    .object({
      kind: z.enum(["stop", "approve"]),
      allow: z.boolean().optional(),
    })
    .safeParse(data);
  if (control.success) {
    if (control.data.kind === "stop") {
      controller?.abort();
      resolveApproval?.(false);
    } else resolveApproval?.(control.data.allow === true);
    return;
  }
  const parsed = startSchema.safeParse(data);
  if (!parsed.success || controller) return;
  const value = parsed.data;
  controller = new AbortController();
  const runner = new TaskRunner(
    new AgentDesktopDriver(value.executable, `jinav-${value.runId}`),
    new AnthropicProvider(value.config.endpoint, value.config.model, value.key),
    (state) => parent.postMessage({ kind: "state", state }),
    (_details, signal) =>
      new Promise<boolean>((resolve) => {
        const abort = () => {
          resolveApproval = undefined;
          resolve(false);
        };
        resolveApproval = (allow) => {
          signal.removeEventListener("abort", abort);
          resolveApproval = undefined;
          resolve(allow);
        };
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      }),
  );
  await runner.run(
    {
      runId: value.runId,
      request: value.request,
      config: value.config,
      verificationFile: value.verificationFile,
    },
    controller.signal,
  );
  controller = undefined;
  parent.postMessage({ kind: "done" });
});
