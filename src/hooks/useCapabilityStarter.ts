"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { PickerKind } from "@/hooks/useRelayPickerItems";
import type { CapabilityExample } from "@/lib/relay/capabilities";
import type { SlashTargetKind } from "@/lib/relay/slashCommands";
import { hasTargetKind } from "@/lib/relay/slashTarget";
import { useRelayStore } from "@/stores/useRelayStore";

/** The current tab is not a kind the picker can filter on, so it lists every kind. */
const pickerKindFor = (
  kind: SlashTargetKind,
): Exclude<PickerKind, "all"> | null => (kind === "tab" ? null : kind);

/**
 * Runs a capability starter: sends it when it needs no target or the target
 * is already attached; otherwise prefills the draft and asks the composer to
 * open the mention menu so the user can pick one (RP-206, RP-204).
 */
export function useCapabilityStarter() {
  const t = useTranslations("relay");
  const submitPrompt = useRelayStore((s) => s.submitPrompt);
  const openWithDraft = useRelayStore((s) => s.openWithDraft);
  const requestMention = useRelayStore((s) => s.requestMention);

  const runStarter = useCallback(
    (example: CapabilityExample) => {
      const prompt = t(example.promptKey);
      const { requiresTarget } = example;
      const { attachedItems } = useRelayStore.getState();
      if (!requiresTarget || hasTargetKind(attachedItems, requiresTarget)) {
        submitPrompt(prompt);
        return;
      }
      openWithDraft({ prompt, chips: [] });
      requestMention({
        kind: pickerKindFor(requiresTarget),
        hintKey: `slash.hint.${requiresTarget}`,
      });
    },
    [t, submitPrompt, openWithDraft, requestMention],
  );

  return { runStarter };
}
