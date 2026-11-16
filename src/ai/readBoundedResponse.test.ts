// Verifies provider bodies cannot exceed their configured bound.
import { expect, it } from "vitest";
import { readBoundedResponse } from "./readBoundedResponse";
it("rejects oversized streamed content", async () => {
  await expect(
    readBoundedResponse(new Response("x".repeat(100)), 50),
  ).rejects.toThrow("size limit");
});
it("retains multibyte text", async () => {
  expect(await readBoundedResponse(new Response("héllo 世界"))).toBe(
    "héllo 世界",
  );
});
