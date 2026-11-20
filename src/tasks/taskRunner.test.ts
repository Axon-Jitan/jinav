// Exercises task bounds and cancellation against deterministic fake interfaces.
import { expect, it, vi } from "vitest";
import type { Action, TaskState } from "../shared/task";
import type { ModelProvider } from "../ai/modelProvider";
import type { DesktopDriver } from "../desktop/desktopDriver";
import { TaskRunner } from "./taskRunner";
import { defaultConfig } from "../shared/config";
import type { TaskApplicationLauncher } from "../shared/taskApplications";
import { PauseGate } from "./pauseGate";
it("discards an interrupted proposal and obtains fresh refs before resuming", async () => {
  const f = fixture();
  const gate = new PauseGate();
  let finish: ((value: { action: Action; tokens: number }) => void) | undefined;
  f.model.next = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({
      action: { kind: "complete", evidence: "checklist" },
      tokens: 10,
    });
  const runner = new TaskRunner(
    f.driver,
    f.model,
    (s) => f.states.push(s),
    async () => true,
    undefined,
    gate,
  );
  const running = runner.run(options, new AbortController().signal);
  await vi.waitFor(() => expect(f.model.next).toHaveBeenCalledOnce());
  gate.set(true);
  finish?.({ action: write, tokens: 10 });
  await Promise.resolve();
  expect(f.driver.execute).not.toHaveBeenCalled();
  gate.set(false);
  await running;
  expect(f.driver.execute).not.toHaveBeenCalled();
  expect(f.driver.observe).toHaveBeenCalledTimes(2);
  expect(f.states.at(-1)?.phase).toBe("completed");
});
const options = {
  runId: "test",
  request: {
    goal: "Write a checklist",
    target: { id: "w-1", app: "notepad.exe", title: "Test editor" },
  },
  config: { ...defaultConfig, maxSteps: 5 },
};
const write: Action = {
  kind: "set-value",
  ref: "@fresh:e1",
  text: "checklist",
  reason: "Writing checklist",
};
function fixture(actions: Action[] = [write]) {
  const states: TaskState[] = [];
  const driver: DesktopDriver = {
    status: vi.fn().mockResolvedValue({}),
    observe: vi
      .fn()
      .mockResolvedValue({ text: "checklist", refs: new Set(["@fresh:e1"]) }),
    execute: vi.fn().mockResolvedValue({
      ok: true,
      delivery: "delivered_unverified",
      safeRetry: false,
    }),
  };
  let index = 0;
  const model: ModelProvider = {
    next: vi.fn(async () => ({
      action: actions[Math.min(index++, actions.length - 1)] ?? write,
      tokens: 10,
    })),
  };
  return {
    states,
    driver,
    model,
    runner: new TaskRunner(
      driver,
      model,
      (s) => states.push(s),
      async () => true,
    ),
  };
}
it("bounds repeated actions with no progress", async () => {
  const f = fixture();
  await f.runner.run(options, new AbortController().signal);
  expect(f.states.at(-1)?.phase).toBe("failed");
  expect(f.states.at(-1)?.message).toContain("Repeated");
  expect(f.driver.execute).toHaveBeenCalledTimes(1);
});
it("stops at the step limit", async () => {
  const f = fixture();
  await f.runner.run(
    { ...options, config: { ...options.config, maxSteps: 1 } },
    new AbortController().signal,
  );
  expect(f.states.at(-1)?.message).toContain("Step limit");
});
it("ignores a late model response after Stop", async () => {
  const f = fixture();
  const controller = new AbortController();
  f.model.next = vi.fn(async () => {
    controller.abort();
    return { action: write, tokens: 10 };
  });
  await f.runner.run(options, controller.signal);
  expect(f.driver.execute).not.toHaveBeenCalled();
  expect(f.states.at(-1)?.phase).toBe("cancelled");
});
it("does not observe or schedule actions after a late driver response", async () => {
  const f = fixture();
  const controller = new AbortController();
  f.driver.execute = vi.fn(async () => {
    controller.abort();
    return { ok: true, delivery: "delivered_unverified", safeRetry: false };
  });
  await f.runner.run(options, controller.signal);
  expect(f.driver.observe).toHaveBeenCalledTimes(1);
  expect(f.model.next).toHaveBeenCalledTimes(1);
  expect(f.states.at(-1)?.message).toContain("may have happened");
});
it("refreshes safely refused stale refs", async () => {
  const f = fixture([write, { kind: "complete", evidence: "checklist" }]);
  f.driver.execute = vi.fn().mockResolvedValue({
    ok: false,
    code: "STALE_REF",
    delivery: "not_delivered",
    safeRetry: true,
  });
  await f.runner.run(options, new AbortController().signal);
  expect(f.driver.observe).toHaveBeenCalledTimes(2);
  expect(f.states.at(-1)?.phase).toBe("completed");
});
it("reobserves uncertain delivery without retry", async () => {
  const f = fixture();
  f.driver.execute = vi.fn().mockResolvedValue({
    ok: false,
    code: "TIMEOUT",
    delivery: "unknown",
    safeRetry: false,
  });
  await f.runner.run(options, new AbortController().signal);
  expect(f.driver.observe).toHaveBeenCalledTimes(2);
  expect(f.driver.execute).toHaveBeenCalledTimes(1);
  expect(f.states.at(-1)?.phase).toBe("failed");
});
it("rejects unsupported completion evidence", async () => {
  const f = fixture([{ kind: "complete", evidence: "not in snapshot" }]);
  await f.runner.run(options, new AbortController().signal);
  expect(f.states.at(-1)?.phase).toBe("failed");
});
it("cancels approval without dispatch", async () => {
  const f = fixture([{ kind: "click", ref: "@fresh:e1", reason: "Open menu" }]);
  const controller = new AbortController();
  const runner = new TaskRunner(
    f.driver,
    f.model,
    (s) => f.states.push(s),
    async () => {
      controller.abort();
      return true;
    },
  );
  await runner.run(options, controller.signal);
  expect(f.driver.execute).not.toHaveBeenCalled();
  expect(f.states.at(-1)?.phase).toBe("cancelled");
});
it("opens a model-selected installed app before obtaining its first UI observation", async () => {
  const f = fixture([
    { kind: "launch-app", appId: "app-0", reason: "Open the editor" },
    { kind: "complete", evidence: "checklist" },
  ]);
  const applications: TaskApplicationLauncher = {
    apps: [{ id: "app-0", name: "Editor" }],
    open: vi.fn().mockResolvedValue(options.request.target),
  };
  const approve = vi.fn().mockResolvedValue(true);
  const runner = new TaskRunner(
    f.driver,
    f.model,
    (s) => f.states.push(s),
    approve,
    applications,
  );
  await runner.run(
    { ...options, request: { goal: "Open Editor" } },
    new AbortController().signal,
  );
  expect(applications.open).toHaveBeenCalledExactlyOnceWith(
    "app-0",
    expect.any(AbortSignal),
  );
  expect(approve).toHaveBeenCalled();
  expect(f.driver.observe).toHaveBeenCalledExactlyOnceWith(
    options.request.target,
    expect.any(AbortSignal),
  );
  expect(f.states.at(-1)?.phase).toBe("completed");
});
it("does not launch when application approval is declined", async () => {
  const f = fixture([{ kind: "launch-app", appId: "app-0", reason: "Open" }]);
  const applications: TaskApplicationLauncher = {
    apps: [{ id: "app-0", name: "Editor" }],
    open: vi.fn(),
  };
  const runner = new TaskRunner(
    f.driver,
    f.model,
    (s) => f.states.push(s),
    async () => false,
    applications,
  );
  await runner.run(
    { ...options, request: { goal: "Open" } },
    new AbortController().signal,
  );
  expect(applications.open).not.toHaveBeenCalled();
  expect(f.driver.observe).not.toHaveBeenCalled();
  expect(f.states.at(-1)?.phase).toBe("failed");
});
it("rejects a model launch outside its discovered catalogue", async () => {
  const f = fixture([{ kind: "launch-app", appId: "app-999", reason: "Open" }]);
  const applications: TaskApplicationLauncher = {
    apps: [{ id: "app-0", name: "Editor" }],
    open: vi.fn(),
  };
  const runner = new TaskRunner(
    f.driver,
    f.model,
    (s) => f.states.push(s),
    async () => true,
    applications,
  );
  await runner.run(
    { ...options, request: { goal: "Open" } },
    new AbortController().signal,
  );
  expect(applications.open).not.toHaveBeenCalled();
  expect(f.states.at(-1)?.message).toContain("outside");
});
it("ignores a late app-launch reply after Stop", async () => {
  const f = fixture([{ kind: "launch-app", appId: "app-0", reason: "Open" }]);
  const controller = new AbortController();
  const applications: TaskApplicationLauncher = {
    apps: [{ id: "app-0", name: "Editor" }],
    open: vi.fn(async () => {
      controller.abort();
      return options.request.target;
    }),
  };
  const runner = new TaskRunner(
    f.driver,
    f.model,
    (s) => f.states.push(s),
    async () => true,
    applications,
  );
  await runner.run(
    { ...options, request: { goal: "Open" } },
    controller.signal,
  );
  expect(f.driver.observe).not.toHaveBeenCalled();
  expect(f.states.at(-1)?.phase).toBe("cancelled");
  expect(f.states.at(-1)?.message).toContain("may have happened");
});
it("does not allow UI actions before an app has been selected", async () => {
  const f = fixture();
  await f.runner.run(
    { ...options, request: { goal: "Write" } },
    new AbortController().signal,
  );
  expect(f.driver.execute).not.toHaveBeenCalled();
  expect(f.states.at(-1)?.message).toContain("Open an application");
});

it("recovers once from paraphrased completion with fresh read-only observation", async () => {
  const f = fixture([
    { kind: "complete", evidence: "The checklist is ready" },
    { kind: "complete", evidence: "checklist" },
  ]);
  await f.runner.run(options, new AbortController().signal);
  expect(f.driver.observe).toHaveBeenCalledTimes(2);
  expect(f.driver.execute).not.toHaveBeenCalled();
  expect(f.states.at(-1)?.phase).toBe("completed");
});
it("never dispatches another desktop action while correcting completion", async () => {
  const f = fixture([
    { kind: "complete", evidence: "The checklist is ready" },
    write,
  ]);
  await f.runner.run(options, new AbortController().signal);
  expect(f.driver.execute).not.toHaveBeenCalled();
  expect(f.states.at(-1)?.phase).toBe("failed");
  expect(f.states.at(-1)?.message).toContain("No additional desktop actions");
});
it("bounds completion correction without accepting repeated fabricated evidence", async () => {
  const f = fixture([
    { kind: "complete", evidence: "made up" },
    { kind: "complete", evidence: "made up" },
  ]);
  await f.runner.run(options, new AbortController().signal);
  expect(f.model.next).toHaveBeenCalledTimes(2);
  expect(f.driver.execute).not.toHaveBeenCalled();
  expect(f.states.at(-1)?.phase).toBe("failed");
  expect(f.states.at(-1)?.message).toContain("Completion evidence is absent");
});
it("cancels verification correction before another model request", async () => {
  const f = fixture([{ kind: "complete", evidence: "made up" }]);
  const controller = new AbortController();
  vi.mocked(f.driver.observe)
    .mockImplementationOnce(async () => ({
      text: "checklist",
      refs: new Set(),
    }))
    .mockImplementationOnce(async () => {
      controller.abort();
      return { text: "checklist", refs: new Set() };
    });
  await f.runner.run(options, controller.signal);
  expect(f.model.next).toHaveBeenCalledOnce();
  expect(f.driver.execute).not.toHaveBeenCalled();
  expect(f.states.at(-1)?.phase).toBe("cancelled");
});
