import type { PromptSegment } from "@/components/relay/editorTypes";
import { isRelayEnabled } from "@/lib/relay/flag";
import { type RelayChip, useRelayStore } from "@/stores/useRelayStore";

export type OpenInRelayOptions = {
  /** Text pre-filled into the composer. */
  prompt: string;
  /** Context chips seeded alongside the prompt, as pills ahead of it. */
  context?: readonly RelayChip[];
};

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
export function openInRelay({
  prompt,
  context = [],
}: OpenInRelayOptions): void {
  if (!isRelayEnabled() || !useRelayStore.getState().enabled) return;
  useRelayStore
    .getState()
    .openWithDraft({ segments: draftSegments(prompt, context) });
}
