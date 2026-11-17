// Verifies cancellation and run identity at the worker's app-launch boundary.
import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { WorkerApplications } from "./workerApplications";
it("resolves only a matching host reply", async () => {
  const runId = randomUUID();
  const send = vi.fn();
  const apps = new WorkerApplications(
    [{ id: "app-0", name: "Editor" }],
    runId,
    send,
  );
  const pending = apps.open("app-0", new AbortController().signal);
  const request = send.mock.calls[0]?.[0] as { requestId: string };
  expect(
    apps.receive({
      kind: "app-launch-result",
      runId: randomUUID(),
      requestId: request.requestId,
      ok: true,
      target: { id: "w-1", app: "editor.exe", title: "Editor" },
    }),
  ).toBe(false);
  apps.receive({
    kind: "app-launch-result",
    runId,
    requestId: request.requestId,
    ok: true,
    target: { id: "w-1", app: "editor.exe", title: "Editor" },
  });
  await expect(pending).resolves.toEqual({
    id: "w-1",
    app: "editor.exe",
    title: "Editor",
  });
});
it("drops cancelled requests and their late replies", async () => {
  const runId = randomUUID();
  const send = vi.fn();
  const apps = new WorkerApplications(
    [{ id: "app-0", name: "Editor" }],
    runId,
    send,
  );
  const controller = new AbortController();
  const pending = apps.open("app-0", controller.signal);
  const rejected = expect(pending).rejects.toThrow("cancelled");
  controller.abort();
  await rejected;
  const request = send.mock.calls[0]?.[0] as { requestId: string };
  expect(
    apps.receive({
      kind: "app-launch-result",
      runId,
      requestId: request.requestId,
      ok: true,
      target: { id: "w-1", app: "editor.exe", title: "Editor" },
    }),
  ).toBe(true);
  expect(send).toHaveBeenCalledTimes(1);
});
it("rejects arbitrary paths before sending any native request", () => {
  const send = vi.fn();
  const apps = new WorkerApplications(
    [{ id: "app-0", name: "Editor" }],
    randomUUID(),
    send,
  );
  expect(() =>
    apps.open("C:/unknown.exe", new AbortController().signal),
  ).toThrow("catalogue");
  expect(send).not.toHaveBeenCalled();
});
