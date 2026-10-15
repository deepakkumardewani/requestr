import type { UIMessage } from "ai";
import type { RelayChatStatus } from "@/hooks/useRelayChat";
import { awaitsUser } from "@/lib/relay/tools/schemas";

/** What Relay is doing right now, for the loading line under the thread. */
export type RelayActivity =
  | { kind: "thinking" }
  | { kind: "tool"; toolName: string; input: unknown };

const TOOL_PART_PREFIX = "tool-";
/** Parts that carry no visible progress, so they never decide the activity. */
const NON_VISIBLE_PART_TYPES = new Set(["step-start", "reasoning"]);
/** Tool part states before a result exists. */
const IN_FLIGHT_TOOL_STATES = new Set(["input-streaming", "input-available"]);

type MessagePart = UIMessage["parts"][number];

const isGenerating = (status: RelayChatStatus): boolean =>
  status === "submitted" || status === "streaming";

function lastVisiblePart(message: UIMessage): MessagePart | undefined {
  return message.parts.findLast(
    (part) => !NON_VISIBLE_PART_TYPES.has(part.type),
  );
}

/**
 * The single activity to show, or null when the turn is idle or assistant text
 * is already streaming (the text itself is the progress). A call that waits for
 * the user shows its card instead of a loading line.
 */
export function deriveActivity(
  messages: UIMessage[],
  status: RelayChatStatus,
): RelayActivity | null {
  if (!isGenerating(status)) return null;
  const last = messages.at(-1);
  if (last?.role !== "assistant") return { kind: "thinking" };
  const part = lastVisiblePart(last);
  if (!part) return { kind: "thinking" };
  if (part.type === "text") {
    return part.text.length > 0 ? null : { kind: "thinking" };
  }
  if (!part.type.startsWith(TOOL_PART_PREFIX)) return { kind: "thinking" };
  const call = part as { state: string; input?: unknown };
  if (!IN_FLIGHT_TOOL_STATES.has(call.state)) return { kind: "thinking" };
  const toolName = part.type.slice(TOOL_PART_PREFIX.length);
  if (awaitsUser(toolName, call.input)) return null;
  return { kind: "tool", toolName, input: call.input };
}
