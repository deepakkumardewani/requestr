import { Extension, type JSONContent, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { Suggestion } from "@tiptap/suggestion";
import {
  ATTACHMENT_PILL_NODE,
  COMMAND_PILL_NODE,
} from "@/components/relay/editorTypes";
import type { ContextChip } from "@/lib/relay/chips";
import type { SlashCommandId } from "@/lib/relay/slashCommands";

/** One open `@` or `/` trigger, as the composer's menu needs it. */
export type TriggerSession = {
  /** Text typed after the trigger character. */
  query: string;
  /** The trigger and its query; changes when a new trigger is typed. */
  range: Range;
  /** Replaces the trigger text with `content`. */
  insert: (content: JSONContent[]) => void;
};

type TriggerOptions = {
  name: string;
  char: string;
  /** Called with the session while the trigger is active and null once it ends. */
  onSession: (session: TriggerSession | null) => void;
};

/** Inline text node placed after a pill so typing continues outside it. */
const TRAILING_SPACE: JSONContent = { type: "text", text: " " };

/**
 * A `@tiptap/suggestion` trigger that only reports its state. The composer
 * owns the menus and their keys, so nothing is rendered here.
 */
export function createTriggerExtension({
  name,
  char,
  onSession,
}: TriggerOptions) {
  return Extension.create({
    name,
    addProseMirrorPlugins() {
      return [
        Suggestion<never, JSONContent[]>({
          editor: this.editor,
          pluginKey: new PluginKey(name),
          char,
          command: ({ editor, range, props }) => {
            const chain = editor.chain().focus();
            // An empty insert only removes the trigger text; Tiptap rejects empty content.
            if (props.length === 0) chain.deleteRange(range).run();
            else chain.insertContentAt(range, props).run();
          },
          render: () => {
            const report = ({
              query,
              range,
              command,
            }: {
              query: string;
              range: Range;
              command: (content: JSONContent[]) => void;
            }) => onSession({ query, range, insert: command });
            return {
              onStart: report,
              onUpdate: report,
              onExit: () => onSession(null),
            };
          },
        }),
      ];
    },
  });
}

export const attachmentPillContent = (chip: ContextChip): JSONContent[] => [
  {
    type: ATTACHMENT_PILL_NODE,
    attrs: { kind: chip.kind, id: chip.id, label: chip.label },
  },
  TRAILING_SPACE,
];

export const commandPillContent = (
  id: SlashCommandId,
  label: string,
): JSONContent[] => [
  { type: COMMAND_PILL_NODE, attrs: { id, label } },
  TRAILING_SPACE,
];

/** `@` opens the picker; choosing an item inserts an attachment pill at the caret (COMP-02). */
export const createMentionExtension = (
  onSession: TriggerOptions["onSession"],
) => createTriggerExtension({ name: "relayMention", char: "@", onSession });
