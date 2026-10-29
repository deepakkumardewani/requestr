"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import type { PickerKind } from "@/hooks/useRelayPickerItems";
import {
  SLASH_COMMANDS,
  type SlashTargetKind,
} from "@/lib/relay/slashCommands";
import { hasTargetKind } from "@/lib/relay/slashTarget";
import type {
  StarterSuggestion,
  TargetSuggestion,
} from "@/lib/relay/suggestions";
import { useRelayStore } from "@/stores/useRelayStore";

/** The current tab is not a kind the picker can filter on, so it lists every kind. */
const pickerKindFor = (
  kind: SlashTargetKind,
): Exclude<PickerKind, "all"> | null => (kind === "tab" ? null : kind);

/**
 * Runs an empty-state suggestion. A starter is sent when it needs no target
 * or the target is already attached; otherwise it prefills the draft and asks
 * the composer to open the mention menu. A suggestion with a known target
 * sends its command plus the target pill (EMPTY-01, BUG-02).
 */
export function useCapabilityStarter() {
  const t = useTranslations("relay");
  const submitPrompt = useRelayStore((s) => s.submitPrompt);
  const openWithDraft = useRelayStore((s) => s.openWithDraft);
  const requestMention = useRelayStore((s) => s.requestMention);
  const stageOutgoing = useRelayStore((s) => s.stageOutgoing);

  const runStarter = useCallback(
    (starter: StarterSuggestion) => {
      const prompt = t(starter.labelKey);
      const { requiresTarget } = starter;
      const { attachedItems } = useRelayStore.getState();
      if (!requiresTarget || hasTargetKind(attachedItems, requiresTarget)) {
        submitPrompt(prompt);
        return;
      }
      openWithDraft({ segments: [{ type: "text", text: prompt }] });
      requestMention({
        kind: pickerKindFor(requiresTarget),
        hintKey: `slash.hint.${starter.id}`,
      });
    },
    [t, submitPrompt, openWithDraft, requestMention],
  );

  const runTargetSuggestion = useCallback(
    ({ command, target }: TargetSuggestion) => {
      const draft = {
        attachments: [target],
        segments: [
          { type: "command" as const, id: command, label: `/${command}` },
          { type: "text" as const, text: " " },
          { type: "attachment" as const, chip: target },
        ],
      };
      // Staged first so the message carries exactly this pill, as a composer send does.
      stageOutgoing(draft);
      // The same text a composer send of this command and pill would produce.
      const promptKey = SLASH_COMMANDS.find(
        ({ id }) => id === command,
      )?.promptKey;
      submitPrompt(
        `${promptKey ? t(promptKey) : `/${command}`} @${target.label}`,
      );
    },
    [t, stageOutgoing, submitPrompt],
  );

  return { runStarter, runTargetSuggestion };
}
