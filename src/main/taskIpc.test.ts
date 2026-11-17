// Verifies pending task cancellation and native output-file authorization.
import { afterEach, expect, it, vi } from "vitest";
import { dialog } from "electron";
import { channels } from "../shared/bridge";
import { defaultConfig } from "../shared/config";
import { taskIpc } from "./taskIpc";
import { ConfigStore } from "./configStore";
import { SecretStore } from "./secretStore";
import { TaskHost } from "./taskHost";
import { TaskCache } from "./taskCache";
import { TaskApplications } from "./taskApplications";
import type { LauncherWindow } from "./launcherWindow";
import type { PlatformAdapter } from "../platform/platformAdapter";
import type { DesktopDriver } from "../desktop/desktopDriver";
vi.mock("electron", () => ({
  dialog: { showSaveDialog: vi.fn() },
  safeStorage: {},
  utilityProcess: {},
  globalShortcut: { register: vi.fn(() => true), unregister: vi.fn() },
}));
afterEach(() => vi.restoreAllMocks());
it("allows an installed target in all-app mode without a selected list", async () => {
  const f = fixture(true);
  f.store.config.appAccess = "all";
  f.store.config.allowedApps = [];
  vi.spyOn(f.platform, "discover").mockResolvedValue([
    { id: "editor", name: "Notepad", path: "C:/notepad.exe" },
  ]);
  await f.invoke(channels.startTask, { goal: "Use editor", target });
  expect(f.host.start).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ appAccess: "all", allowedApps: [] }),
    expect.anything(),
    expect.anything(),
    undefined,
    expect.any(String),
    expect.any(TaskApplications),
  );
});
it("rejects all-app mode without disclosure and targets missing from installed scope", async () => {
  const f = fixture(false);
  f.store.config.appAccess = "all";
  await expect(
    f.invoke(channels.startTask, { goal: "Test", target }),
  ).rejects.toThrow("Review All installed apps");
  f.store.config.appCatalogConsent = true;
  vi.spyOn(f.platform, "discover").mockResolvedValue([
    { id: "other", name: "Other", path: "C:/other.exe" },
  ]);
  await expect(
    f.invoke(channels.startTask, { goal: "Test", target }),
  ).rejects.toThrow("supported installed apps");
  expect(f.platform.windows).not.toHaveBeenCalled();
  expect(f.host.start).not.toHaveBeenCalled();
});
it("does not dispatch a task when all-app access is revoked during discovery", async () => {
  const f = fixture(true);
  f.store.config.appAccess = "all";
  vi.spyOn(f.platform, "discover").mockImplementation(async () => {
    f.store.config.appAccess = "selected";
    return [{ id: "notepad", name: "Notepad", path: "C:/notepad.exe" }];
  });
  await expect(f.invoke(channels.startTask, { goal: "Test" })).rejects.toThrow(
    "changed while preparing",
  );
  expect(f.host.start).not.toHaveBeenCalled();
});
it("bounds preflight and a paused pending start by the whole-task deadline", async () => {
  vi.useFakeTimers();
  try {
    const f = fixture(true);
    f.store.config.maxSeconds = 10;
    vi.spyOn(f.platform, "discover").mockImplementation(
      (signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(Error("Deadline")), {
            once: true,
          });
        }),
    );
    const starting = f.invoke(channels.startTask, {
      goal: "Open Calculator",
    }) as Promise<unknown>;
    const rejected = expect(starting).rejects.toThrow(
      "cancelled before desktop observation",
    );
    await vi.waitFor(() => expect(f.platform.discover).toHaveBeenCalled());
    f.stop.pause(true);
    expect(f.host.state.phase).toBe("paused");
    await vi.advanceTimersByTimeAsync(10000);
    await rejected;
    expect(f.host.start).not.toHaveBeenCalled();
    expect(f.host.state.message).toContain("time limit");
  } finally {
    vi.useRealTimers();
  }
});
it("cancels app discovery before a worker or launch can be dispatched", async () => {
  const f = fixture(true);
  const discover = vi.spyOn(f.platform, "discover").mockImplementation(
    (signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener(
          "abort",
          () => reject(Error("Cancelled discovery")),
          { once: true },
        );
      }),
  );
  const starting = f.invoke(channels.startTask, {
    goal: "Open Calculator",
  }) as Promise<unknown>;
  await vi.waitFor(() => expect(discover).toHaveBeenCalled());
  const failed = expect(starting).rejects.toThrow(
    "cancelled before desktop observation",
  );
  f.stop();
  await failed;
  expect(f.host.start).not.toHaveBeenCalled();
  expect(f.platform.launch).not.toHaveBeenCalled();
  expect(f.host.state.phase).toBe("cancelled");
});
const target = { id: "1", app: "notepad.exe", title: "Disposable editor" };
function fixture(appCatalogConsent = false) {
  const handlers = new Map<string, (value: unknown) => unknown>();
  const store = new ConfigStore("unused");
  store.inputMonitoring = true;
  store.modelConnected = true;
  store.config = {
    ...defaultConfig,
    aiEnabled: true,
    cloudConsent: true,
    appCatalogConsent,
    allowedApps: [
      { id: "notepad", name: "Notepad", path: "C:/notepad.exe" },
      { id: "calculator", name: "Calculator", path: "C:/CalculatorApp.exe" },
    ],
  };
  const secrets = new SecretStore("unused");
  vi.spyOn(secrets, "get").mockReturnValue("fake");
  const host = new TaskHost(() => {}, new TaskCache("unused"));
  vi.spyOn(host, "start").mockImplementation(() => {});
  const launcher = {
    show: vi.fn().mockResolvedValue(undefined),
    window: { setAlwaysOnTop: vi.fn(), webContents: { send: vi.fn() } },
  } as unknown as LauncherWindow;
  const platform: PlatformAdapter = {
    label: "fake",
    isWayland: false,
    executableSuffix: ".exe",
    discover: async () => [],
    windows: vi.fn().mockResolvedValue([target]),
    launch: vi.fn(),
    focus: vi.fn(),
  };
  const desktop = {
    status: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        permissions: {
          accessibility: { state: "granted" },
          automation: { state: "not_required" },
        },
      },
    }),
  } as unknown as DesktopDriver;
  const stop = taskIpc(
    (channel, handler) => handlers.set(channel, handler),
    store,
    secrets,
    host,
    launcher,
    platform,
    "driver",
    desktop,
  );
  const invoke = (channel: string, value?: unknown) => {
    const handler = handlers.get(channel);
    if (!handler) throw Error("Missing handler");
    return handler(value);
  };
  return { host, platform, invoke, stop, desktop, store };
}
it("rejects targets outside independently approved applications before observing", async () => {
  const f = fixture();
  f.store.config.allowedApps = [];
  await expect(
    f.invoke(channels.startTask, { goal: "Read this", target }),
  ).rejects.toThrow("Allowed apps");
  expect(f.platform.windows).not.toHaveBeenCalled();
  expect(f.host.start).not.toHaveBeenCalled();
});
it("refuses a task when interruption monitoring is required but unavailable", async () => {
  const f = fixture();
  f.store.inputMonitoring = false;
  await expect(
    f.invoke(channels.startTask, { goal: "Read this", target }),
  ).rejects.toThrow("monitoring is unavailable");
  expect(f.host.start).not.toHaveBeenCalled();
});
it("accepts a hosted application window using its driver identity without a duplicate prefix", async () => {
  const f = fixture();
  const target = { id: "w-55", app: "CalculatorApp.exe", title: "Calculator" };
  f.desktop.allWindows = vi.fn().mockResolvedValue([target]);
  vi.mocked(f.platform.windows).mockResolvedValue([{ ...target, id: "55" }]);
  await expect(f.invoke(channels.windows)).resolves.toEqual([
    { ...target, id: "55" },
  ]);
  vi.mocked(f.platform.windows).mockClear();
  await f.invoke(channels.startTask, { goal: "Use this window", target });
  expect(f.platform.windows).not.toHaveBeenCalled();
  expect(f.host.start).toHaveBeenCalledWith(
    { goal: "Use this window", target },
    expect.anything(),
    "fake",
    "driver",
    undefined,
    expect.any(String),
    expect.any(TaskApplications),
  );
});
it("normalizes the captured native window ID against fresh driver identities", async () => {
  const f = fixture();
  f.desktop.allWindows = vi
    .fn()
    .mockResolvedValue([
      { id: "w-1", app: "notepad.exe", title: "Disposable editor" },
    ]);
  await f.invoke(channels.startTask, { goal: "Use this window", target });
  expect(f.host.start).toHaveBeenCalledWith(
    expect.objectContaining({ target: expect.objectContaining({ id: "w-1" }) }),
    expect.anything(),
    "fake",
    "driver",
    undefined,
    expect.any(String),
    expect.anything(),
  );
});
it("invalidates a delayed start when Stop is requested during window validation", async () => {
  const f = fixture();
  let finish: ((windows: (typeof target)[]) => void) | undefined;
  vi.mocked(f.platform.windows).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const starting = f.invoke(channels.startTask, {
    goal: "Test",
    target,
  }) as Promise<unknown>;
  await vi.waitFor(() => expect(f.platform.windows).toHaveBeenCalled());
  f.stop();
  finish?.([target]);
  await expect(starting).rejects.toThrow("cancelled");
  expect(f.host.start).not.toHaveBeenCalled();
  expect(f.host.state.phase).toBe("cancelled");
});
it("refuses file verification without native picker authorization", async () => {
  const f = fixture();
  await expect(
    f.invoke(channels.startTask, {
      goal: "Test",
      target,
      verificationFile: "C:/private.txt",
    }),
  ).rejects.toThrow("native output picker");
  expect(f.host.start).not.toHaveBeenCalled();
});
it("does not reuse a previous prompt output file when it is absent from this request", async () => {
  const f = fixture();
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({
    canceled: false,
    filePath: "C:/test/selected.txt",
  });
  await f.invoke(channels.chooseVerificationFile);
  await f.invoke(channels.startTask, { goal: "Test", target });
  expect(f.host.start).toHaveBeenCalledWith(
    expect.objectContaining({ goal: "Test" }),
    expect.anything(),
    "fake",
    "driver",
    undefined,
    expect.any(String),
    expect.any(TaskApplications),
  );
});
it("requires consent before sending installed app names", async () => {
  const f = fixture();
  await expect(
    f.invoke(channels.startTask, { goal: "Open Notepad" }),
  ).rejects.toThrow("installed app names");
  expect(f.platform.windows).not.toHaveBeenCalled();
  expect(f.host.start).not.toHaveBeenCalled();
});
it("starts automatic app selection without requiring an existing window", async () => {
  const f = fixture(true);
  await f.invoke(channels.startTask, { goal: "Open Notepad" });
  expect(f.platform.windows).not.toHaveBeenCalled();
  expect(f.host.start).toHaveBeenCalledWith(
    { goal: "Open Notepad" },
    expect.anything(),
    "fake",
    "driver",
    undefined,
    expect.any(String),
    expect.any(TaskApplications),
  );
});
