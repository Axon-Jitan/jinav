// Supervises the isolated task process; ignores messages from previous runs.
import { utilityProcess, type UtilityProcess } from "electron";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { taskPermissions } from "../shared/appAccess";
import { z } from "zod";
import type { Config } from "../shared/config";
import type { TaskRequest, TaskState } from "../shared/task";
import type { TaskCache } from "./taskCache";
import {
  appLaunchRequestSchema,
  type TaskApplicationLauncher,
} from "../shared/taskApplications";
const stateSchema = z.object({
  runId: z.string(),
  phase: z.enum([
    "idle",
    "planning",
    "running",
    "paused",
    "waiting_for_approval",
    "stopping",
    "completed",
    "failed",
    "cancelled",
  ]),
  message: z.string().max(10000),
  step: z.number(),
  approval: z.string().optional(),
  application: z.string().max(2048).optional(),
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
  private launchController: AbortController | undefined;
  private approvedLaunchId: string | undefined;
  private beforePause: TaskState | undefined;
  private runConfig: Config | undefined;
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
    applications?: TaskApplicationLauncher,
  ) {
    if (this.worker) throw Error("A task is already running.");
    if (!config.aiEnabled)
      throw Error("AI is disabled. Enable it in settings first.");
    if (!config.cloudConsent)
      throw Error(
        "Review the provider data disclosure in settings before submitting a task.",
      );
    if (!key)
      throw Error("Ask jinav has not been provisioned. Contact your IT team.");
    this.runConfig = structuredClone(config);
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
    const launchController = new AbortController();
    this.launchController = launchController;
    this.approvedLaunchId = undefined;
    this.state = {
      runId,
      phase: "planning",
      message: "Starting task engine",
      step: 0,
    };
    this.publish(this.state);
    worker.on("message", (message: unknown) => {
      if (this.worker !== worker) return;
      const launch = appLaunchRequestSchema.safeParse(message);
      if (launch.success) {
        const request = launch.data;
        if (request.runId !== runId) return;
        if (
          launchController.signal.aborted ||
          this.state.phase === "paused" ||
          this.approvedLaunchId !== request.appId ||
          !applications
        ) {
          worker.postMessage({
            kind: "app-launch-result",
            runId,
            requestId: request.requestId,
            ok: false,
            error: "Application launch has no current user approval.",
          });
          return;
        }
        this.approvedLaunchId = undefined;
        void applications
          .open(request.appId, launchController.signal)
          .then((target) => {
            if (this.worker === worker && !launchController.signal.aborted)
              worker.postMessage({
                kind: "app-launch-result",
                runId,
                requestId: request.requestId,
                ok: true,
                target,
              });
          })
          .catch((error) => {
            if (this.worker === worker && !launchController.signal.aborted)
              worker.postMessage({
                kind: "app-launch-result",
                runId,
                requestId: request.requestId,
                ok: false,
                error:
                  error instanceof Error
                    ? error.message.slice(0, 1000)
                    : "Application launch failed",
              });
          });
        return;
      }
      const parsed = z
        .object({ kind: z.literal("state"), state: stateSchema })
        .safeParse(message);
      if (parsed.success && parsed.data.state.runId === runId) {
        if (
          this.state.phase === "paused" &&
          !["completed", "cancelled", "failed"].includes(
            parsed.data.state.phase,
          )
        ) {
          this.beforePause = parsed.data.state;
          return;
        }
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
      applications: applications?.apps ?? [],
    });
  }
  approve(allow: boolean) {
    if (this.state.phase !== "waiting_for_approval")
      throw Error("No approval is pending");
    let approval: unknown;
    try {
      approval = this.state.approval ? JSON.parse(this.state.approval) : {};
    } catch {
      approval = {};
    }
    const launch = z
      .object({
        appId: z.string().regex(/^app-\d+$/),
        action: z.literal("Open application"),
      })
      .safeParse(approval);
    this.approvedLaunchId =
      allow && launch.success ? launch.data.appId : undefined;
    this.worker?.postMessage({ kind: "approve", allow });
  }
  pause(paused: boolean, config?: Config) {
    if (!paused && config && this.runConfig) {
      if (taskPermissions(config) !== taskPermissions(this.runConfig)) {
        this.stop();
        throw Error(
          "Permissions changed during this task. Start a new task with the current scope.",
        );
      }
    }
    if (!this.worker || this.state.phase === "stopping") return;
    if (paused && this.state.phase !== "paused") {
      this.beforePause = this.state;
      this.state = {
        ...this.state,
        phase: "paused",
        message: "Paused for user input. Resume obtains a fresh observation.",
      };
    } else if (!paused && this.state.phase === "paused") {
      this.state = this.beforePause ?? { ...this.state, phase: "planning" };
      this.beforePause = undefined;
    } else return;
    this.worker.postMessage({ kind: "pause", allow: paused });
    this.publish(this.state);
  }
  stop() {
    if (!this.worker || this.state.phase === "stopping") return;
    this.launchController?.abort();
    this.approvedLaunchId = undefined;
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
    this.beforePause = undefined;
    this.runConfig = undefined;
    this.launchController?.abort();
    this.approvedLaunchId = undefined;
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
