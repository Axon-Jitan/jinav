// Hosts the task engine in a utility process; owns cancellation acknowledgements.
import { z } from "zod";
import { configSchema } from "../shared/config";
import { taskRequestSchema } from "../shared/task";
import { AgentDesktopDriver } from "../desktop/agentDesktopDriver";
import { providerFactory } from "../ai/providerFactory";
import { TaskRunner } from "./taskRunner";
import { taskApplicationSchema } from "../shared/taskApplications";
import { WorkerApplications } from "./workerApplications";
import { PauseGate } from "./pauseGate";
const pauseGate = new PauseGate();
const startSchema = z.object({
  kind: z.literal("start"),
  runId: z.string().uuid(),
  executable: z.string(),
  key: z.string(),
  config: configSchema,
  request: taskRequestSchema,
  verificationFile: z.string().optional(),
  applications: z.array(taskApplicationSchema).max(500).default([]),
});
let controller: AbortController | undefined;
let resolveApproval: ((allow: boolean) => void) | undefined;
let applications: WorkerApplications | undefined;
const parent = process.parentPort;
if (!parent) throw Error("Task worker requires an Electron utility process");
parent.on("message", async ({ data }: { data: unknown }) => {
  if (applications?.receive(data)) return;
  const control = z
    .object({
      kind: z.enum(["stop", "approve", "pause"]),
      allow: z.boolean().optional(),
    })
    .safeParse(data);
  if (control.success) {
    if (control.data.kind === "stop") {
      controller?.abort();
      resolveApproval?.(false);
    } else if (control.data.kind === "pause")
      pauseGate.set(control.data.allow === true);
    else resolveApproval?.(control.data.allow === true);
    return;
  }
  const parsed = startSchema.safeParse(data);
  if (!parsed.success || controller) return;
  const value = parsed.data;
  controller = new AbortController();
  applications = new WorkerApplications(
    value.applications,
    value.runId,
    (message) => parent.postMessage(message),
  );
  const runner = new TaskRunner(
    new AgentDesktopDriver(value.executable, `jinav-${value.runId}`),
    providerFactory(value.config, value.key),
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
    applications,
    pauseGate,
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
  applications = undefined;
  parent.postMessage({ kind: "done" });
});
