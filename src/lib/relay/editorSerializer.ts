import {
  ATTACHMENT_PILL_NODE,
  COMMAND_PILL_NODE,
  type EditorNode,
  type PromptSegment,
  type SerializedEditor,
} from "@/components/relay/editorTypes";
import { type ContextChip, chipKey } from "@/lib/relay/chips";
import type { SlashCommandId } from "@/lib/relay/slashCommands";

const NEWLINE = "\n";
const HARD_BREAK_NODE = "hardBreak";
const PARAGRAPH_NODE = "paragraph";
const TEXT_NODE = "text";

const asString = (value: unknown): string =>
  typeof value === "string" ? value : "";

function chipFromAttrs(attrs: EditorNode["attrs"]): ContextChip | null {
  const kind = asString(attrs?.kind);
  const id = asString(attrs?.id);
  if (!kind || !id) return null;
  return {
    kind: kind as ContextChip["kind"],
    id,
    label: asString(attrs?.label),
  };
}

/** Maps one inline node to a segment; unknown nodes serialise to nothing. */
function toSegment(node: EditorNode): PromptSegment | null {
  switch (node.type) {
    case TEXT_NODE:
      return node.text ? { type: "text", text: node.text } : null;
    case HARD_BREAK_NODE:
      return { type: "text", text: NEWLINE };
    case ATTACHMENT_PILL_NODE: {
      const chip = chipFromAttrs(node.attrs);
      if (!chip) return null;
      return node.attrs?.deleted === true
        ? { type: "attachment", chip, deleted: true }
        : { type: "attachment", chip };
    }
    case COMMAND_PILL_NODE: {
      const id = asString(node.attrs?.id);
      if (!id) return null;
      return {
        type: "command",
        id: id as SlashCommandId,
        label: asString(node.attrs?.label),
      };
    }
    default:
      return null;
  }
}

/** Adds a segment, folding it into the previous text run when both are text. */
function pushSegment(segments: PromptSegment[], segment: PromptSegment): void {
  const last = segments.at(-1);
  if (segment.type === "text" && last?.type === "text") {
    last.text += segment.text;
    return;
  }
  segments.push(segment);
}

function collectSegments(doc: EditorNode): PromptSegment[] {
  const segments: PromptSegment[] = [];
  const paragraphs = doc.content ?? [];
  paragraphs.forEach((paragraph, index) => {
    if (index > 0) pushSegment(segments, { type: "text", text: NEWLINE });
    const inline =
      paragraph.type === PARAGRAPH_NODE
        ? (paragraph.content ?? [])
        : [paragraph];
    for (const node of inline) {
      const segment = toSegment(node);
      if (segment) pushSegment(segments, segment);
    }
  });
  return segments;
}

function segmentText(segment: PromptSegment): string {
  if (segment.type === "text") return segment.text;
  if (segment.type === "command") return `/${segment.id}`;
  return `@${segment.chip.label}`;
}

/** Editor JSON to its text, ordered segments, distinct attachments and commands. */
export function serializeEditorDoc(doc: EditorNode): SerializedEditor {
  const segments = collectSegments(doc);
  const attachments = new Map<string, ContextChip>();
  const commands: SerializedEditor["commands"] = [];
  for (const segment of segments) {
    if (segment.type === "attachment") {
      attachments.set(chipKey(segment.chip), segment.chip);
    } else if (segment.type === "command") {
      commands.push({ id: segment.id, label: segment.label });
    }
  }
  return {
    text: segments.map(segmentText).join(""),
    segments,
    attachments: [...attachments.values()],
    commands,
  };
}

/** Sendable when there is non-whitespace text or at least one pill (COMP-07). */
export function isSendable(serialized: SerializedEditor): boolean {
  return serialized.segments.some(
    (segment) => segment.type !== "text" || segment.text.trim().length > 0,
  );
}

/** Plain text as inline editor nodes: lines joined by hard breaks, never parsed as HTML. */
export function plainTextContent(text: string): EditorNode[] {
  return text
    .split(/\r?\n/)
    .flatMap((line, index) => [
      ...(index > 0 ? [{ type: HARD_BREAK_NODE }] : []),
      ...(line ? [{ type: TEXT_NODE, text: line }] : []),
    ]);
}

/**
 * Flags attachment pills whose entity no longer exists and drops them from the
 * attachments, so a deleted item travels as a note and never as detail (COMP-07).
 */
export function withDeletedPills(
  serialized: SerializedEditor,
  isDeleted: (chip: ContextChip) => boolean,
): SerializedEditor {
  const segments = serialized.segments.map(
    (segment): PromptSegment =>
      segment.type === "attachment" && isDeleted(segment.chip)
        ? { ...segment, deleted: true }
        : segment,
  );
  return {
    ...serialized,
    segments,
    attachments: serialized.attachments.filter((chip) => !isDeleted(chip)),
  };
}

type OutgoingTextOptions = {
  /** The prompt a command stands for; commands without one keep their `/id` token. */
  promptFor: (id: SlashCommandId) => string | undefined;
  /** The wording for a pill whose entity was deleted. */
  deletedNote: (label: string) => string;
};

/** The message text: each command pill resolves to its prompt and each deleted pill to a note. */
export function toOutgoingText(
  serialized: SerializedEditor,
  { promptFor, deletedNote }: OutgoingTextOptions,
): string {
  return serialized.segments
    .map((segment) => {
      if (segment.type === "command") {
        return promptFor(segment.id) ?? segmentText(segment);
      }
      if (segment.type === "attachment" && segment.deleted) {
        return deletedNote(segment.chip.label);
      }
      return segmentText(segment);
    })
    .join("")
    .trim();
}
