// Orchestrates one bounded observe-act-verify run; never executes arbitrary commands.
import { readFile, stat } from "node:fs/promises";
import type { DesktopDriver, Observation } from "../desktop/desktopDriver";
import type { ModelProvider } from "../ai/modelProvider";
import { actionSchema, type TaskRequest, type TaskState } from "../shared/task";
import type { Config } from "../shared/config";
import { actionPolicy } from "./actionPolicy";
import { observationFingerprint } from "./observationFingerprint";
export interface RunOptions {
  runId: string;
  request: TaskRequest;
  config: Config;
  verificationFile?: string;
}
export class TaskRunner {
  constructor(
    private readonly driver: DesktopDriver,
    private readonly model: ModelProvider,
    private readonly emit: (state: TaskState) => void,
    private readonly approve: (
      details: string,
      signal: AbortSignal,
    ) => Promise<boolean>,
  ) {}
  async run(options: RunOptions, signal: AbortSignal) {
    const { runId, request, config } = options;
    const goal =
      request.goal +
      (options.verificationFile
        ? `\nAuthorized output file (save through the application's GUI): ${options.verificationFile}. On completion supply the entire expectedText for independent read-only verification.`
        : "");
    let step = 0,
      last: Observation | undefined,
      uncertain = false;
    const state = (
      phase: TaskState["phase"],
      message: string,
      approval?: string,
    ) => this.emit({ runId, phase, message, step, approval });
    const history: string[] = [];
    let tokens = 0,
      repeated = 0,
      previous = "";
    const timeout = AbortSignal.timeout(config.maxSeconds * 1000);
    const active = AbortSignal.any([signal, timeout]);
    try {
      state("planning", "Observing the selected window");
      last = await this.driver.observe(request.target, active);
      active.throwIfAborted();
      for (step = 1; step <= config.maxSteps; step++) {
        active.throwIfAborted();
        state("planning", "Choosing the next action");
        const response = await this.model.next(
          goal,
          last.text,
          history.slice(-8),
          active,
        );
        active.throwIfAborted();
        tokens += response.tokens;
        if (tokens > config.maxTokens)
          throw Error("Model token budget reached.");
        const action = actionSchema.parse(response.action);
        const fingerprint = JSON.stringify({
          ...action,
          ...("reason" in action ? { reason: "" } : {}),
        }).replace(/@[\w-]+:e\d+/g, "@ref");
        if (fingerprint === previous) repeated++;
        else repeated = 0;
        previous = fingerprint;
        if (repeated >= 2)
          throw Error(
            "Repeated action detected. Stopped to prevent duplicate effects.",
          );
        if (action.kind === "request-input") {
          state(
            "failed",
            `Manual input needed: ${action.question}. Start a new task after correcting the context.`,
          );
          return;
        }
        if (action.kind === "complete") {
          if (!last.text.includes(action.evidence))
            throw Error(
              "Completion evidence is absent from the current observation.",
            );
          if (options.verificationFile) {
            if (action.expectedText === undefined)
              throw Error(
                "Saved-file verification requires exact expected text.",
              );
            if ((await stat(options.verificationFile)).size > 1024 * 1024)
              throw Error("Verification file exceeds the 1 MiB text limit.");
            active.throwIfAborted();
            const content = await readFile(options.verificationFile, {
              encoding: "utf8",
              signal: active,
            });
            active.throwIfAborted();
            if (content !== action.expectedText)
              throw Error("Saved file does not match the expected content.");
          }
          state(
            "completed",
            options.verificationFile
              ? "Saved file independently verified against the expected text."
              : `Verified visible result: ${action.evidence}`,
          );
          return;
        }
        const policy = actionPolicy(
          action,
          last,
          request.target,
          config.physicalInput,
        );
        if (policy.approval) {
          state(
            "waiting_for_approval",
            policy.approval,
            JSON.stringify(action),
          );
          if (!(await this.approve(policy.approval, active)))
            throw Error("Action declined.");
          active.throwIfAborted();
          // The CLI re-identifies this exact ref before dispatch; stale or ambiguous refs fail closed.
        }
        state("running", action.reason);
        uncertain = true;
        const before = observationFingerprint(last.text);
        let outcome;
        try {
          outcome = await this.driver.execute(
            action,
            request.target,
            config.physicalInput,
            active,
          );
        } catch (error) {
          active.throwIfAborted();
          last = await this.driver.observe(request.target, active);
          throw error;
        }
        active.throwIfAborted();
        last = await this.driver.observe(request.target, active);
        active.throwIfAborted();
        uncertain = false;
        if (!outcome.ok) {
          if (
            ["STALE_REF", "SNAPSHOT_NOT_FOUND"].includes(outcome.code ?? "") &&
            outcome.safeRetry
          ) {
            history.push(
              "Reference expired before delivery; fresh observation available.",
            );
            continue;
          }
          throw Error(
            `Action refused (${outcome.code ?? "UNKNOWN"}); delivery ${outcome.delivery}. Fresh state observed; no mutation was retried.`,
          );
        }
        if (observationFingerprint(last.text) === before) {
          repeated++;
          history.push(
            "No visible change after action; do not repeat blindly.",
          );
        } else
          history.push(
            `${action.reason}; a fresh UI observation was obtained. Confirm the intended effect from UI_CONTENT.`,
          );
      }
      throw Error("Step limit reached.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Task failed";
      state(
        signal.aborted ? "cancelled" : "failed",
        `${timeout.aborted ? "Time limit reached. " : ""}${signal.aborted ? "Stopped. " : detail + " "}${uncertain ? "The last dispatched action may have happened. " : ""}${last ? "Last observation retained only in memory; no further actions will run." : "No verified desktop state available."}`,
      );
    }
  }
}
