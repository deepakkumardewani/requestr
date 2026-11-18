import type { ContextChip } from "@/lib/relay/chips";
import type { SlashCommandId } from "@/lib/relay/slashCommands";

/** Tiptap node names shared by the editor schema and the serializer. */
export const ATTACHMENT_PILL_NODE = "attachmentPill";
export const COMMAND_PILL_NODE = "commandPill";

/** The slice of Tiptap's JSON document the serializer reads; keeps it free of editor imports. */
export type EditorNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  text?: string;
  content?: EditorNode[];
};

export type TextSegment = { type: "text"; text: string };
export type AttachmentSegment = {
  type: "attachment";
  chip: ContextChip;
  /** The entity was removed while the pill was still in the composer. */
  deleted?: boolean;
};
export type CommandSegment = {
  type: "command";
  id: SlashCommandId;
  label: string;
};
export type PromptSegment = TextSegment | AttachmentSegment | CommandSegment;

export type SerializedCommand = Pick<CommandSegment, "id" | "label">;

export type SerializedEditor = {
  /** Readable form with `/command` and `@name` tokens. */
  text: string;
  segments: PromptSegment[];
  /** One entry per distinct pill, in document order. */
  attachments: ContextChip[];
  commands: SerializedCommand[];
};

/** What the parent can do to the editor without owning its Tiptap instance. */
export type PromptEditorHandle = {
  focus: () => void;
  clear: () => void;
  /** Inserts plain text at the caret, leaving existing pills untouched. */
  insertTextAtCaret: (text: string) => void;
  getSerialized: () => SerializedEditor;
};
