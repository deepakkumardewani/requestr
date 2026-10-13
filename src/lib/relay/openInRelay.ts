import { isRelayEnabled } from "@/lib/relay/flag";
import { type RelayChip, useRelayStore } from "@/stores/useRelayStore";

export type OpenInRelayOptions = {
  /** Text pre-filled into the composer. */
  prompt: string;
  /** Context chips seeded alongside the prompt. */
  context?: readonly RelayChip[];
};

/**
 * Opens the dock with the composer pre-filled and the entry point's context
 * chips visible. A no-op when Relay is off by flag (FR-80) or by the user's setting (FR-81).
 */
export function openInRelay({
  prompt,
  context = [],
}: OpenInRelayOptions): void {
  if (!isRelayEnabled() || !useRelayStore.getState().enabled) return;
  useRelayStore.getState().openWithDraft({ prompt, chips: context });
}
