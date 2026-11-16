// Supervises the isolated task process; ignores messages from previous runs.
import { utilityProcess, type UtilityProcess } from "electron";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Config } from "../shared/config";
import type { TaskRequest, TaskState } from "../shared/task";
import type { TaskCache } from "./taskCache";
const stateSchema = z.object({
  runId: z.string(),
  phase: z.enum([
    "idle",
    "planning",
    "running",
    "waiting_for_approval",
    "stopping",
    "completed",
    "failed",
    "cancelled",
  ]),
  message: z.string().max(10000),
  step: z.number(),
  approval: z.string().optional(),
});
export class TaskHost {
  state: TaskState = {
    runId: "",
    phase: "idle",
    message: "Ready when you are",
    step: 0,
  };
  private worker: UtilityProcess | undefined;
  private stopTimer: ReturnType<typeof setTimeout> | undefined;
  private idleWaiters: (() => void)[] = [];
  constructor(
    private readonly publish: (state: TaskState) => void,
    private readonly cache: TaskCache,
  ) {}
  get active() {
    return !!this.worker;
  }
  start(
    request: TaskRequest,
    config: Config,
    key: string,
    executable: string,
    verificationFile?: string,
    runId = randomUUID(),
  ) {
    if (this.worker) throw Error("A task is already running.");
    if (!config.aiEnabled)
      throw Error("AI is disabled. Enable it in settings first.");
    if (!config.cloudConsent)
      throw Error(
        "Review the provider data disclosure in settings before submitting a task.",
      );
    if (!key)
      throw Error("Model unconfigured. Add a provider key in settings.");
    const worker = utilityProcess.fork(
      join(__dirname, "../tasks/worker.js"),
      [],
      {
        serviceName: "jinav task engine",
        stdio: "pipe",
        env: { ...process.env, AGENT_DESKTOP_HOME: this.cache.path(runId) },
      },
    );
    this.worker = worker;
    this.state = {
      runId,
      phase: "planning",
      message: "Starting task engine",
      step: 0,
    };
    this.publish(this.state);
    worker.on("message", (message: unknown) => {
      if (this.worker !== worker) return;
      const parsed = z
        .object({ kind: z.literal("state"), state: stateSchema })
        .safeParse(message);
      if (parsed.success && parsed.data.state.runId === runId) {
        if (
          this.state.phase === "stopping" &&
          parsed.data.state.phase !== "cancelled" &&
          parsed.data.state.phase !== "failed"
        )
          return;
        this.state = parsed.data.state;
        this.publish(this.state);
      }
      if (z.object({ kind: z.literal("done") }).safeParse(message).success) {
        if (this.state.phase === "stopping") {
          this.state = {
            ...this.state,
            phase: "cancelled",
            message:
              "Stopped. A previously dispatched action may already have happened.",
          };
          this.publish(this.state);
        }
        this.cleanup(worker);
      }
    });
    worker.on("exit", () => {
      if (this.worker === worker) {
        this.state = {
          ...this.state,
          phase: this.state.phase === "stopping" ? "cancelled" : "failed",
          message:
            "Task engine exited. Last dispatched action may have happened.",
        };
        this.publish(this.state);
        this.cleanup(worker);
      }
    });
    worker.stdout?.resume();
    worker.stderr?.resume();
    worker.postMessage({
      kind: "start",
      runId,
      request,
      config,
      key,
      executable,
      verificationFile,
    });
  }
  approve(allow: boolean) {
    if (this.state.phase !== "waiting_for_approval")
      throw Error("No approval is pending");
    this.worker?.postMessage({ kind: "approve", allow });
  }
  stop() {
    if (!this.worker || this.state.phase === "stopping") return;
    this.state = {
      ...this.state,
      phase: "stopping",
      message: "Stopping. A dispatched action may already have happened.",
    };
    this.publish(this.state);
    const worker = this.worker;
    worker.postMessage({ kind: "stop" });
    this.stopTimer = setTimeout(() => {
      if (this.worker !== worker) return;
      this.state = {
        ...this.state,
        phase: "cancelled",
        message:
          "Worker terminated after cancellation deadline. An outstanding OS action may have happened.",
      };
      this.publish(this.state);
      this.cleanup(worker);
    }, 3000);
  }
  private cleanup(worker: UtilityProcess) {
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.worker = undefined;
    worker.kill();
    void this.cache.remove(this.cache.path(this.state.runId)).catch(() => {
      this.state = {
        ...this.state,
        message:
          this.state.message +
          " Transient driver cache could not be removed; it will be cleared at next startup.",
      };
      this.publish(this.state);
    });
    for (const resolve of this.idleWaiters) resolve();
    this.idleWaiters = [];
  }
  async shutdown() {
    if (!this.active) return;
    this.stop();
    await new Promise<void>((resolve) => this.idleWaiters.push(resolve));
  }
  async clearHistory() {
    if (this.active)
      throw Error("Stop the current task before clearing history.");
    await this.cache.reset();
    this.state = {
      runId: "",
      phase: "idle",
      message: "History and transient snapshot caches cleared.",
      step: 0,
    };
    this.publish(this.state);
  }
}
