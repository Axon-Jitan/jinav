// Brokers cancellable application requests from the worker to the trusted host.
import { randomUUID } from "node:crypto";
import {
  appLaunchResultSchema,
  type TaskApplication,
  type TaskApplicationLauncher,
} from "../shared/taskApplications";
import type { TargetWindow } from "../shared/task";
export class WorkerApplications implements TaskApplicationLauncher {
  private pending = new Map<
    string,
    { resolve: (target: TargetWindow) => void; reject: (error: Error) => void }
  >();
  constructor(
    readonly apps: readonly TaskApplication[],
    private readonly runId: string,
    private readonly send: (message: unknown) => void,
  ) {}
  open(appId: string, signal: AbortSignal): Promise<TargetWindow> {
    signal.throwIfAborted();
    if (!this.apps.some((app) => app.id === appId))
      throw Error("Application is outside the task catalogue.");
    return new Promise((resolve, reject) => {
      const requestId = randomUUID();
      const abort = () => {
        this.pending.delete(requestId);
        reject(
          Error(
            "Application launch cancelled; an already dispatched launch may have happened.",
          ),
        );
      };
      const finish = () => {
        signal.removeEventListener("abort", abort);
        this.pending.delete(requestId);
      };
      this.pending.set(requestId, {
        resolve: (target) => {
          finish();
          if (signal.aborted) reject(Error("Application launch cancelled"));
          else resolve(target);
        },
        reject: (error) => {
          finish();
          reject(error);
        },
      });
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) {
        abort();
        return;
      }
      this.send({ kind: "launch-app", runId: this.runId, requestId, appId });
    });
  }
  receive(value: unknown) {
    const parsed = appLaunchResultSchema.safeParse(value);
    if (!parsed.success || parsed.data.runId !== this.runId) return false;
    const pending = this.pending.get(parsed.data.requestId);
    if (!pending) return true;
    if (parsed.data.ok) pending.resolve(parsed.data.target);
    else pending.reject(Error(parsed.data.error));
    return true;
  }
}
