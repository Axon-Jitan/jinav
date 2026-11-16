// Verifies subprocess cancellation and Unicode framing without desktop access.
import { expect, it } from "vitest";
import { cliProcess } from "./cliProcess";
it("decodes Unicode split over process writes", async () => {
  const value = await cliProcess(
    process.execPath,
    [
      "-e",
      "const b=Buffer.from(JSON.stringify({text:'héllo 世界'}));process.stdout.write(b.subarray(0,11));setTimeout(()=>process.stdout.write(b.subarray(11)),10)",
    ],
    new AbortController().signal,
  );
  expect(value).toEqual({ text: "héllo 世界" });
});
it("kills a stalled subprocess after cancellation", async () => {
  const controller = new AbortController();
  const pending = cliProcess(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    controller.signal,
  );
  controller.abort();
  await expect(pending).rejects.toThrow("Cancelled");
});
it("rejects diagnostics mixed into JSON", async () => {
  await expect(
    cliProcess(
      process.execPath,
      ["-e", "process.stdout.write('diagnostic\\n{}')"],
      new AbortController().signal,
    ),
  ).rejects.toThrow("invalid JSON");
});
