// Verifies host isolation across late replies and cancellation acknowledgement races.
import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import { utilityProcess, type UtilityProcess } from "electron";
import { TaskHost } from "./taskHost";
import { TaskCache } from "./taskCache";
import { defaultConfig } from "../shared/config";
vi.mock("electron", () => ({ utilityProcess: { fork: vi.fn() } }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function fixture() {
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
    );
  return { host, worker, start, cache };
}
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
