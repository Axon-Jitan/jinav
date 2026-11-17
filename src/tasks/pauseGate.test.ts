// Verifies interruption gates stop queued work and cancellation releases waits.
import { expect, it, vi } from "vitest";
import { PauseGate } from "./pauseGate";
it("holds dispatch until resume and increments the observation generation", async () => {
  const gate = new PauseGate(),
    signal = new AbortController().signal,
    dispatch = vi.fn();
  gate.set(true);
  const waiting = gate.wait(signal).then(dispatch);
  await Promise.resolve();
  expect(dispatch).not.toHaveBeenCalled();
  const before = gate.generation;
  gate.set(false);
  await waiting;
  expect(dispatch).toHaveBeenCalledOnce();
  expect(gate.generation).toBeGreaterThan(before);
});
it("cancels while paused without dispatching queued work", async () => {
  const gate = new PauseGate(),
    controller = new AbortController(),
    dispatch = vi.fn();
  gate.set(true);
  const waiting = gate.wait(controller.signal).then(dispatch);
  const rejection = expect(waiting).rejects.toThrow();
  controller.abort();
  await rejection;
  gate.set(false);
  expect(dispatch).not.toHaveBeenCalled();
});
