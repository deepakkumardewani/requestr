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
  onDraftChange: (text: string) => void;
  onCaret: (position: number) => void;
  onStartNewConversation: () => void;
};

export type SlashCommandRunResult =
  | { type: "clear-confirm" }
  | { type: "new-thread" }
  | { type: "filled-prompt" }
  | { type: "await-target" };

const hintKey = (kind: SlashTargetKind) => `slash.hint.${kind}` as const;

// Attachments travel as message metadata, never as draft text (BUG-01).
const buildPrompt = (command: SlashCommand, translate: Translate): string =>
  command.promptKey ? translate(command.promptKey) : "";

export function useSlashCommandRunner({
  attachedItems,
  threadHasMessages,
  translate,
  onDraftChange,
  onCaret,
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

      if (resolution.satisfied) {
        const prompt = buildPrompt(command, translate);
        onDraftChange(prompt);
        onCaret(prompt.length);
        return { type: "filled-prompt" };
      }

      onDraftChange(command.name);
      onCaret(command.name.length);
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
    [
      attachedItems,
      onCaret,
      onDraftChange,
      onStartNewConversation,
      threadHasMessages,
      translate,
    ],
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
