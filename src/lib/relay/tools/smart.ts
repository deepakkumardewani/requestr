import { useHistoryStore } from "@/stores/useHistoryStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HistoryEntry, HttpTab, ResponseData } from "@/types";
import type { ChainAssertion } from "@/types/chain";
import { buildAssertions } from "../assertionBuilder";
import { commitChange, snapshotTabRequest } from "../changeLog";
import { buildCollectionDocs } from "../collectionDocs";
import { summarizeCollection } from "../collectionSummary";
import { buildCurl, type CurlDraft, parseCurl, templateSecrets } from "../curl";
import { diffResponses } from "../responseDiff";
import type { StoreAccess } from "../storeAccess";
import type { ToolContext, ToolImpl, ToolOutcome } from "./registry";
import { requestWriteTools } from "./requestWrite";
import type { RelayToolInput } from "./schemas";

/**
 * Smart tools (FR-194): curl import and export, response diff, generated
 * assertions and collection docs. Writes go through the change log or the
 * existing `create_request` tool, so every secret rule still applies.
 */

const fail = (error: string): ToolOutcome => ({ ok: false, error });
const ok = (data: unknown): ToolOutcome => ({ ok: true, data });

const REQUEST_NAME_MAX_CHARS = 80;
const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:\/\//i;

/* ---------------------------------- curl ----------------------------------- */

const createRequestTool = requestWriteTools.find(
  (tool) => tool.name === "create_request",
);

function requestNameFor(draft: CurlDraft): string {
  const target = draft.url.replace(SCHEME_PREFIX, "").split("?")[0];
  return `${draft.method} ${target}`.slice(0, REQUEST_NAME_MAX_CHARS);
}

function toAuthInput(auth: CurlDraft["basicAuth"]) {
  if (!auth) return null;
  return {
    type: "basic" as const,
    token: null,
    username: auth.username,
    password: auth.password,
    keyName: null,
    keyValue: null,
    addTo: null,
  };
}

type BodyInput = RelayToolInput<"create_request">["body"];

function toBodyInput(body: CurlDraft["body"]): BodyInput {
  if (!body) return null;
  const type =
    body.type === "json" || body.type === "urlencoded" ? body.type : "text";
  return { type, content: body.content };
}

const importCurl: ToolImpl<"import_curl"> = {
  name: "import_curl",
  refs: ({ collectionId }) =>
    collectionId ? [{ kind: "collection", id: collectionId }] : [],
  run: async ({ curl, collectionId }, context) => {
    if (!createRequestTool) return fail("the request writer is unavailable");
    const parsed = parseCurl(curl);
    if (!parsed.ok) return fail(parsed.error);
    const target = collectionId ?? context.store.collections()[0]?.id;
    if (!target) return fail("create a collection first, then import the curl");

    const { draft, needsValue } = templateSecrets(parsed.draft);
    const outcome = await (createRequestTool as ToolImpl<"create_request">).run(
      {
        collectionId: target,
        folderId: null,
        name: requestNameFor(draft),
        method: draft.method,
        url: draft.url,
        headers: draft.headers.map((h) => ({ ...h, enabled: true })),
        params: null,
        body: toBodyInput(draft.body),
        auth: toAuthInput(draft.basicAuth),
      },
      context,
    );
    if (!outcome.ok) return outcome;
    return ok({ ...(outcome.data as object), needsValue });
  },
};

const exportCurl: ToolImpl<"export_curl"> = {
  name: "export_curl",
  refs: ({ requestId }) => [{ kind: "request", id: requestId }],
  run: ({ requestId }, { store, redact }) => {
    const request = store.requests().find((item) => item.id === requestId);
    if (!request) return fail(`request not found: ${requestId}`);
    return ok({ name: request.name, curl: buildCurl(request, redact) });
  },
};

/* ------------------------------ response diff ------------------------------- */

/** Stored responses of one request, newest first. */
function storedResponses(requestId: string): ResponseData[] {
  return useHistoryStore
    .getState()
    .entries.filter(
      (entry: HistoryEntry) => entry.request.requestId === requestId,
    )
    .sort((x, y) => y.timestamp - x.timestamp)
    .map((entry) => entry.response);
}

const diffResponsesTool: ToolImpl<"diff_responses"> = {
  name: "diff_responses",
  refs: ({ requestId }) => [{ kind: "request", id: requestId }],
  run: ({ requestId, a, b }, { redact }) => {
    const responses = storedResponses(requestId);
    const missing = [a, b].find((index) => index >= responses.length);
    if (missing !== undefined) {
      return fail(
        `no stored response at position ${missing}: this request has ${responses.length}`,
      );
    }
    return ok(diffResponses(responses[a], responses[b], redact));
  },
};

/* ------------------------------- generate tests ------------------------------ */

const NO_RESPONSE = "this request has no response yet: send it first";
const NOTHING_NEW = "the request already has these assertions";

function openHttpTab(requestId: string): HttpTab | undefined {
  const { tabs, activeTabId } = useTabsStore.getState();
  const matches = tabs.filter(
    (tab): tab is HttpTab => tab.type === "http" && tab.requestId === requestId,
  );
  return matches.find((tab) => tab.tabId === activeTabId) ?? matches[0];
}

const signature = (a: ChainAssertion) =>
  [a.source, a.sourcePath ?? "", a.operator, a.expectedValue ?? ""].join("|");

function newAssertions(
  existing: readonly ChainAssertion[],
  generated: readonly ChainAssertion[],
) {
  const known = new Set(existing.map(signature));
  return generated.filter((item) => !known.has(signature(item)));
}

const generateTests: ToolImpl<"generate_tests"> = {
  name: "generate_tests",
  refs: ({ requestId }) => [{ kind: "request", id: requestId }],
  run: async ({ requestId }, { store, write }: ToolContext) => {
    const tab = openHttpTab(requestId);
    if (!tab) return fail("open the request in a tab first (use open_item)");
    const response = store.lastResponseFor(requestId);
    if (!response) return fail(NO_RESPONSE);
    const existing = tab.assertions ?? [];
    const added = newAssertions(existing, buildAssertions(response));
    if (added.length === 0) return fail(NOTHING_NEW);

    return commitChange(
      write,
      {
        entity: "tabRequest",
        entityId: tab.tabId,
        summary: `Added ${added.length} assertion${added.length === 1 ? "" : "s"} to "${tab.name}"`,
        before: snapshotTabRequest(tab),
        mutate: () =>
          useTabsStore
            .getState()
            .updateTabState(tab.tabId, { assertions: [...existing, ...added] }),
      },
      { requestId, added: added.length },
    );
  },
};

/* --------------------------------- docs -------------------------------------- */

function requestsInCollection(store: StoreAccess, collectionId: string) {
  return store.requests().filter((r) => r.collectionId === collectionId);
}

const generateDocs: ToolImpl<"generate_docs"> = {
  name: "generate_docs",
  refs: ({ collectionId }) => [{ kind: "collection", id: collectionId }],
  run: (
    { collectionId }: RelayToolInput<"generate_docs">,
    { store, redact },
  ) => {
    const collection = store.collections().find((c) => c.id === collectionId);
    if (!collection) return fail(`collection not found: ${collectionId}`);
    const summary = summarizeCollection(
      requestsInCollection(store, collectionId),
    );
    return ok({
      markdown: buildCollectionDocs(summary, {
        title: collection.name,
        redact,
      }),
    });
  },
};

export const smartTools = [
  importCurl,
  exportCurl,
  diffResponsesTool,
  generateTests,
  generateDocs,
] as const;
