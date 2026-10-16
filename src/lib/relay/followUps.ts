import type { UIMessage } from "ai";

/** Chips shown under an answer at most (FR-196). */
export const MAX_FOLLOW_UPS = 3;

/** Message keys under `relay.followUps`; the chip's label is also the prompt it sends. */
export type FollowUpKey =
  | "fixRequest"
  | "explainHeaders"
  | "explainResponse"
  | "addAssertions"
  | "whyChainFailed"
  | "retryChain";

const TOOL_PART_PREFIX = "tool-";
const SEND_REQUEST_TOOL = "send_request";
const RUN_CHAIN_TOOL = "run_chain";
/** First HTTP status that counts as a failed response; same cut-off as `suggestions.ts`. */
const FIRST_ERROR_STATUS = 400;

type ToolResult = { ok?: unknown; data?: unknown };

type SettledToolPart = {
  tool: string;
  result: ToolResult;
};

/** The newest tool call of the message that has finished, or null. */
function lastSettledTool(message: UIMessage): SettledToolPart | null {
  for (const part of message.parts.toReversed()) {
    if (!part.type.startsWith(TOOL_PART_PREFIX)) continue;
    const { state, output } = part as { state?: string; output?: unknown };
    if (state !== "output-available" || !output || typeof output !== "object") {
      return null;
    }
    return {
      tool: part.type.slice(TOOL_PART_PREFIX.length),
      result: output as ToolResult,
    };
  }
  return null;
}

function fromSendRequest({ ok, data }: ToolResult): FollowUpKey[] {
  if (ok !== true) return ["fixRequest"];
  const status = (data as { status?: unknown } | undefined)?.status;
  if (typeof status !== "number") return [];
  return status >= FIRST_ERROR_STATUS
    ? ["fixRequest", "explainHeaders", "explainResponse"]
    : ["addAssertions", "explainResponse"];
}

function fromRunChain({ ok, data }: ToolResult): FollowUpKey[] {
  if (ok !== true) return ["retryChain"];
  const failed = (data as { failed?: unknown } | undefined)?.failed;
  return Array.isArray(failed) && failed.length > 0
    ? ["whyChainFailed", "retryChain"]
    : [];
}

/**
 * Follow-up prompts for the newest assistant answer, from what its last tool
 * returned. Pure and client-side: no model call (FR-196). Empty when the last
 * message is not an assistant answer or it ran no tool.
 */
export function deriveFollowUps(messages: UIMessage[]): FollowUpKey[] {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return [];
  const settled = lastSettledTool(last);
  if (!settled) return [];
  const keys =
    settled.tool === SEND_REQUEST_TOOL
      ? fromSendRequest(settled.result)
      : settled.tool === RUN_CHAIN_TOOL
        ? fromRunChain(settled.result)
        : [];
  return keys.slice(0, MAX_FOLLOW_UPS);
}
