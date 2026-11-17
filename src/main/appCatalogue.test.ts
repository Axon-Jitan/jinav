// Verifies launch requests resolve existing windows without opening duplicates.
import { expect, it, vi } from "vitest";
import { AppCatalogue } from "./appCatalogue";
import type { PlatformAdapter } from "../platform/platformAdapter";
vi.mock("electron", () => ({ app: { getFileIcon: vi.fn() } }));
it("refreshes discovery on request so removed apps do not remain cached", async () => {
  const entry = { id: "old", name: "Removed app", path: "old.exe" };
  const adapter: PlatformAdapter = {
    label: "fake",
    isWayland: false,
    executableSuffix: ".exe",
    discover: vi.fn().mockResolvedValueOnce([entry]).mockResolvedValueOnce([]),
    windows: async () => [],
    launch: vi.fn(),
    focus: vi.fn(),
  };
  const catalogue = new AppCatalogue(adapter);
  expect(await catalogue.discover()).toEqual([entry]);
  expect(await catalogue.discover()).toEqual([entry]);
  expect(await catalogue.discover(true)).toEqual([]);
  expect(adapter.discover).toHaveBeenCalledTimes(2);
});
it("activates the first native MRU window rather than opening duplicates", async () => {
  const windows = [
    { id: "1", app: "editor.exe", title: "First" },
    { id: "2", app: "editor.exe", title: "Second" },
  ];
  const adapter: PlatformAdapter = {
    label: "fake",
    isWayland: false,
    executableSuffix: ".exe",
    discover: async () => [],
    windows: async () => windows,
    launch: vi.fn(),
    focus: vi.fn(),
  };
  const catalogue = new AppCatalogue(adapter);
  const entry = { id: "C:/editor.exe", name: "Editor", path: "C:/editor.exe" };
  expect(await catalogue.launch(entry)).toEqual([]);
  expect(adapter.focus).toHaveBeenCalledWith(windows[0]);
  expect(adapter.launch).not.toHaveBeenCalled();
  await catalogue.launch(entry, "2");
  expect(adapter.focus).toHaveBeenCalledWith(windows[1]);
  expect(adapter.launch).not.toHaveBeenCalled();
});
it("rejects a stale chooser selection instead of opening another window", async () => {
  const adapter: PlatformAdapter = {
    label: "fake",
    isWayland: false,
    executableSuffix: ".exe",
    discover: async () => [],
    windows: async () => [],
    launch: vi.fn(),
    focus: vi.fn(),
  };
  await expect(
    new AppCatalogue(adapter).launch(
      { id: "editor", name: "Editor", path: "C:/editor.exe" },
      "old",
    ),
  ).rejects.toThrow("no longer available");
  expect(adapter.launch).not.toHaveBeenCalled();
});
