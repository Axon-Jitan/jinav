// Verifies the tray receives the native icon asset and retains its entry points.
import { expect, it, vi } from "vitest";
import { trayIcon } from "./trayIcon";
const mocks = vi.hoisted(() => ({
  Tray: vi.fn(),
  setToolTip: vi.fn(),
  setContextMenu: vi.fn(),
  on: vi.fn(),
  image: { isEmpty: vi.fn(() => false) },
  menu: vi.fn((items: unknown) => items),
}));
vi.mock("electron", () => ({
  Tray: function (path: string) {
    mocks.Tray(path);
    return {
      setToolTip: mocks.setToolTip,
      setContextMenu: mocks.setContextMenu,
      on: mocks.on,
    };
  },
  Menu: { buildFromTemplate: mocks.menu },
  nativeImage: { createFromPath: () => mocks.image },
}));
vi.mock("./appIconPath", () => ({ appIconPath: () => "resources/icon.png" }));
it("passes the Windows ICO path without flattening it to a 16px image", () => {
  const open = vi.fn(),
    settings = vi.fn(),
    stop = vi.fn(),
    quit = vi.fn();
  trayIcon(open, settings, stop, quit, "C:/jinav resources/icon.ico");
  expect(mocks.Tray).toHaveBeenCalledWith("C:/jinav resources/icon.ico");
  expect(mocks.setToolTip).toHaveBeenCalledWith("jinav");
  expect(mocks.on).toHaveBeenCalledWith("click", open);
  expect(mocks.menu).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ label: "Settings", click: settings }),
      expect.objectContaining({ label: "Stop current task", click: stop }),
      expect.objectContaining({ label: "Quit", click: quit }),
    ]),
  );
});
it("reports missing native assets rather than silently using Electron", () => {
  mocks.image.isEmpty.mockReturnValueOnce(true);
  expect(() =>
    trayIcon(vi.fn(), vi.fn(), vi.fn(), vi.fn(), "missing.ico"),
  ).toThrow("Tray icon asset is missing");
});
