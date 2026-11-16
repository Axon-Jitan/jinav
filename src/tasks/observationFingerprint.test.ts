// Verifies new reference IDs cannot disguise an unchanged UI.
import { expect, it } from "vitest";
import { observationFingerprint } from "./observationFingerprint";
it("ignores snapshot ref churn but retains content changes", () => {
  const first = JSON.stringify({
    snapshot_id: "old",
    tree: { ref_id: "@old:e1", value: "same" },
  });
  const second = JSON.stringify({
    snapshot_id: "new",
    tree: { ref_id: "@new:e1", value: "same" },
  });
  expect(observationFingerprint(first)).toBe(observationFingerprint(second));
  expect(observationFingerprint(first)).not.toBe(
    observationFingerprint(second.replace("same", "changed")),
  );
});
