import type {
  RunStep,
  RunSummary,
  SerialisedRequest,
  SerialisedResponse,
} from "@/lib/chainRunHistory";
import { truncateBody } from "@/lib/chainRunHistory";
import type { KVPair, RequestModel, ResponseData } from "@/types";
import type {
  ChainNodeState,
  ChainNodeType,
  ChainRunState,
  SubChainBlock,
} from "@/types/chain";
import { parentStepKey, stepFrames, stepKey } from "./nesting";
import type { ChainGraph } from "./runGraph";
import type { OnUpdateFn } from "./types";

export { stepKey };

export type NodeUpdateData = Parameters<OnUpdateFn>[2];

export type NodeMeta = { nodeType: ChainNodeType; label: string };

/** The graph fields `resolveNodeMeta` searches; a `ReferencedChainGraph` satisfies it too. */
export type NodeMetaGraph = Pick<ChainGraph, "requests" | "startBlock"> &
  Partial<
    Pick<
      ChainGraph,
      | "delayNodes"
      | "conditionNodes"
      | "displayNodes"
      | "evaluateNodes"
      | "validateNodes"
      | "mergeNodes"
      | "loopNodes"
      | "collectNodes"
      | "subChainBlocks"
    >
  >;

/** Block collections in lookup order paired with the label shown in run history. */
function metaLookups(
  graph: NodeMetaGraph,
): ReadonlyArray<
  readonly [ChainNodeType, string, ReadonlyArray<{ id: string }> | undefined]
> {
  return [
    ["delay", "Delay", graph.delayNodes],
    ["condition", "Condition", graph.conditionNodes],
    ["display", "Display", graph.displayNodes],
    ["evaluate", "Evaluate", graph.evaluateNodes],
    ["validate", "Validate", graph.validateNodes],
    ["merge", "Merge", graph.mergeNodes],
    ["loop", "Loop", graph.loopNodes],
    ["collect", "Collect", graph.collectNodes],
    ["subchain", "Sub-chain", graph.subChainBlocks],
  ];
}

/**
 * The graph a step's `nodeId` belongs to: the host graph, re-pointed at the
 * referenced chain for every Sub-chain frame the step is nested under
 * (outermost first). Loop frames share their enclosing graph. An unresolvable
 * reference keeps the enclosing graph so the step still records, labelled by id.
 */
export function resolveScopedGraph(
  host: NodeMetaGraph,
  data: Pick<NodeUpdateData, "parentStepId" | "iteration" | "scope">,
  resolveSubChainGraph: (chainId: string) => NodeMetaGraph | undefined,
): NodeMetaGraph {
  let graph = host;
  for (const frame of [...stepFrames(data)].reverse()) {
    const block: SubChainBlock | undefined = graph.subChainBlocks?.find(
      (b) => b.id === frame.parentStepId,
    );
    if (block) graph = resolveSubChainGraph(block.chainId) ?? graph;
  }
  return graph;
}

export function resolveNodeMeta(
  nodeId: string,
  graph: NodeMetaGraph,
): NodeMeta {
  const req = graph.requests.find((r) => r.id === nodeId);
  if (req) return { nodeType: "api", label: req.name };
  for (const [nodeType, label, nodes] of metaLookups(graph)) {
    if (nodes?.some((n) => n.id === nodeId)) return { nodeType, label };
  }
  if (graph.startBlock?.id === nodeId) {
    return { nodeType: "start", label: "Start" };
  }
  return { nodeType: "api", label: nodeId };
}

/** Shown in place of a secret value persisted to run history. */
export const REDACTED_VALUE = "[REDACTED]";

/** Lower-case header names whose values are credentials and must never reach run history. */
export const SENSITIVE_HEADER_NAMES: ReadonlySet<string> = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "x-auth-token",
]);

/** Lower-case query-parameter names that conventionally carry credentials. */
export const SENSITIVE_QUERY_PARAMS: ReadonlySet<string> = new Set([
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "key",
  "token",
  "auth",
  "password",
  "secret",
  "client_secret",
  "signature",
  "sig",
]);

const QUERY_PARAM_PATTERN = /([?&])([^=&#]+)=([^&#]*)/g;

/** Masks credential-bearing values but keeps header names so the shape stays readable. */
function redactHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      SENSITIVE_HEADER_NAMES.has(name.toLowerCase()) ? REDACTED_VALUE : value,
    ]),
  );
}

/** Masks values of credential-like query params; the rest of the URL stays intact. */
function redactUrl(url: string): string {
  return url.replace(
    QUERY_PARAM_PATTERN,
    (match, separator: string, name: string) =>
      SENSITIVE_QUERY_PARAMS.has(name.toLowerCase())
        ? `${separator}${name}=${REDACTED_VALUE}`
        : match,
  );
}

/**
 * Persists a request's method/url/enabled headers and (size-capped) body.
 * Resolved requests have `{{env}}` secrets substituted, so credentials are
 * redacted here — the single choke point every recorded request passes through.
 */
export function serialiseHttpRequest(request: {
  method: RequestModel["method"];
  url: string;
  headers: KVPair[];
  body?: string;
}): SerialisedRequest {
  const body = request.body ? truncateBody(request.body).body : undefined;
  return {
    method: request.method,
    url: redactUrl(request.url),
    headers: redactHeaders(
      Object.fromEntries(
        request.headers.filter((h) => h.enabled).map((h) => [h.key, h.value]),
      ),
    ),
    body,
  };
}

function serialiseRequest(req?: RequestModel): SerialisedRequest | undefined {
  if (!req) return undefined;
  return serialiseHttpRequest({ ...req, body: req.body?.content });
}

function serialiseResponse(
  response?: ResponseData,
): SerialisedResponse | undefined {
  if (!response) return undefined;
  const { body, truncated } = truncateBody(response.body);
  return {
    ...response,
    headers: redactHeaders(response.headers),
    body,
    truncated,
  };
}

type RunStepInput = {
  nodeId: string;
  state: ChainNodeState;
  data: NodeUpdateData;
  meta: NodeMeta;
  request: RequestModel | undefined;
  startedAt: number;
};

export function makeRunStep({
  nodeId,
  state,
  data,
  meta,
  request,
  startedAt,
}: RunStepInput): RunStep {
  return {
    // Stable per-(node, iteration) id so `recordStep` can upsert the
    // running → terminal transition into a single row instead of appending
    // a duplicate, while keeping loop-body iterations from colliding.
    id: stepKey(nodeId, data),
    nodeId,
    nodeType: meta.nodeType,
    label: meta.label,
    state,
    startedAt,
    durationMs: Math.max(0, Date.now() - startedAt),
    // Prefer the request the executor actually sent; the template is only a
    // fallback for steps that never reached the wire (skipped, injection failed).
    request: data.request ?? serialiseRequest(request),
    response: serialiseResponse(data.response),
    error: data.error,
    errorCode: data.errorCode,
    errorParams: data.errorParams,
    errorKind: data.errorKind,
    assertionResults: data.assertionResults,
    assertions: data.assertions,
    inputs: data.inputs,
    warnings: data.warnings,
    extractedValues: data.extractedValues ?? {},
    unresolvedVars: data.unresolvedVars ?? [],
    parentStepId: parentStepKey(data),
    iteration: data.iteration,
  };
}

/** Latest state per node, derived from a persisted run's steps (execution order). */
export function deriveRunStateFromSteps(steps: RunStep[]): ChainRunState {
  const next: ChainRunState = {};
  for (const step of steps) {
    next[step.nodeId] = {
      state: step.state,
      extractedValues: (step.extractedValues ?? {}) as Record<
        string,
        string | null
      >,
      response: step.response,
      error: step.error,
      errorCode: step.errorCode,
      errorParams: step.errorParams,
      errorKind: step.errorKind,
      assertionResults: step.assertionResults,
      unresolvedVars: step.unresolvedVars,
    };
  }
  return next;
}

export function pickLatestRun(runs: RunSummary[]): RunSummary | undefined {
  return [...runs].sort((a, b) => b.startedAt - a.startedAt)[0];
}

/**
 * Every node starts a run as `idle` so the canvas can reset colours before the
 * first update arrives. Takes ids (not nodes) because partial runs only ever
 * hold an id subset; full runs pass `graphNodeIds(graph)`.
 */
export function idleRunState(ids: Iterable<string>): ChainRunState {
  const initial: ChainRunState = {};
  for (const id of ids) {
    initial[id] = { state: "idle", extractedValues: {} };
  }
  return initial;
}

type OnUpdateSinks = {
  setRunState: (updater: (prev: ChainRunState) => ChainRunState) => void;
  recordStep: (
    nodeId: string,
    state: ChainNodeState,
    data: NodeUpdateData,
  ) => void;
  onFailed: () => void;
};

/**
 * The single `runChain` `onUpdate` used by every run entry point: mirrors the
 * update into live `runState`, records it in run history, and flags failures.
 */
export function makeOnUpdate({
  setRunState,
  recordStep,
  onFailed,
}: OnUpdateSinks): OnUpdateFn {
  return (nodeId, state, data) => {
    if (state === "failed") onFailed();
    setRunState((prev) => ({
      ...prev,
      [nodeId]: {
        state,
        extractedValues: data.extractedValues ?? {},
        response: data.response,
        error: data.error,
        errorCode: data.errorCode,
        errorParams: data.errorParams,
        errorKind: data.errorKind,
        assertionResults: data.assertionResults,
        activeBranchId: data.activeBranchId,
        unresolvedVars: data.unresolvedVars,
      },
    }));
    recordStep(nodeId, state, data);
  };
}
