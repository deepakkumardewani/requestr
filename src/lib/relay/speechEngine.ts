import type { SpeechEngine } from "@/stores/useRelayStore";

export const SPEECH_ENGINE_OPTIONS: readonly SpeechEngine[] = [
  "browser",
  "grok",
];

export function isSpeechEngine(value: unknown): value is SpeechEngine {
  return (SPEECH_ENGINE_OPTIONS as readonly unknown[]).includes(value);
}

/**
 * The engine dictation actually uses. A stored "grok" falls back to the browser
 * while Grok is unavailable, without rewriting the stored preference.
 * `configured` is null while the server status is loading.
 */
export function getEffectiveSpeechEngine(
  stored: SpeechEngine,
  configured: boolean | null,
): SpeechEngine {
  return stored === "grok" && configured === true ? "grok" : "browser";
}
