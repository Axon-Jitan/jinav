// Guards the project-title false positive while retaining protected-window exclusions.
import { expect, it } from "vitest";
import { supportsTaskTarget } from "./supportsTaskTarget";
it("allows jinav and Electron document titles inside a supported editor", () => {
  expect(
    supportsTaskTarget({
      app: "Code.exe",
      title: "jinav-logo.svg - jinav - Visual Studio Code",
    }),
  ).toBe(true);
  expect(
    supportsTaskTarget({
      app: "notepad.exe",
      title: "Electron meeting notes.txt",
    }),
  ).toBe(true);
});
it.each([
  "jinav.exe",
  "electron.exe",
  "powershell.exe",
  "cmd.exe",
  "WindowsTerminal.exe",
  "LockApp.exe",
])("still excludes protected process %s", (app) => {
  expect(supportsTaskTarget({ app, title: "Untitled" })).toBe(false);
});
it.each(["Password Manager", "Windows Security", "PowerShell Terminal"])(
  "retains sensitive-title exclusion: %s",
  (title) => {
    expect(supportsTaskTarget({ app: "Code.exe", title })).toBe(false);
  },
);
