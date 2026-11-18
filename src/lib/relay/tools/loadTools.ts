import { CORE_TOOLS, toolsForTopic } from "../capabilities";
import { ATTACHMENT_KIND_TOPICS } from "../constants";
import { readSlashTopic } from "../slashCommands";
import type { ToolImpl } from "./registry";
import {
  type CapabilityTopic,
  isRelayToolName,
  LOADABLE_TOPICS,
  type LoadableTopic,
  type RelayToolName,
} from "./schemas";

/**
 * Which tools a turn may use (HH-M03). Pure and free of store imports: the
 * chat route computes the set from the messages it receives, so it must load
 * on the server.
 */

const TOOL_PART_PREFIX = "tool-";

/** The slice of a UI message this module reads; history is untrusted, so everything is re-validated. */
export type TurnMessage = {
  role: string;
  parts: readonly { type: string; input?: unknown }[];
  metadata?: unknown;
};

const loadToolsTool: ToolImpl<"load_tools"> = {
  name: "load_tools",
  run: ({ topic }) => ({
    ok: true,
    data: { topic, enabled: toolsForTopic(topic) },
  }),
};

export const loadToolsTools = [loadToolsTool] as const;

const isLoadableTopic = (value: unknown): value is LoadableTopic =>
  (LOADABLE_TOPICS as readonly unknown[]).includes(value);

function attachmentTopics(metadata: unknown): CapabilityTopic[] {
  const list = (metadata as { attachments?: unknown } | null | undefined)
    ?.attachments;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item): CapabilityTopic[] => {
    const kind = (item as { kind?: unknown } | null)?.kind;
    return typeof kind === "string" &&
      Object.hasOwn(ATTACHMENT_KIND_TOPICS, kind)
      ? [ATTACHMENT_KIND_TOPICS[kind as keyof typeof ATTACHMENT_KIND_TOPICS]]
      : [];
  });
}

function toolNameOf(partType: string): RelayToolName | null {
  if (!partType.startsWith(TOOL_PART_PREFIX)) return null;
  const name = partType.slice(TOOL_PART_PREFIX.length);
  return isRelayToolName(name) ? name : null;
}

/**
 * Core, plus the group of the turn's slash command and attached item kinds,
 * plus every group `load_tools` opened since the last user message, plus any
 * tool already called this turn so a pending result never loses its tool.
 */
export function enabledToolNames(
  messages: readonly TurnMessage[],
): ReadonlySet<RelayToolName> {
  const lastUser = messages.findLastIndex(({ role }) => role === "user");
  const turnStart = messages[lastUser];
  const topics = new Set<CapabilityTopic>(
    turnStart ? attachmentTopics(turnStart.metadata) : [],
  );
  const slashTopic = turnStart ? readSlashTopic(turnStart.metadata) : null;
  if (slashTopic) topics.add(slashTopic);

  const enabled = new Set<RelayToolName>(CORE_TOOLS);
  for (const message of messages.slice(lastUser + 1)) {
    for (const part of message.parts) {
      const name = toolNameOf(part.type);
      if (!name) continue;
      enabled.add(name);
      const requested = (part.input as { topic?: unknown } | null)?.topic;
      if (name === "load_tools" && isLoadableTopic(requested))
        topics.add(requested);
    }
  }
  for (const topic of topics) {
    for (const name of toolsForTopic(topic)) enabled.add(name);
  }
  return enabled;
}
