import type { UIMessage } from "ai";
import type { EnvironmentModel } from "@/types";
import { type ContextChip, type ContextChipKind, chipKey } from "./chips";
import { summarizeCollection } from "./collectionSummary";
import {
  REDACTED,
  type RedactContext,
  redactDeep,
  redactUrl,
  redactValue,
} from "./redact";
import type { StoreAccess } from "./storeAccess";
import {
  capToolResult,
  estimateTokens,
  RELAY_INPUT_TOKEN_BUDGET,
  trimHistory,
} from "./tokenBudget";
import {
  buildWorkspaceSummary,
  describeActiveContext,
} from "./tools/workspaceRead";

/**
 * Tokens held back for the system prompt and tool definitions, which the
 * server adds on top of whatever the client sends.
 */
const FIXED_PROMPT_RESERVE_TOKENS = 3000;

const CHAIN_PATH = /^\/chain\/([^/?#]+)/;

/** Chains have no tab, so the open chain is read from the route. */
export function chainIdFromPathname(pathname: string | null): string | null {
  const match = pathname ? CHAIN_PATH.exec(pathname) : null;
  return match ? decodeURIComponent(match[1]) : null;
}

export { chipKey };
export type { ContextChip, ContextChipKind };

export type RelayContext = {
  workspace: ReturnType<typeof summarizeWorkspace>;
  /** Present only while its chip is on. */
  activeTab?: NonNullable<
    ReturnType<typeof describeActiveContext>["activeTab"]
  >;
  collection?: {
    id: string;
    name: string;
  } & ReturnType<typeof summarizeCollection>;
  environment?: ReturnType<typeof describeEnvironment>;
  /** Items the user attached by hand that the open tab does not already cover. */
  attached?: AttachedContext[];
  /** Exactly the chips whose data is in this payload (AC-14). */
  chips: ContextChip[];
};

type AttachedContext =
  | { kind: "request"; id: string; name: string; method: string; url: string }
  | ({ kind: "collection" } & NonNullable<RelayContext["collection"]>)
  | ({ kind: "environment" } & ReturnType<typeof describeEnvironment>)
  | { kind: "chain"; id: string; name: string };

export type ContextInput = {
  store: StoreAccess;
  redact: RedactContext;
  /** Chip keys the user removed for the next message. */
  removedChipKeys?: readonly string[];
  /** The chain page the user is on, if any; chains have no tab. */
  activeChainId?: string | null;
  /** Items the user attached by hand (FR-122); kept for the whole conversation. */
  attachedItems?: readonly ContextChip[];
};

/**
 * The single source of truth for chips: the dock renders this list and the
 * payload is built from it, so what the user sees is what is sent.
 */
export function computeContextChips(
  store: StoreAccess,
  activeChainId: string | null = null,
  attachedItems: readonly ContextChip[] = [],
): ContextChip[] {
  const active = describeActiveContext(store, {
    shareValues: false,
    secrets: [],
  });
  const chain = store.chains().find((item) => item.id === activeChainId);
  const chips: ContextChip[] = [];
  if (chain) chips.push({ kind: "chain", id: chain.id, label: chain.name });
  if (!chain && active.activeTab?.requestId) {
    chips.push({
      kind: "request",
      id: active.activeTab.requestId,
      label: active.activeTab.name,
    });
  }
  if (active.collection) {
    chips.push({ kind: "collection", ...labelled(active.collection) });
  }
  if (active.environment) {
    chips.push({ kind: "environment", ...labelled(active.environment) });
  }
  const shown = new Set(chips.map(chipKey));
  // A deleted entity can no longer be sent, so it drops out instead of dangling.
  for (const item of attachedItems) {
    if (shown.has(chipKey(item)) || !store.exists(item.kind, item.id)) continue;
    shown.add(chipKey(item));
    chips.push(item);
  }
  return chips;
}

/**
 * Chips the user has left on for the next message. A hand-attached item stays
 * even if the same auto chip was removed earlier, since attaching is the newer choice.
 */
export function selectActiveChips(
  chips: readonly ContextChip[],
  removedChipKeys: readonly string[],
  attachedItems: readonly ContextChip[],
): ContextChip[] {
  const attachedKeys = new Set(attachedItems.map(chipKey));
  return chips.filter((chip) => {
    const key = chipKey(chip);
    return attachedKeys.has(key) || !removedChipKeys.includes(key);
  });
}

/** Data for hand-attached chips that the open tab, collection and environment do not already supply. */
function describeAttached(
  store: StoreAccess,
  chips: readonly ContextChip[],
  covered: ReadonlySet<string>,
  redact: RedactContext,
): AttachedContext[] {
  return chips.flatMap((chip): AttachedContext[] => {
    if (covered.has(chipKey(chip))) return [];
    switch (chip.kind) {
      case "request": {
        const request = store.requests().find((r) => r.id === chip.id);
        return request
          ? [
              {
                kind: "request",
                id: request.id,
                name: request.name,
                method: request.method,
                url: redactUrl(request.url, redact),
              },
            ]
          : [];
      }
      case "collection":
        return [
          {
            kind: "collection",
            ...describeCollection(
              store,
              { id: chip.id, name: chip.label },
              redact,
            ),
          },
        ];
      case "environment": {
        const env = store.environments().find((e) => e.id === chip.id);
        return env
          ? [{ kind: "environment", ...describeEnvironment(env, redact) }]
          : [];
      }
      default:
        return [{ kind: "chain", id: chip.id, name: chip.label }];
    }
  });
}

/**
 * Variable names and whether each has a value. Values appear only with
 * `shareValues`, and a secret's value is always `[redacted]` (FR-126, NFR-1).
 */
function describeEnvironment(env: EnvironmentModel, redact: RedactContext) {
  return {
    id: env.id,
    name: env.name,
    variables: env.variables.map((variable) => ({
      key: variable.key,
      isSecret: variable.isSecret,
      hasValue: variable.currentValue.trim() !== "",
      ...(redact.shareValues
        ? {
            value: variable.isSecret
              ? REDACTED
              : redactValue(variable.currentValue, redact),
          }
        : {}),
    })),
  };
}

/** Query-string secrets need the URL-aware redactor; the final text-pattern pass cannot see them (FR-60). */
function describeCollection(
  store: StoreAccess,
  collection: { id: string; name: string },
  redact: RedactContext,
) {
  const requests = store
    .requests()
    .filter((request) => request.collectionId === collection.id)
    .map((request) => ({ ...request, url: redactUrl(request.url, redact) }));
  return { ...collection, ...summarizeCollection(requests) };
}

function labelled({ id, name }: { id: string; name: string }) {
  return { id, label: name };
}

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

export function buildRelayContext(input: ContextInput): RelayContext {
  const {
    store,
    redact,
    removedChipKeys = [],
    activeChainId = null,
    attachedItems = [],
  } = input;
  const autoKeys = new Set(
    computeContextChips(store, activeChainId).map(chipKey),
  );
  const chips = selectActiveChips(
    computeContextChips(store, activeChainId, attachedItems),
    removedChipKeys,
    attachedItems,
  );
  const extras = describeAttached(store, chips, autoKeys, redact);
  const has = (kind: ContextChipKind) =>
    chips.some((chip) => chip.kind === kind);
  const active = describeActiveContext(store, redact);
  const environment = store
    .environments()
    .find((env) => env.id === active.environment?.id);

  const context: RelayContext = {
    workspace: summarizeWorkspace(store),
    chips,
    ...(extras.length > 0 ? { attached: extras } : {}),
    ...(has("request") && active.activeTab
      ? { activeTab: active.activeTab }
      : {}),
    ...(has("collection") && active.collection
      ? { collection: describeCollection(store, active.collection, redact) }
      : {}),
    ...(has("environment") && environment
      ? { environment: describeEnvironment(environment, redact) }
      : {}),
  };
  // Redaction last, so nothing added above can skip it (FR-60).
  return capToolResult(redactDeep(context, redact)) as RelayContext;
}

export type ChatPayload = {
  messages: UIMessage[];
  context: RelayContext;
};

/** Context plus history trimmed to whatever budget the context leaves (FR-50). */
export function buildChatPayload(
  input: ContextInput & { messages: UIMessage[] },
): ChatPayload {
  const context = buildRelayContext(input);
  const budget =
    RELAY_INPUT_TOKEN_BUDGET -
    FIXED_PROMPT_RESERVE_TOKENS -
    estimateTokens(JSON.stringify(context));
  return {
    messages: trimHistory(input.messages, Math.max(budget, 0)).messages,
    context,
  };
}
