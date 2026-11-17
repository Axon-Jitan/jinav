// Verifies host isolation across late replies and cancellation acknowledgement races.
import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import { utilityProcess, type UtilityProcess } from "electron";
import { TaskHost } from "./taskHost";
import { TaskCache } from "./taskCache";
import { defaultConfig } from "../shared/config";
import type { TaskApplicationLauncher } from "../shared/taskApplications";
import { randomUUID } from "node:crypto";
vi.mock("electron", () => ({ utilityProcess: { fork: vi.fn() } }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("stops a paused all-app task if access is narrowed before resume", () => {
  vi.useFakeTimers();
  const f = fixture();
  const config = {
    ...defaultConfig,
    aiEnabled: true,
    cloudConsent: true,
    appAccess: "all" as const,
    appCatalogConsent: true,
  };
  f.host.start({ goal: "Test" }, config, "fake", "driver");
  f.host.pause(true);
  expect(() =>
    f.host.pause(false, { ...config, appAccess: "selected" }),
  ).toThrow("Permissions changed");
  expect(f.host.state.phase).toBe("stopping");
  expect(f.worker.postMessage).toHaveBeenCalledWith({ kind: "stop" });
  vi.advanceTimersByTime(3000);
  expect(f.worker.kill).toHaveBeenCalled();
});
function fixture(applications?: TaskApplicationLauncher) {
  const worker = Object.assign(new EventEmitter(), {
    kill: vi.fn(),
    postMessage: vi.fn(),
    stdout: null,
    stderr: null,
  });
  vi.mocked(utilityProcess.fork).mockReturnValue(
    worker as unknown as UtilityProcess,
  );
  const cache = new TaskCache("test-cache");
  vi.spyOn(cache, "remove").mockResolvedValue();
  const host = new TaskHost(() => {}, cache);
  const start = () =>
    host.start(
      {
        goal: "Test",
        target: { id: "w-1", app: "notepad.exe", title: "Test" },
      },
      { ...defaultConfig, aiEnabled: true, cloudConsent: true },
      "fake",
      "driver",
      undefined,
      undefined,
      applications,
    );
  return { host, worker, start, cache };
}
it("restores approval context after pause and stops if permissions changed", () => {
  const f = fixture();
  f.start();
  f.host.pause(true);
  expect(f.host.state.phase).toBe("paused");
  f.host.pause(false, {
    ...defaultConfig,
    aiEnabled: true,
    cloudConsent: true,
  });
  expect(f.host.state.phase).toBe("planning");
  f.host.pause(true);
  expect(() =>
    f.host.pause(false, { ...defaultConfig, aiEnabled: false }),
  ).toThrow("Permissions changed");
  expect(f.host.state.phase).toBe("stopping");
  f.worker.emit("message", { kind: "done" });
});
it("keeps Stopping until an acknowledgement, ignoring a late completed response", () => {
  const f = fixture();
  f.start();
  f.host.stop();
  expect(f.host.state.phase).toBe("stopping");
  f.worker.emit("message", {
    kind: "state",
    state: {
      runId: f.host.state.runId,
      phase: "completed",
      message: "Late",
      step: 1,
    },
  });
  expect(f.host.state.phase).toBe("stopping");
  f.worker.emit("message", { kind: "done" });
  expect(f.host.state.phase).toBe("cancelled");
  expect(f.host.active).toBe(false);
  expect(f.worker.kill).toHaveBeenCalled();
});
it("terminates an unresponsive worker without accepting future replies", () => {
  vi.useFakeTimers();
  const f = fixture();
  f.start();
  f.host.stop();
  vi.advanceTimersByTime(3000);
  expect(f.host.state.phase).toBe("cancelled");
  f.worker.emit("message", {
    kind: "state",
    state: {
      runId: f.host.state.runId,
      phase: "running",
      message: "Late",
      step: 1,
    },
  });
  expect(f.host.state.phase).toBe("cancelled");
});
it("refuses concurrent tasks and foreign run IDs", () => {
  const f = fixture();
  f.start();
  expect(() => f.start()).toThrow("already running");
  f.worker.emit("message", {
    kind: "state",
    state: {
      runId: "different",
      phase: "completed",
      message: "Wrong run",
      step: 1,
    },
  });
  expect(f.host.state.phase).toBe("planning");
  f.worker.emit("message", { kind: "done" });
});
it("rejects a worker app request that has no corresponding user approval", () => {
  const applications: TaskApplicationLauncher = {
    apps: [{ id: "app-0", name: "Editor" }],
    open: vi.fn(),
  };
  const f = fixture(applications);
  f.start();
  f.worker.emit("message", {
    kind: "launch-app",
    runId: f.host.state.runId,
    requestId: randomUUID(),
    appId: "app-0",
  });
  expect(applications.open).not.toHaveBeenCalled();
  expect(f.worker.postMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({ kind: "app-launch-result", ok: false }),
  );
  f.worker.emit("message", { kind: "done" });
});
it("consumes one exact app approval and ignores a late launch reply after Stop", async () => {
  let finish:
    ((target: { id: string; app: string; title: string }) => void) | undefined;
  const applications: TaskApplicationLauncher = {
    apps: [{ id: "app-0", name: "Editor" }],
    open: vi.fn(
      () =>
        new Promise<{ id: string; app: string; title: string }>((resolve) => {
          finish = resolve;
        }),
    ),
  };
  const f = fixture(applications);
  f.start();
  f.host.state = {
    ...f.host.state,
    phase: "waiting_for_approval",
    approval: JSON.stringify({ appId: "app-0", action: "Open application" }),
  };
  f.host.approve(true);
  f.worker.emit("message", {
    kind: "launch-app",
    runId: f.host.state.runId,
    requestId: randomUUID(),
    appId: "app-0",
  });
  expect(applications.open).toHaveBeenCalledTimes(1);
  f.host.stop();
  finish?.({ id: "w-1", app: "editor.exe", title: "Editor" });
  await Promise.resolve();
  expect(
    f.worker.postMessage.mock.calls.some(
      ([message]) =>
        message.kind === "app-launch-result" && message.ok === true,
    ),
  ).toBe(false);
  f.worker.emit("message", { kind: "done" });
});
