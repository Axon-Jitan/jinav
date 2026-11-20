// Verifies malformed or unscoped model actions cannot reach a driver.
import { expect, it } from "vitest";
import { actionSchema } from "../shared/task";
import { actionPolicy } from "./actionPolicy";
const target = { id: "w-1", app: "notepad.exe", title: "Disposable editor" };
const observation = { text: "", refs: new Set(["@fresh:e1"]) };
it("accepts only opaque app IDs without launch arguments", () => {
  expect(
    actionSchema.safeParse({
      kind: "launch-app",
      appId: "C:/app.exe",
      reason: "Open",
    }).success,
  ).toBe(false);
  expect(
    actionSchema.safeParse({
      kind: "launch-app",
      appId: "app-0",
      reason: "Open",
      arguments: ["script"],
    }).success,
  ).toBe(false);
});
it("rejects arbitrary tools and extra arguments", () => {
  expect(
    actionSchema.safeParse({ kind: "shell", command: "anything" }).success,
  ).toBe(false);
  expect(
    actionSchema.safeParse({
      kind: "click",
      ref: "@fresh:e1",
      reason: "Open menu",
      shell: true,
    }).success,
  ).toBe(false);
});
it("rejects foreign and stale refs", () =>
  expect(() =>
    actionPolicy(
      { kind: "click", ref: "@old:e1", reason: "Open" },
      observation,
      target,
      false,
    ),
  ).toThrow("out-of-scope"));
it("rejects physical input without opt-in", () =>
  expect(() =>
    actionPolicy(
      { kind: "type", ref: "@fresh:e1", text: "test", reason: "Write" },
      observation,
      target,
      false,
    ),
  ).toThrow("Physical"));
it("requires confirmation for semantic clicks", () =>
  expect(
    actionPolicy(
      { kind: "click", ref: "@fresh:e1", reason: "Send" },
      observation,
      target,
      false,
    ).approval,
  ).toContain("Confirm"));
it("denies terminal scope", () =>
  expect(() =>
    actionPolicy(
      { kind: "set-value", ref: "@fresh:e1", text: "test", reason: "Write" },
      observation,
      { ...target, app: "powershell.exe" },
      true,
    ),
  ).toThrow("scope"));

it("allows a jinav-named document without bypassing text review", () => {
  const result = actionPolicy(
    {
      kind: "set-value",
      ref: "@fresh:e1",
      text: "Checklist",
      reason: "Write notes",
    },
    observation,
    {
      id: "w-2",
      app: "Code.exe",
      title: "jinav-logo.svg - jinav - Visual Studio Code",
    },
    false,
  );
  expect(result.approval).toContain("Review text entry");
});
