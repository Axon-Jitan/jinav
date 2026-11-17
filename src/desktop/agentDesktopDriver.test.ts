// Verifies protocol mappings against the pinned CLI's actual snapshot envelope shape.
import { afterEach, expect, it, vi } from "vitest";
import { cliProcess } from "./cliProcess";
import { AgentDesktopDriver } from "./agentDesktopDriver";
vi.mock("./cliProcess", () => ({ cliProcess: vi.fn() }));
afterEach(() => vi.resetAllMocks());
it("uses a focus-only headed command for the approved app window", async () => {
  vi.mocked(cliProcess).mockResolvedValue({
    version: "2.6",
    ok: true,
    data: {},
  });
  const driver = new AgentDesktopDriver("driver", "session");
  await driver.focusWindow(
    { id: "w-55", app: "CalculatorApp.exe" },
    new AbortController().signal,
  );
  expect(cliProcess).toHaveBeenCalledWith(
    "driver",
    [
      "focus-window",
      "--window-id",
      "w-55",
      "--app",
      "CalculatorApp.exe",
      "--headed",
      "--session",
      "session",
    ],
    expect.any(AbortSignal),
    undefined,
  );
});
it("reads hosted app identity from list-windows rather than the frame process", async () => {
  vi.mocked(cliProcess).mockResolvedValue({
    version: "2.6",
    ok: true,
    data: [
      {
        id: "w-55",
        app_name: "CalculatorApp.exe",
        title: "Calculator",
        is_focused: true,
      },
    ],
  });
  const driver = new AgentDesktopDriver("driver", "session");
  expect(
    await driver.listWindows("calculatorapp.exe", new AbortController().signal),
  ).toEqual([{ id: "w-55", app: "CalculatorApp.exe", title: "Calculator" }]);
  expect(cliProcess).toHaveBeenCalledWith(
    "driver",
    ["list-windows", "--app", "calculatorapp.exe", "--session", "session"],
    expect.any(AbortSignal),
    undefined,
  );
});
const target = { id: "w-1", app: "notepad.exe", title: "Disposable editor" };
it("extracts ref_id and refuses incomplete or foreign snapshots", async () => {
  vi.mocked(cliProcess).mockResolvedValue({
    version: "2.6",
    ok: true,
    data: {
      complete: true,
      app: "Notepad.exe",
      window: { id: "w-1" },
      tree: { children: [{ ref_id: "@fresh:e1", role: "textfield" }] },
    },
  });
  const driver = new AgentDesktopDriver("driver", "session");
  const observation = await driver.observe(
    target,
    new AbortController().signal,
  );
  expect(observation.refs.has("@fresh:e1")).toBe(true);
  expect(cliProcess).toHaveBeenCalledWith(
    "driver",
    [
      "snapshot",
      "--app",
      "notepad.exe",
      "--window-id",
      "w-1",
      "--timeout-ms",
      "8000",
      "--session",
      "session",
    ],
    expect.any(AbortSignal),
    undefined,
  );
  vi.mocked(cliProcess).mockResolvedValue({
    version: "2.6",
    ok: true,
    data: { complete: true, app: "Notepad.exe", window: { id: "w-2" } },
  });
  await expect(
    driver.observe(target, new AbortController().signal),
  ).rejects.toThrow("scope");
});
it("passes Unicode text via stdin without a shell argument", async () => {
  vi.mocked(cliProcess).mockResolvedValue({
    version: "2.6",
    ok: true,
    data: { disposition: { delivery: "delivered_verified", retry: "unsafe" } },
  });
  const driver = new AgentDesktopDriver("driver path", "session");
  await driver.execute(
    {
      kind: "set-value",
      ref: "@fresh:e1",
      text: "héllo 世界",
      reason: "Write checklist",
    },
    target,
    false,
    new AbortController().signal,
  );
  expect(cliProcess).toHaveBeenCalledWith(
    "driver path",
    ["set-value", "@fresh:e1", "--stdin", "--session", "session"],
    expect.any(AbortSignal),
    "héllo 世界",
  );
});
it("parses safe refusal dispositions", async () => {
  vi.mocked(cliProcess).mockResolvedValue({
    version: "2.6",
    ok: false,
    error: {
      code: "STALE_REF",
      disposition: { delivery: "not_delivered", retry: "safe" },
    },
  });
  const driver = new AgentDesktopDriver("driver", "session");
  expect(
    await driver.execute(
      { kind: "click", ref: "@old:e1", reason: "Open" },
      target,
      false,
      new AbortController().signal,
    ),
  ).toEqual({
    ok: false,
    code: "STALE_REF",
    delivery: "not_delivered",
    safeRetry: true,
  });
});
