import { useTabsStore } from "@/stores/useTabsStore";
import type { AuthConfig, KVPair, TabState } from "@/types";
import { commitChange, snapshotTabRequest } from "../changeLog";
import { RELAY_MESSAGE_LOG_CAP } from "../constants";
import { redactBody, redactUrl } from "../redact";
import type { ToolContext, ToolImpl, ToolOutcome } from "./registry";
import {
  secretPairProblem,
  toAuthConfig,
  toPair,
  urlProblem,
} from "./requestWrite";
import { type RelayToolInput, SOCKETIO_DEFAULT_EVENT } from "./schemas";
import { redactAuth, redactPairs, UNTRUSTED_NOTICE } from "./workspaceRead";

/**
 * GraphQL, WebSocket and Socket.IO tools. They only open and edit tabs: nothing
 * is saved to a collection, connected or sent, so the user stays in control of
 * the first network call (FR-140..145).
 */

const NOTHING_TO_CHANGE = "nothing to change: every field was null";
const DEFAULT_VARIABLES = "{}";
const KIND_LABEL = {
  graphql: "GraphQL",
  websocket: "WebSocket",
  socketio: "Socket.IO",
} as const;

const fail = (error: string): ToolOutcome => ({ ok: false, error });

const findTab = (tabId: string): TabState | undefined =>
  useTabsStore.getState().tabs.find((tab) => tab.tabId === tabId);

type HeaderInput = { key: string; value: string; enabled: boolean }[] | null;
type AuthInput = Parameters<typeof toAuthConfig>[0] | null;

/** The checks every kind shares: URL characters, literal secrets in headers and auth. */
function commonProblem(input: {
  url: string | null;
  headers: HeaderInput;
}): string | null {
  const urlIssue = input.url === null ? null : urlProblem(input.url);
  return urlIssue ?? secretPairProblem(input.headers ?? []);
}

function resolveAuth(auth: AuthInput): AuthConfig | string {
  return auth ? toAuthConfig(auth) : { type: "none" };
}

const toPairs = (headers: HeaderInput): KVPair[] =>
  (headers ?? []).map((header) => toPair(header));

/** Opens the tab through the change log; the new tab id is only known once it exists. */
async function openTabRequest(
  { write }: ToolContext,
  initial: Partial<TabState>,
): Promise<ToolOutcome> {
  let tabId = "";
  const kind = initial.type as keyof typeof KIND_LABEL;
  const outcome = await commitChange(write, {
    entity: "tabRequest",
    // Read after `mutate` runs, when openTab has assigned the id.
    get entityId() {
      return tabId;
    },
    summary: `Opened ${KIND_LABEL[kind]} tab "${initial.name}"`,
    before: null,
    mutate: () => {
      useTabsStore.getState().openTab(initial);
      tabId = useTabsStore.getState().activeTabId ?? "";
    },
  });
  return outcome.ok ? { ok: true, data: { ...outcome.data, tabId } } : outcome;
}

const createGraphqlRequest: ToolImpl<"create_graphql_request"> = {
  name: "create_graphql_request",
  run: async (input, context) => {
    const problem = commonProblem(input);
    if (problem) return fail(problem);
    const auth = resolveAuth(input.auth);
    if (typeof auth === "string") return fail(auth);
    return openTabRequest(context, {
      type: "graphql",
      name: input.name.trim(),
      url: input.url.trim(),
      query: input.query,
      variables: input.variables?.trim() || DEFAULT_VARIABLES,
      operationName: input.operationName ?? "",
      headers: toPairs(input.headers),
      auth,
    });
  },
};

const createWebsocketRequest: ToolImpl<"create_websocket_request"> = {
  name: "create_websocket_request",
  run: async (input, context) => {
    const problem = commonProblem(input);
    if (problem) return fail(problem);
    return openTabRequest(context, {
      type: "websocket",
      name: input.name.trim(),
      url: input.url.trim(),
      headers: toPairs(input.headers),
      draft: input.draft ?? "",
    });
  },
};

const createSocketioRequest: ToolImpl<"create_socketio_request"> = {
  name: "create_socketio_request",
  run: async (input, context) => {
    const problem = commonProblem(input);
    if (problem) return fail(problem);
    return openTabRequest(context, {
      type: "socketio",
      name: input.name.trim(),
      url: input.url.trim(),
      headers: toPairs(input.headers),
      draft: input.draft ?? "",
      eventName: input.eventName ?? SOCKETIO_DEFAULT_EVENT,
    });
  },
};

/* --------------------------------- update ---------------------------------- */

type UpdateInput = RelayToolInput<"update_tab_request">;

/** Only the fields that were given; null means "leave as it is". */
function buildPatch(input: UpdateInput): Record<string, unknown> | string {
  const name = input.name?.trim();
  if (name === "") return "name must not be empty";
  const problem = commonProblem(input);
  if (problem) return problem;
  const auth = input.auth === null ? undefined : toAuthConfig(input.auth);
  if (typeof auth === "string") return auth;

  const patch: Record<string, unknown> = {
    name,
    url: input.url?.trim(),
    headers: input.headers === null ? undefined : toPairs(input.headers),
    query: input.query ?? undefined,
    variables: input.variables?.trim() || undefined,
    operationName: input.operationName ?? undefined,
    auth,
    draft: input.draft ?? undefined,
    eventName: input.eventName ?? undefined,
  };
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );
}

function kindMismatch(tab: TabState, input: UpdateInput): string | null {
  if (tab.type === "http") {
    return "that tab is an HTTP request; use update_request for saved requests";
  }
  return tab.type === input.kind
    ? null
    : `tab ${input.tabId} is a ${tab.type} tab, not ${input.kind}`;
}

const updateTabRequest: ToolImpl<"update_tab_request"> = {
  name: "update_tab_request",
  run: async (input, { write }) => {
    const tab = findTab(input.tabId);
    if (!tab) return fail(`tab not found: ${input.tabId}`);
    const mismatch = kindMismatch(tab, input);
    if (mismatch) return fail(mismatch);
    const patch = buildPatch(input);
    if (typeof patch === "string") return fail(patch);
    if (Object.keys(patch).length === 0) return fail(NOTHING_TO_CHANGE);

    return commitChange(write, {
      entity: "tabRequest",
      entityId: tab.tabId,
      summary: `Updated ${KIND_LABEL[input.kind]} tab "${tab.name}"`,
      before: snapshotTabRequest(tab),
      mutate: () =>
        useTabsStore
          .getState()
          .updateTabState(tab.tabId, patch as Partial<TabState>),
    });
  },
};

/* ----------------------------------- read ---------------------------------- */

function describeMessages(tab: TabState & { type: "websocket" | "socketio" }) {
  const recent = tab.messageLog.slice(-RELAY_MESSAGE_LOG_CAP);
  return {
    totalMessages: tab.messageLog.length,
    untrusted: true,
    notice: UNTRUSTED_NOTICE,
    messages: recent.map(({ direction, data, timestamp }) => ({
      direction,
      data: redactBody(data),
      timestamp,
    })),
  };
}

const getTabRequest: ToolImpl<"get_tab_request"> = {
  name: "get_tab_request",
  run: ({ tabId }, { redact }) => {
    const tab = findTab(tabId);
    if (!tab) return fail(`tab not found: ${tabId}`);
    if (tab.type === "http") {
      return fail("that tab is an HTTP request; use get_request");
    }
    const base = {
      tabId: tab.tabId,
      kind: tab.type,
      name: tab.name,
      url: redactUrl(tab.url, redact),
      headers: redactPairs(tab.headers, redact),
    };
    if (tab.type === "graphql") {
      return {
        ok: true,
        data: {
          ...base,
          query: redactBody(tab.query, redact),
          variables: redactBody(tab.variables, redact),
          operationName: tab.operationName,
          auth: redactAuth(tab.auth, redact),
        },
      };
    }
    return {
      ok: true,
      data: {
        ...base,
        draft: redactBody(tab.draft ?? "", redact),
        ...(tab.type === "socketio"
          ? { eventName: tab.eventName ?? SOCKETIO_DEFAULT_EVENT }
          : {}),
        ...describeMessages(tab),
      },
    };
  },
};

export const tabRequestTools = [
  createGraphqlRequest,
  createWebsocketRequest,
  createSocketioRequest,
  updateTabRequest,
  getTabRequest,
] as const;
