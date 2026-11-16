// Verifies the provider's documented tool envelope against fake network responses.
import { afterEach, expect, it, vi } from "vitest";
import { AnthropicProvider } from "./anthropicProvider";
afterEach(() => vi.unstubAllGlobals());
const provider = new AnthropicProvider(
  "https://example.invalid/v1/messages",
  "test-model",
  "fake-key",
);
it("validates one tool call with an ID", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        content: [
          {
            type: "tool_use",
            id: "tool-1",
            name: "desktop_action",
            input: { kind: "request-input", question: "Select an editor" },
          },
        ],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  expect(
    (await provider.next("Test", "No UI", [], new AbortController().signal))
      .action.kind,
  ).toBe("request-input");
  const body = JSON.parse(fetcher.mock.calls[0]?.[1].body);
  expect(body.tools[0].input_schema.type).toBe("object");
  expect(body.messages[0].role).toBe("user");
});
it("reports authentication without echoing provider content", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("secret provider detail", { status: 401 }),
      ),
  );
  await expect(
    provider.next("Test", "No UI", [], new AbortController().signal),
  ).rejects.toThrow("Authentication failed");
});
it("rejects mismatched tool names", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [
            { type: "tool_use", id: "tool-1", name: "shell", input: {} },
          ],
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      ),
    ),
  );
  await expect(
    provider.next("Test", "No UI", [], new AbortController().signal),
  ).rejects.toThrow("valid tool call");
});
