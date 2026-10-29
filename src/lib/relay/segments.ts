import type { PromptSegment } from "@/components/relay/editorTypes";
import type { ContextChipKind } from "./chips";
import { SLASH_COMMANDS, type SlashCommandId } from "./slashCommands";

const SEGMENTS_KEY = "segments";
const PILL_KINDS: readonly string[] = [
  "tab",
  "request",
  "chain",
  "collection",
  "environment",
] satisfies ContextChipKind[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object";

function readSegment(value: unknown): PromptSegment | null {
  if (!isRecord(value)) return null;
  if (value.type === "text" && typeof value.text === "string") {
    return { type: "text", text: value.text };
  }
  if (value.type === "command") {
    const command = SLASH_COMMANDS.find(({ id }) => id === value.id);
    if (!command || typeof value.label !== "string") return null;
    return {
      type: "command",
      id: command.id satisfies SlashCommandId,
      label: value.label,
    };
  }
  const chip = value.type === "attachment" ? value.chip : null;
  if (!isRecord(chip)) return null;
  const kind = PILL_KINDS.find((candidate) => candidate === chip.kind);
  if (typeof chip.id !== "string" || typeof chip.label !== "string" || !kind) {
    return null;
  }
  return {
    type: "attachment",
    chip: { id: chip.id, label: chip.label, kind: kind as ContextChipKind },
  };
}

/**
 * What a stored message remembers of the composer's text and pills, in order.
 * Read defensively: threads restored from storage are untyped, and a message
 * from before pills existed has none (it then renders as plain text).
 */
export function readSegmentMetadata(metadata: unknown): PromptSegment[] | null {
  const list = isRecord(metadata) ? metadata[SEGMENTS_KEY] : null;
  if (!Array.isArray(list)) return null;
  const segments = list.flatMap((item) => readSegment(item) ?? []);
  return segments.length > 0 ? segments : null;
}

/** Only a message with a pill needs its segments stored; plain text already is its own record. */
export function segmentMetadata(
  segments: readonly PromptSegment[],
): { segments: PromptSegment[] } | null {
  if (segments.every((segment) => segment.type === "text")) return null;
  // `deleted` is a composer-time flag; the bubble recomputes it from the live workspace.
  const stored = segments.map((segment) =>
    segment.type === "attachment"
      ? ({ type: "attachment", chip: segment.chip } as const)
      : segment,
  );
  return { segments: stored };
}

/** The message metadata without its segments, for what is sent to the server. */
export function withoutSegments(metadata: unknown): Record<string, unknown> {
  if (!isRecord(metadata)) return {};
  const { [SEGMENTS_KEY]: _segments, ...rest } = metadata;
  return rest;
}
