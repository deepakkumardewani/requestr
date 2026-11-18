import type { PromptSegment } from "@/components/relay/editorTypes";
import { isRelayEnabled } from "@/lib/relay/flag";
import { type RelayChip, useRelayStore } from "@/stores/useRelayStore";

/** Longest prompt an entry point may pre-fill; the composer holds a human sentence, not instructions. */
export const RELAY_PROMPT_MAX_CHARS = 80;

/** Markers of internal instruction text that must never reach the composer. */
const INTERNAL_PROMPT_MARKERS = ["IMPORTANT:", "Requirements:", "\n"] as const;

/** The short human prompt each "Open in Relay" entry point pre-fills; the single source of truth. */
export const RELAY_ENTRY_PROMPTS = {
  suggestHeaders: "Suggest missing headers for this request",
  generateBody: "Generate a body for this request",
  writeScript: "Write a script for this request",
  suggestAssertions: "Suggest assertions for this response",
  summarizeResponse: "Summarize this response",
  explainError: "Explain this error response",
  responseJsonpath: "Write a JSONPath for this response",
  transformJsonpath: "Write a JSONPath for this data",
} as const;

export type RelayEntryId = keyof typeof RELAY_ENTRY_PROMPTS;

export type OpenInRelayOptions = {
  /** Which entry point is opening Relay; selects its prompt from the map. */
  entry: RelayEntryId;
  /** Context chips seeded alongside the prompt, as pills ahead of it. */
  context?: readonly RelayChip[];
};

/** True for a short, human prompt free of internal instruction text. */
export function isHumanPrompt(prompt: string): boolean {
  return (
    prompt.length > 0 &&
    prompt.length <= RELAY_PROMPT_MAX_CHARS &&
    !INTERNAL_PROMPT_MARKERS.some((marker) => prompt.includes(marker))
  );
}

/** The pills first, then the prompt, so the draft reads as the editor would hold it. */
function draftSegments(
  prompt: string,
  context: readonly RelayChip[],
): PromptSegment[] {
  const pills = context.map(
    (chip): PromptSegment => ({ type: "attachment", chip }),
  );
  const text = context.length > 0 ? ` ${prompt}` : prompt;
  return [...pills, { type: "text", text }];
}

/**
 * Opens the dock with the composer pre-filled and the entry point's context
 * as pills. A no-op when Relay is off by flag (FR-80) or by the user's setting (FR-81).
 */
export function openInRelay({ entry, context = [] }: OpenInRelayOptions): void {
  const prompt: string = RELAY_ENTRY_PROMPTS[entry];
  if (!isHumanPrompt(prompt)) return;
  if (!isRelayEnabled() || !useRelayStore.getState().enabled) return;
  useRelayStore
    .getState()
    .openWithDraft({ segments: draftSegments(prompt, context) });
}
