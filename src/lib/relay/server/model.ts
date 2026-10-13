import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";
import { RelayError } from "@/lib/relay/errors";

/** The only place the model name lives (FR-24, FR-63). Non-thinking flash model. */
export const RELAY_MODEL_ID = "deepseek-flash";

/**
 * The provider defaults to thinking mode; Relay never streams reasoning, so it
 * is disabled explicitly on every call (FR-24, SPIKE B).
 */
export const relayProviderOptions = {
  deepseek: { thinking: { type: "disabled" } },
} as const;

/** Legacy env name is honoured here and nowhere else (FR-63). */
export function getRelayApiKey(): string | undefined {
  return process.env.RELAY_API_KEY || process.env.DEEPSEEK_API_KEY || undefined;
}

export function isRelayConfigured(): boolean {
  return getRelayApiKey() !== undefined;
}

/** Throws `RelayError("not_configured")` when no key is set. */
export function getRelayModel(modelId: string = RELAY_MODEL_ID): LanguageModel {
  const apiKey = getRelayApiKey();
  if (!apiKey) {
    throw new RelayError({ code: "not_configured" });
  }
  return createDeepSeek({ apiKey })(modelId);
}
