import type { UIMessage } from "ai";
import { type ContextChip, type ContextChipKind, chipKey } from "./chips";
import { type RedactContext, redactDeep, redactHistory } from "./redact";
import type { StoreAccess } from "./storeAccess";
import {
  capToolResult,
  estimateTokens,
  RELAY_INPUT_TOKEN_BUDGET,
  trimHistory,
} from "./tokenBudget";
import { buildWorkspaceSummary } from "./tools/workspaceRead";

/**
 * Tokens held back for the system prompt and tool definitions, which the
 * server adds on top of whatever the client sends.
 */
const FIXED_PROMPT_RESERVE_TOKENS = 3000;

export { chipKey };
export type { ContextChip, ContextChipKind };

export type RelayContext = {
  workspace: ReturnType<typeof summarizeWorkspace>;
  /** Always empty: attachments travel with the user message that carried them (BUG-01). */
  chips: ContextChip[];
};

export type ContextInput = {
  store: StoreAccess;
  redact: RedactContext;
};

/** The active environment is reported by its chip, so the summary must not leak it once removed. */
function summarizeWorkspace(store: StoreAccess) {
  const summary = buildWorkspaceSummary(store);
  return {
    ...summary,
    environments: summary.environments.map(
      ({ active: _active, ...env }) => env,
    ),
  };
}

/** What a truncated context must still carry to pass the route's schema. */
const CONTEXT_REQUIRED_SHAPE = { workspace: {}, chips: [] };

export function buildRelayContext(input: ContextInput): RelayContext {
  const { store, redact } = input;
  const context: RelayContext = {
    workspace: summarizeWorkspace(store),
    chips: [],
  };
  // Redaction last, so nothing added above can skip it (FR-60).
  return capToolResult(
    redactDeep(context, redact),
    CONTEXT_REQUIRED_SHAPE,
  ) as RelayContext;
}

export type ChatPayload = {
  messages: UIMessage[];
  context: RelayContext;
};

/**
 * Context plus history trimmed to whatever budget the context leaves (FR-50).
 * Replayed tool output is redacted too: an old thread may hold raw data (RP-203).
 */
export function buildChatPayload(
  input: ContextInput & { messages: UIMessage[] },
): ChatPayload {
  const context = buildRelayContext(input);
  const messages = redactHistory(input.messages, input.redact);
  const budget =
    RELAY_INPUT_TOKEN_BUDGET -
    FIXED_PROMPT_RESERVE_TOKENS -
    estimateTokens(JSON.stringify(context));
  return {
    messages: trimHistory(messages, Math.max(budget, 0)).messages,
    context,
  };
}
