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
import {
  type AttachedContext,
  type AttachedTab,
  buildWorkspaceSummary,
  type CollectionDescription,
  describeAttached,
  type EnvironmentDescription,
  isStillAttached,
} from "./tools/workspaceRead";

/**
 * Tokens held back for the system prompt and tool definitions, which the
 * server adds on top of whatever the client sends.
 */
const FIXED_PROMPT_RESERVE_TOKENS = 3000;

export { chipKey };
export type { ContextChip, ContextChipKind };

export type RelayContext = {
  workspace: ReturnType<typeof summarizeWorkspace>;
  /** Present only while a `tab` chip is attached. */
  activeTab?: AttachedTab;
  /** Present only while a `collection` chip is attached. */
  collection?: CollectionDescription;
  /** Present only while an `environment` chip is attached. */
  environment?: EnvironmentDescription;
  /** Attached items that do not fit a field above (requests, chains, further tabs, collections, environments). */
  attached?: AttachedContext[];
  /** Exactly the chips whose data is in this payload (AC-14). */
  chips: ContextChip[];
};

export type ContextInput = {
  store: StoreAccess;
  redact: RedactContext;
  /** Items the user attached by hand (FR-122); the only source of context. */
  attachedItems: readonly ContextChip[];
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

/**
 * The first attached tab, collection and environment fill their dedicated
 * payload fields; everything else stays in `attached`.
 */
function placeAttached(
  described: readonly AttachedContext[],
): Pick<RelayContext, "activeTab" | "collection" | "environment" | "attached"> {
  const fields: Pick<RelayContext, "activeTab" | "collection" | "environment"> =
    {};
  const rest: AttachedContext[] = [];
  for (const item of described) {
    if (item.kind === "tab" && !fields.activeTab) {
      const { kind: _kind, ...tab } = item;
      fields.activeTab = tab;
    } else if (item.kind === "collection" && !fields.collection) {
      const { kind: _kind, ...collection } = item;
      fields.collection = collection;
    } else if (item.kind === "environment" && !fields.environment) {
      const { kind: _kind, ...environment } = item;
      fields.environment = environment;
    } else {
      rest.push(item);
    }
  }
  return { ...fields, ...(rest.length > 0 ? { attached: rest } : {}) };
}

export function buildRelayContext(input: ContextInput): RelayContext {
  const { store, redact, attachedItems } = input;
  const chips = attachedItems.filter((chip) => isStillAttached(store, chip));
  const context: RelayContext = {
    workspace: summarizeWorkspace(store),
    chips,
    ...placeAttached(describeAttached(store, chips, redact)),
  };
  // Redaction last, so nothing added above can skip it (FR-60).
  return capToolResult(redactDeep(context, redact)) as RelayContext;
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
