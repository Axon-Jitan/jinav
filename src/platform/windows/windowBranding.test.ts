// Verifies the shell receives an ICO relaunch source with the same application identity.
import { expect, it, vi } from "vitest";
import { windowsWindowBrand, WINDOWS_APP_ID } from "./windowBranding";
it("sets all required window-level relaunch properties", () => {
  const window = { setAppDetails: vi.fn() },
    details = {
      iconPath: "C:/jinav resources/icon.ico",
      relaunchCommand: '"C:/jinav/jinav.exe" "--settings"',
    };
  windowsWindowBrand(window, details);
  expect(window.setAppDetails).toHaveBeenCalledExactlyOnceWith({
    appId: WINDOWS_APP_ID,
    appIconPath: details.iconPath,
    appIconIndex: 0,
    relaunchCommand: details.relaunchCommand,
    relaunchDisplayName: "jinav",
  });
});
