// Adapts the action union to OpenAI's strict nested function schema.
import { z } from "zod";
import { actionSchema } from "../shared/task";
function strict(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strict);
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source))
    if (key !== "$schema")
      result[key === "oneOf" ? "anyOf" : key] = strict(child);
  if (
    source.type === "object" &&
    source.properties &&
    typeof source.properties === "object"
  ) {
    const required = Array.isArray(source.required) ? source.required : [];
    result.properties = Object.fromEntries(
      Object.entries(source.properties).map(([name, property]) => [
        name,
        required.includes(name)
          ? strict(property)
          : { anyOf: [strict(property), { type: "null" }] },
      ]),
    );
    result.required = Object.keys(source.properties);
    result.additionalProperties = false;
  }
  return result;
}
export const openaiTool = {
  type: "function",
  name: "desktop_action",
  description:
    "Choose one bounded desktop action. Completion evidence must be an exact quote from the fresh observation; expectedText must be the entire GUI-saved file when verification is requested.",
  strict: true,
  parameters: {
    type: "object",
    properties: { action: strict(z.toJSONSchema(actionSchema)) },
    required: ["action"],
    additionalProperties: false,
  },
};
