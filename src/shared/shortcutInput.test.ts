// Verifies typed shortcuts and recorded key combinations share one contract.
import { expect, it } from "vitest";
import { shortcutInput, shortcutFromKey } from "./shortcutInput";
it("normalizes typed modifiers, ordering and supported keys", () => {
  expect(shortcutInput(" alt + control + j ")).toBe("Ctrl+Alt+J");
  expect(shortcutInput("Option+Shift+space")).toBe("Alt+Shift+Space");
  expect(shortcutInput("Win+F12")).toBe("Super+F12");
  expect(shortcutInput("Ctrl+ArrowLeft")).toBe("Ctrl+Left");
  expect(shortcutInput("Ctrl+Plus")).toBe("Ctrl+Plus");
});
it("rejects incomplete or unsupported shortcuts", () => {
  for (const value of [
    "",
    "J",
    "Ctrl",
    "Ctrl+",
    "Ctrl+Control+J",
    "Ctrl+F25",
    "Unknown+J",
  ])
    expect(shortcutInput(value)).toBeUndefined();
});
it("records modified keys without treating modifiers, navigation or repeats as a candidate", () => {
  const event = {
    key: " ",
    code: "Space",
    ctrlKey: false,
    altKey: true,
    shiftKey: true,
    metaKey: false,
    repeat: false,
  };
  expect(shortcutFromKey(event)).toBe("Alt+Shift+Space");
  expect(shortcutFromKey({ ...event, repeat: true })).toBeUndefined();
  expect(shortcutFromKey({ ...event, key: "Shift" })).toBeUndefined();
  expect(shortcutFromKey({ ...event, key: "Tab" })).toBeUndefined();
  expect(
    shortcutFromKey({ ...event, altKey: false, shiftKey: false }),
  ).toBeUndefined();
});
