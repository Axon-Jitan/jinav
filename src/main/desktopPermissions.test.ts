// Verifies unknown or denied permissions fail closed before any observation.
import { expect, it } from "vitest";
import { desktopPermissions } from "./desktopPermissions";
it("accepts granted accessibility with no automation consent required", () => {
  expect(() =>
    desktopPermissions({
      ok: true,
      data: {
        permissions: {
          accessibility: { state: "granted" },
          automation: { state: "not_required" },
        },
      },
    }),
  ).not.toThrow();
});
it("rejects denied, missing and malformed status", () => {
  for (const value of [
    {},
    null,
    { ok: false },
    {
      ok: true,
      data: {
        permissions: {
          accessibility: { state: "denied" },
          automation: { state: "granted" },
        },
      },
    },
  ])
    expect(() => desktopPermissions(value)).toThrow("Desktop permissions");
});
