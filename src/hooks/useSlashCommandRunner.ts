"use client";

import { useCallback, useState } from "react";
import type { PickerKind } from "@/hooks/useRelayPickerItems";
import type { ContextChip } from "@/lib/relay/chips";
import {
  needsClearConfirm,
  type SlashCommand,
  type SlashTargetKind,
} from "@/lib/relay/slashCommands";
import { resolveSlashTarget } from "@/lib/relay/slashTarget";

export type SlashMentionRequest = {
  kind: Exclude<PickerKind, "all"> | null;
  hint: string;
  pinCurrentTab: boolean;
};

type Translate = (key: string) => string;

type UseSlashCommandRunnerArgs = {
  attachedItems: readonly ContextChip[];
  threadHasMessages: boolean;
  translate: Translate;
  onStartNewConversation: () => void;
};

export type SlashCommandRunResult =
  | { type: "clear-confirm" }
  | { type: "new-thread" }
  /** The caller puts the command pill in the editor; it resolves to its prompt at send. */
  | { type: "insert-command" }
  /** As insert-command, and the target picker is open to supply the attachment pill. */
  | { type: "await-target" };

const hintKey = (kind: SlashTargetKind) => `slash.hint.${kind}` as const;

export function useSlashCommandRunner({
  attachedItems,
  threadHasMessages,
  translate,
  onStartNewConversation,
}: UseSlashCommandRunnerArgs) {
  const [mentionRequest, setMentionRequest] =
    useState<SlashMentionRequest | null>(null);
  const [pendingCommand, setPendingCommand] = useState<SlashCommand | null>(
    null,
  );

  const clearMentionRequest = useCallback(() => {
    setMentionRequest(null);
    setPendingCommand(null);
  }, []);

  const runSlashCommand = useCallback(
    (command: SlashCommand): SlashCommandRunResult => {
      setMentionRequest(null);
      setPendingCommand(null);

      if (command.id === "clear") {
        if (needsClearConfirm(command, threadHasMessages)) {
          return { type: "clear-confirm" };
        }
        onStartNewConversation();
        return { type: "new-thread" };
      }

      const resolution = resolveSlashTarget(command, attachedItems);

      if (resolution.satisfied) return { type: "insert-command" };

      setPendingCommand(command);
      const pickerKind: Exclude<PickerKind, "all"> | null =
        resolution.needKind === "tab" ? null : resolution.needKind;
      setMentionRequest({
        kind: pickerKind,
        hint: translate(hintKey(resolution.needKind)),
        pinCurrentTab: true,
      });
      return { type: "await-target" };
    },
    [attachedItems, onStartNewConversation, threadHasMessages, translate],
  );

  const completeTargetPick = useCallback(() => {
    if (!pendingCommand) return;
    setPendingCommand(null);
    setMentionRequest(null);
  }, [pendingCommand]);

  return {
    runSlashCommand,
    mentionRequest,
    clearMentionRequest,
    completeTargetPick,
    pendingSlashCommand: pendingCommand,
  };
}
