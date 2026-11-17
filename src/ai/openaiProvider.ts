// Implements stateless, cancellable OpenAI Responses function-call decisions.
import { z } from "zod";
import { actionSchema } from "../shared/task";
import type { ModelProvider } from "./modelProvider";
import { readBoundedResponse } from "./readBoundedResponse";
import { openaiTool } from "./openaiTool";
import { desktopInstructions } from "./desktopInstructions";
const responseSchema = z.object({
  status: z.literal("completed"),
  output: z
    .array(
      z
        .object({
          type: z.string(),
          id: z.string().optional(),
          call_id: z.string().optional(),
          name: z.string().optional(),
          arguments: z.string().max(128000).optional(),
        })
        .passthrough(),
    )
    .max(30),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
});
export class OpenAIProvider implements ModelProvider {
  constructor(
    private readonly endpoint: string,
    private readonly model: string,
    private readonly key: string,
  ) {}
  async next(
    goal: string,
    observation: string,
    history: readonly string[],
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    const response = await fetch(this.endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.key}`,
      },
      body: JSON.stringify({
        model: this.model,
        store: false,
        instructions: desktopInstructions,
        input: [
          {
            role: "user",
            content: JSON.stringify({
              goal,
              previousVerifiedSteps: history,
              UI_CONTENT: observation,
            }),
          },
        ],
        tools: [openaiTool],
        tool_choice: { type: "function", name: "desktop_action" },
        parallel_tool_calls: false,
        max_output_tokens: 1500,
      }),
    });
    signal.throwIfAborted();
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: "Authentication failed. Contact your IT team.",
        403: "Model access denied. Contact your IT team.",
        429: "OpenAI quota or rate limit reached. Contact your IT team.",
      };
      throw Error(
        messages[response.status] ??
          `OpenAI request failed (HTTP ${response.status}). Contact your IT team.`,
      );
    }
    const result = responseSchema.parse(
      JSON.parse(await readBoundedResponse(response)),
    );
    signal.throwIfAborted();
    const calls = result.output.filter((item) => item.type === "function_call"),
      call = calls[0];
    if (
      calls.length !== 1 ||
      !call?.id ||
      !call.call_id ||
      call.name !== "desktop_action" ||
      !call.arguments
    )
      throw Error(
        "OpenAI did not return exactly one valid desktop function call.",
      );
    const { action } = z
      .object({ action: z.unknown() })
      .strict()
      .parse(JSON.parse(call.arguments));
    // Strict tools encode the optional completion text as null, not an omitted field.
    const normalized =
      action &&
      typeof action === "object" &&
      "kind" in action &&
      action.kind === "complete" &&
      "expectedText" in action &&
      action.expectedText === null
        ? { ...action, expectedText: undefined }
        : action;
    // Each next() is a fresh one-step decision; no dangling tool-call turn is replayed.
    return {
      action: actionSchema.parse(normalized),
      tokens: result.usage.input_tokens + result.usage.output_tokens,
    };
  }
}
