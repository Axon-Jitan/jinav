// Verifies task launches use only known native entries with bounded window resolution.
import { afterEach, expect, it, vi } from "vitest";
import type { PlatformAdapter } from "../platform/platformAdapter";
import { TaskApplications } from "./taskApplications";
import type { DesktopDriver } from "../desktop/desktopDriver";
const entry = { id: "native-editor", name: "Editor", path: "C:/editor.exe" };
const window = { id: "12", app: "editor.exe", title: "Editor" };
function fixture() {
  const platform: PlatformAdapter = {
    label: "fake",
    isWayland: false,
    executableSuffix: ".exe",
    discover: vi.fn().mockResolvedValue([entry]),
    windows: vi.fn().mockResolvedValue([]),
    launch: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn().mockResolvedValue(undefined),
  };
  return { platform, apps: new TaskApplications(platform, [entry]) };
}
afterEach(() => vi.useRealTimers());
it("all-app discovery includes supported installed apps while selected mode remains a whitelist", async () => {
  const f = fixture();
  const second = {
    id: "second",
    name: "Calculator",
    path: "C:/calculator.exe",
  };
  vi.mocked(f.platform.discover).mockResolvedValue([
    entry,
    second,
    { id: "shell", name: "PowerShell", path: "C:/powershell.exe" },
  ]);
  const all = await TaskApplications.discover(
    f.platform,
    undefined,
    undefined,
    undefined,
  );
  expect(all.allowedEntries).toEqual([entry, second]);
  const selected = await TaskApplications.discover(
    f.platform,
    undefined,
    undefined,
    [entry],
  );
  expect(selected.allowedEntries).toEqual([entry]);
  await expect(
    all.open("app-99", new AbortController().signal),
  ).rejects.toThrow("catalogue");
  expect(f.platform.launch).not.toHaveBeenCalled();
});
it("focuses a hosted Store window without activating a duplicate instance", async () => {
  const f = fixture();
  const packaged = {
    id: "aumid:package!App",
    name: "Calculator",
    path: "C:/WindowsApps/CalculatorApp.exe",
  };
  const target = { id: "w-12", app: "CalculatorApp.exe", title: "Calculator" };
  const desktop = {
    listWindows: vi.fn().mockResolvedValue([target]),
    focusWindow: vi.fn().mockResolvedValue(undefined),
  } as unknown as DesktopDriver;
  const apps = new TaskApplications(f.platform, [packaged], desktop);
  expect(await apps.open("app-0", new AbortController().signal)).toEqual(
    target,
  );
  expect(desktop.focusWindow).toHaveBeenCalledExactlyOnceWith(
    target,
    expect.any(AbortSignal),
  );
  expect(f.platform.launch).not.toHaveBeenCalled();
});
it("resolves hosted Store app windows through the driver without doubling qualified IDs", async () => {
  const f = fixture();
  const packaged = {
    id: "aumid:package!App",
    name: "Calculator",
    path: "C:/WindowsApps/CalculatorApp.exe",
  };
  const target = { id: "w-12", app: "CalculatorApp.exe", title: "Calculator" };
  const desktop = {
    listWindows: vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([target]),
  } as unknown as DesktopDriver;
  const apps = new TaskApplications(f.platform, [packaged], desktop);
  expect(await apps.open("app-0", new AbortController().signal)).toEqual(
    target,
  );
  expect(f.platform.windows).not.toHaveBeenCalled();
  expect(f.platform.launch).toHaveBeenCalledExactlyOnceWith(
    packaged,
    expect.any(AbortSignal),
  );
});
it("verifies a new window after native launch", async () => {
  const f = fixture();
  vi.mocked(f.platform.windows)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([window]);
  expect(await f.apps.open("app-0", new AbortController().signal)).toEqual({
    ...window,
    id: "w-12",
  });
  expect(f.platform.launch).toHaveBeenCalledExactlyOnceWith(
    entry,
    expect.any(AbortSignal),
  );
});
it("focuses an existing window without launching a duplicate", async () => {
  const f = fixture();
  vi.mocked(f.platform.windows).mockResolvedValue([window]);
  await f.apps.open("app-0", new AbortController().signal);
  expect(f.platform.focus).toHaveBeenCalledExactlyOnceWith(
    window,
    expect.any(AbortSignal),
  );
  expect(f.platform.launch).not.toHaveBeenCalled();
});
it("refuses ambiguous windows instead of guessing", async () => {
  const f = fixture();
  vi.mocked(f.platform.windows).mockResolvedValue([
    window,
    { ...window, id: "13" },
  ]);
  await expect(
    f.apps.open("app-0", new AbortController().signal),
  ).rejects.toThrow("several windows");
  expect(f.platform.launch).not.toHaveBeenCalled();
  expect(f.platform.focus).not.toHaveBeenCalled();
});
it("rejects invented identifiers and paths", async () => {
  const f = fixture();
  await expect(
    f.apps.open("C:/evil.exe", new AbortController().signal),
  ).rejects.toThrow("catalogue");
  expect(f.platform.windows).not.toHaveBeenCalled();
  expect(f.platform.launch).not.toHaveBeenCalled();
});
it("does not dispatch launch after cancellation during inventory", async () => {
  const f = fixture();
  const controller = new AbortController();
  vi.mocked(f.platform.windows).mockImplementation(async () => {
    controller.abort();
    return [];
  });
  await expect(f.apps.open("app-0", controller.signal)).rejects.toThrow();
  expect(f.platform.launch).not.toHaveBeenCalled();
});
it("does not schedule observations after a cancelled dispatched launch", async () => {
  const f = fixture();
  const controller = new AbortController();
  vi.mocked(f.platform.launch).mockImplementation(async () => {
    controller.abort();
  });
  await expect(f.apps.open("app-0", controller.signal)).rejects.toThrow();
  expect(f.platform.windows).toHaveBeenCalledTimes(1);
});
it("bounds a launch that never exposes a window", async () => {
  vi.useFakeTimers();
  const f = fixture();
  const failure = expect(
    f.apps.open("app-0", new AbortController().signal),
  ).rejects.toThrow("no application window could be verified");
  await vi.advanceTimersByTimeAsync(16000);
  await failure;
  expect(f.platform.launch).toHaveBeenCalledTimes(1);
});
it("filters unsupported identities and duplicate paths before sending names to the model", async () => {
  const f = fixture();
  vi.mocked(f.platform.discover).mockResolvedValue([
    entry,
    { ...entry, id: "alias" },
    { id: "terminal", name: "Terminal", path: "C:/terminal.exe" },
    { id: "unknown", name: "Unknown store app", path: "" },
  ]);
  const apps = await TaskApplications.discover(f.platform);
  expect(apps.apps).toEqual([{ id: "app-0", name: "Editor" }]);
  expect(JSON.stringify(apps.apps)).not.toContain("C:/");
});
