// Checks the bounded activation helper protocol without manipulating the desktop.
import { beforeEach, expect, it, vi } from "vitest";
import { focusWindow } from "./focusWindow";
const execute = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile: execute }));
const end = vi.fn();
beforeEach(() => {
  execute.mockReset();
  end.mockReset();
});
function respond(output: string) {
  execute.mockImplementation(
    (
      _file: string,
      _args: string[],
      _options: unknown,
      callback: (error: Error | null, stdout: string) => void,
    ) => {
      queueMicrotask(() => callback(null, output));
      return { stdin: { on: vi.fn(), end } };
    },
  );
}
it("passes a validated target over stdin with shell disabled and a finite timeout", async () => {
  respond('{"ok":true}');
  expect(await focusWindow("1234", "Editor ü.exe")).toBe(true);
  expect(JSON.parse(end.mock.calls[0]?.[0])).toEqual({
    id: "1234",
    app: "Editor ü.exe",
  });
  expect(execute.mock.calls[0]?.[2]).toMatchObject({
    shell: false,
    windowsHide: true,
    timeout: 8000,
    maxBuffer: 16384,
  });
});
it("rejects invalid or cancelled requests before starting a process", async () => {
  await expect(focusWindow("123; bad", "app.exe")).rejects.toThrow();
  await expect(
    focusWindow("123", "app.exe", AbortSignal.abort()),
  ).rejects.toThrow();
  expect(execute).not.toHaveBeenCalled();
});
it("does not fabricate success for a refused or malformed activation", async () => {
  respond('{"ok":false}');
  expect(await focusWindow("123", "app.exe")).toBe(false);
  respond('{"ok":"yes"}');
  await expect(focusWindow("123", "app.exe")).rejects.toThrow();
});
