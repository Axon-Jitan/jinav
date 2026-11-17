// Orchestrates one bounded observe-act-verify run; never executes arbitrary commands.
import { readFile, stat } from "node:fs/promises";
import type { DesktopDriver, Observation } from "../desktop/desktopDriver";
import type { ModelProvider } from "../ai/modelProvider";
import { actionSchema, type TaskRequest, type TaskState } from "../shared/task";
import type { Config } from "../shared/config";
import { actionPolicy } from "./actionPolicy";
import { observationFingerprint } from "./observationFingerprint";
import type { TaskApplicationLauncher } from "../shared/taskApplications";
import { PauseGate } from "./pauseGate";
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
    private readonly applications?: TaskApplicationLauncher,
    private readonly pauseGate = new PauseGate(),
  ) {}
  async run(options: RunOptions, signal: AbortSignal) {
    const { runId, request, config } = options;
    let target = request.target;
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
    ) =>
      this.emit({
        runId,
        phase,
        message,
        step,
        approval,
        application: target?.app,
      });
    const history: string[] = [];
    let tokens = 0,
      repeated = 0,
      previous = "";
    const timeout = AbortSignal.timeout(config.maxSeconds * 1000);
    const active = AbortSignal.any([signal, timeout]);
    const observe = async (window: NonNullable<TaskRequest["target"]>) => {
      await this.pauseGate.wait(active);
      active.throwIfAborted();
      return this.driver.observe(window, active);
    };
    try {
      state(
        "planning",
        target
          ? "Observing the selected window"
          : "Choosing an application for your task",
      );
      await this.pauseGate.wait(active);
      last = target
        ? await observe(target)
        : {
            text: JSON.stringify({
              state:
                "No application window selected. Use launch-app to open the application required by the goal.",
            }),
            refs: new Set<string>(),
          };
      active.throwIfAborted();
      let observedGeneration = this.pauseGate.generation;
      for (step = 1; step <= config.maxSteps; step++) {
        active.throwIfAborted();
        await this.pauseGate.wait(active);
        if (target && observedGeneration !== this.pauseGate.generation)
          last = await observe(target);
        observedGeneration = this.pauseGate.generation;
        const generation = this.pauseGate.generation;
        state("planning", "Choosing the next action");
        const response = await this.model.next(
          goal,
          JSON.stringify({
            installedApplications: this.applications?.apps ?? [],
            selectedWindow: target ?? null,
            UI_CONTENT: last.text,
          }),
          history.slice(-8),
          active,
        );
        active.throwIfAborted();
        tokens += response.tokens;
        if (tokens > config.maxTokens)
          throw Error("Model token budget reached.");
        await this.pauseGate.wait(active);
        if (generation !== this.pauseGate.generation) {
          history.push(
            "User interrupted. Discarded the proposed action; fresh observation required.",
          );
          continue;
        }
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
        if (action.kind === "launch-app") {
          const app = this.applications?.apps.find(
            (entry) => entry.id === action.appId,
          );
          if (!app || !this.applications)
            throw Error(
              "Requested application is outside the installed-app catalogue.",
            );
          const details = `Allow jinav to open ${app.name} or bring its existing window to the front for this task? ${action.reason}`;
          state(
            "waiting_for_approval",
            details,
            JSON.stringify({
              appId: app.id,
              application: app.name,
              action: "Open application",
              reason: action.reason,
            }),
          );
          if (!(await this.approve(details, active)))
            throw Error("Application launch declined.");
          active.throwIfAborted();
          await this.pauseGate.wait(active);
          if (generation !== this.pauseGate.generation) continue;
          state("running", `Opening ${app.name}`);
          uncertain = true;
          target = await this.applications.open(action.appId, active);
          active.throwIfAborted();
          last = await observe(target);
          active.throwIfAborted();
          uncertain = false;
          history.push(
            `Opened ${app.name}; its window identity and fresh accessibility observation were verified.`,
          );
          continue;
        }
        if (action.kind === "complete") {
          if (!target) throw Error("No application window has been verified.");
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
        if (!target)
          throw Error("Open an application before attempting desktop actions.");
        const policy = actionPolicy(action, last, target, config.physicalInput);
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
        await this.pauseGate.wait(active);
        if (generation !== this.pauseGate.generation) continue;
        uncertain = true;
        const before = observationFingerprint(last.text);
        let outcome;
        try {
          outcome = await this.driver.execute(
            action,
            target,
            config.physicalInput,
            active,
          );
        } catch (error) {
          active.throwIfAborted();
          last = await observe(target);
          throw error;
        }
        active.throwIfAborted();
        await this.pauseGate.wait(active);
        last = await observe(target);
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
