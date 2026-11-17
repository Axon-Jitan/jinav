// Verifies strict Responses tool parsing, usage accounting and cancellation boundaries.
import { afterEach, expect, it, vi } from "vitest";
import { OpenAIProvider } from "./openaiProvider";
import { openaiTool } from "./openaiTool";
afterEach(() => vi.unstubAllGlobals());
const provider = new OpenAIProvider(
  "https://api.openai.com/v1/responses",
  "test-model",
  "synthetic-test-key",
);
const call = {
  type: "function_call",
  id: "fc-1",
  call_id: "call-1",
  name: "desktop_action",
  arguments: JSON.stringify({
    action: { kind: "request-input", question: "Choose an editor" },
  }),
};
const response = (output: unknown[] = [call]) =>
  new Response(
    JSON.stringify({
      status: "completed",
      output,
      usage: { input_tokens: 30, output_tokens: 5 },
    }),
  );
it("uses the correct API with no server storage and one strict function call", async () => {
  const fetcher = vi.fn().mockResolvedValue(response());
  vi.stubGlobal("fetch", fetcher);
  const result = await provider.next(
    "Test",
    "No UI",
    [],
    new AbortController().signal,
  );
  expect(result.action.kind).toBe("request-input");
  expect(result.tokens).toBe(35);
  const options = fetcher.mock.calls[0]?.[1];
  const body = JSON.parse(options.body);
  expect(options.headers.Authorization).toBe("Bearer synthetic-test-key");
  expect(options.redirect).toBe("error");
  expect(body.store).toBe(false);
  expect(body.parallel_tool_calls).toBe(false);
  expect(body.tools[0].strict).toBe(true);
  expect(body.tools[0].parameters.type).toBe("object");
  expect(body.previous_response_id).toBeUndefined();
});
it("represents optional completion text as required nullable data", () => {
  const text = JSON.stringify(openaiTool.parameters);
  expect(text).not.toContain('"oneOf"');
  expect(text).toContain('"type":"null"');
  expect(text).toContain('"expectedText"');
});
it("normalizes nullable completion text without weakening action validation", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        response([
          {
            ...call,
            arguments: JSON.stringify({
              action: {
                kind: "complete",
                evidence: "Saved",
                expectedText: null,
              },
            }),
          },
        ]),
      ),
  );
  expect(
    (await provider.next("Test", "Saved", [], new AbortController().signal))
      .action,
  ).toEqual({ kind: "complete", evidence: "Saved", expectedText: undefined });
});
it("rejects unknown tools, missing correlation IDs, parallel calls and invalid actions", async () => {
  for (const output of [
    [{ ...call, name: "shell" }],
    [{ ...call, call_id: undefined }],
    [call, call],
    [
      {
        ...call,
        arguments: JSON.stringify({
          action: { kind: "shell", command: "anything" },
        }),
      },
    ],
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(output)));
    await expect(
      provider.next("Test", "No UI", [], new AbortController().signal),
    ).rejects.toThrow();
  }
});
it("does not expose authentication response bodies or credentials", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("private-provider-detail", { status: 401 }),
      ),
  );
  await expect(
    provider.next("Test", "No UI", [], new AbortController().signal),
  ).rejects.toThrow("Authentication failed. Contact your IT team.");
});
it("rejects a late network response after cancellation", async () => {
  const controller = new AbortController();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      controller.abort();
      return response();
    }),
  );
  await expect(
    provider.next("Test", "No UI", [], controller.signal),
  ).rejects.toThrow();
});
