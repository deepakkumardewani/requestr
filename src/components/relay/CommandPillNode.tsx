"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { useTranslations } from "next-intl";
import {
  SLASH_COMMAND_ICONS,
  SLASH_COMMANDS,
  type SlashCommandId,
} from "@/lib/relay/slashCommands";
import { cn } from "@/lib/utils";
import { removePillBeforeCaret } from "./AttachmentPillNode";
import { COMMAND_PILL_NODE } from "./editorTypes";

const PILL_DOM_ATTRIBUTE = "data-relay-command-pill";

type CommandPillProps = { id: SlashCommandId; className?: string };

/** A slash command shown inline; highlighted so it reads as an instruction, not text. */
export function CommandPill({ id, className }: CommandPillProps) {
  const t = useTranslations("relay");
  const command = SLASH_COMMANDS.find((candidate) => candidate.id === id);
  if (!command) return null;
  const Icon = SLASH_COMMAND_ICONS[command.icon];
  const description = t(command.descriptionKey);
  return (
    <span
      role="img"
      title={description}
      aria-label={`${command.name}: ${description}`}
      data-testid="relay-command-pill"
      data-command={id}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 align-baseline text-xs font-medium text-foreground",
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{command.name}</span>
    </span>
  );
}

function CommandPillView({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className="mx-0.5 inline-block max-w-full align-baseline"
    >
      <CommandPill id={node.attrs.id} />
    </NodeViewWrapper>
  );
}

/** The atomic inline node for a slash command; it may sit anywhere in the sentence (COMP-03). */
export const CommandPillNode = Node.create({
  name: COMMAND_PILL_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: "" },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: `span[${PILL_DOM_ATTRIBUTE}]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { [PILL_DOM_ATTRIBUTE]: "" }),
    ];
  },

  renderText({ node }) {
    return `/${node.attrs.id}`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(CommandPillView, { as: "span" });
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => removePillBeforeCaret(this.editor, this.name),
    };
  },
});
