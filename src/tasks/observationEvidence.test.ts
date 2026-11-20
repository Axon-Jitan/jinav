// Verifies exact quoted UI text survives JSON escaping while fabricated evidence fails.
import { expect, it } from "vitest";
import { observationEvidence } from "./observationEvidence";
it("matches decoded quotes and newlines from actual snapshot text", () => {
  const name = 'Meeting "checklist"\nReady';
  expect(
    observationEvidence(JSON.stringify({ children: [{ name }] }), name),
  ).toBe(true);
});
it("rejects paraphrases, whitespace, and quotes spanning different controls", () => {
  const snapshot = JSON.stringify({
    children: [{ name: "Calculator" }, { name: "Standard" }],
  });
  expect(observationEvidence(snapshot, "Calculator is open")).toBe(false);
  expect(observationEvidence(snapshot, "Calculator Standard")).toBe(false);
  expect(observationEvidence(snapshot, "  ")).toBe(false);
});
