// Defines cancellable next-action model requests.
import type { Action } from "../shared/task";
export interface ModelProvider {
  next(
    goal: string,
    observation: string,
    history: readonly string[],
    signal: AbortSignal,
  ): Promise<{ action: Action; tokens: number }>;
}
