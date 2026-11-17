// Verifies repeated shortcut behavior independently of Electron windows.
import { expect, it } from "vitest";
import { shortcutClosesMenu } from "./shortcutBehavior";
it("only closes the inactive menu in toggle mode", () => {
  expect(shortcutClosesMenu("toggle", true, "menu")).toBe(true);
  expect(shortcutClosesMenu("open", true, "menu")).toBe(false);
  expect(shortcutClosesMenu("toggle", false, "menu")).toBe(false);
  expect(shortcutClosesMenu("toggle", true, "progress")).toBe(false);
});
