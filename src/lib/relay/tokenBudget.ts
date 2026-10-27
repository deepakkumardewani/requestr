import type { UIMessage } from "ai";

/** Input budget per request (NFR-4). */
export const RELAY_INPUT_TOKEN_BUDGET = 24_000;
/** Largest chat request body the route accepts (NFR-4). */
export const RELAY_MAX_BODY_BYTES = 256 * 1024;
/** Response bodies handed to the model are cut to this many characters (FR-52). */
export const RESPONSE_BODY_CAP_CHARS = 4096;
/** Longest array a tool result may carry before the rest is dropped. */
export const MAX_RESULT_ARRAY_ITEMS = 50;
/** A whole serialized tool result is cut to this many characters. */
export const MAX_TOOL_RESULT_CHARS = 16_000;

const CHARS_PER_TOKEN = 4;
const HEAD_SHARE = 0.75;
const NUL = "\u0000";
const BINARY_CONTENT_TYPE =
  /^(image|audio|video|font)\/|application\/(octet-stream|pdf|zip|gzip|x-tar|x-7z|vnd\.)/i;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Head and tail survive; the middle is replaced by a marker saying how much was cut. */
export function truncateHeadTail(
  text: string,
  cap: number = RESPONSE_BODY_CAP_CHARS,
): { text: string; truncated: boolean } {
  if (text.length <= cap) return { text, truncated: false };
  const head = Math.floor(cap * HEAD_SHARE);
  const tail = cap - head;
  const omitted = text.length - cap;
  return {
    text: `${text.slice(0, head)}\n...[truncated ${omitted} characters]...\n${text.slice(text.length - tail)}`,
    truncated: true,
  };
}

export type BodyForModel =
  | { kind: "text"; text: string; truncated: boolean; totalChars: number }
  | { kind: "binary"; contentType: string; sizeBytes: number };

function looksBinary(body: string, contentType: string): boolean {
  return BINARY_CONTENT_TYPE.test(contentType) || body.includes(NUL);
}

/** Text bodies are truncated; binary ones are replaced by metadata (FR-52, FR-46). */
export function prepareBodyForModel(input: {
  body: string;
  contentType: string;
  sizeBytes: number;
}): BodyForModel {
  const { body, contentType, sizeBytes } = input;
  if (looksBinary(body, contentType)) {
    return { kind: "binary", contentType, sizeBytes };
  }
  const { text, truncated } = truncateHeadTail(body);
  return { kind: "text", text, truncated, totalChars: body.length };
}

function capValue(value: unknown): unknown {
  if (typeof value === "string") return truncateHeadTail(value).text;
  if (Array.isArray(value)) {
    const kept = value.slice(0, MAX_RESULT_ARRAY_ITEMS).map(capValue);
    const dropped = value.length - kept.length;
    return dropped > 0 ? [...kept, `...${dropped} more omitted`] : kept;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, capValue(item)]),
    );
  }
  return value;
}

/**
 * Caps strings, arrays and the overall size of a tool result (FR-46).
 * `requiredShape` is kept on the truncated stand-in so a consumer that
 * validates the shape (the route's context) still accepts it.
 */
export function capToolResult(
  value: unknown,
  requiredShape: Record<string, unknown> = {},
): unknown {
  const capped = capValue(value);
  const serialized = JSON.stringify(capped) ?? "null";
  if (serialized.length <= MAX_TOOL_RESULT_CHARS) return capped;
  return {
    ...requiredShape,
    truncated: true,
    preview: `${serialized.slice(0, MAX_TOOL_RESULT_CHARS)}...`,
  };
}

type TurnSized = { messages: UIMessage[]; tokens: number };

function messageTokens(message: UIMessage): number {
  return estimateTokens(JSON.stringify(message.parts));
}

/** A turn starts at a user message and runs until the next one. */
function splitTurns(messages: UIMessage[]): UIMessage[][] {
  return messages.reduce<UIMessage[][]>((turns, message) => {
    if (message.role === "user" || turns.length === 0) turns.push([message]);
    else turns[turns.length - 1].push(message);
    return turns;
  }, []);
}

export type TrimmedHistory = {
  messages: UIMessage[];
  /** Whole turns removed from the front to fit the budget. */
  droppedTurns: number;
};

/**
 * Drops the oldest turns until the history fits `budgetTokens`. The latest
 * turn always stays, even when it alone exceeds the budget (FR-50).
 */
export function trimHistory(
  messages: UIMessage[],
  budgetTokens: number = RELAY_INPUT_TOKEN_BUDGET,
): TrimmedHistory {
  const turns: TurnSized[] = splitTurns(messages).map((turn) => ({
    messages: turn,
    tokens: turn.reduce((sum, message) => sum + messageTokens(message), 0),
  }));
  let total = turns.reduce((sum, turn) => sum + turn.tokens, 0);
  let dropped = 0;
  while (turns.length - dropped > 1 && total > budgetTokens) {
    total -= turns[dropped].tokens;
    dropped += 1;
  }
  return {
    messages: turns.slice(dropped).flatMap((turn) => turn.messages),
    droppedTurns: dropped,
  };
}
