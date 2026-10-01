import { firstJsonPathMatch, tryParseJson } from "@/lib/chainJson";
import type { BodyConfig, RequestModel } from "@/types";
import type { ChainEdge, ChainInjection, ChainNodeState } from "@/types/chain";
import { CHAIN_HANDLE_IDS } from "@/types/chain";
import {
  CHAIN_ERROR_CODE,
  type ChainErrorCode,
  chainError,
  formatFallbackMessage,
} from "./errorCodes";
import type { ExecutionContext } from "./types";

/**
 * Error thrown when injection fails (e.g., body is not JSON). Carries the
 * typed code the executor records; `message` is its English fallback.
 */
export class InjectionError extends Error {
  readonly code: ChainErrorCode;

  constructor(code: ChainErrorCode) {
    super(formatFallbackMessage(code));
    this.name = "InjectionError";
    this.code = code;
  }
}

/**
 * Ids that sit on a directed cycle: members of a strongly connected component
 * (Tarjan) with more than one node, or a self-loop. Nodes merely downstream of
 * a cycle are not returned. Edges to unknown ids are ignored.
 */
export function findCyclicNodeIds(
  ids: readonly string[],
  edges: readonly ChainEdge[],
): string[] {
  const known = new Set(ids);
  const adjacency = new Map<string, string[]>(ids.map((id) => [id, []]));
  const selfLoops = new Set<string>();
  for (const { sourceRequestId: src, targetRequestId: tgt } of edges) {
    if (!known.has(src) || !known.has(tgt)) continue;
    adjacency.get(src)?.push(tgt);
    if (src === tgt) selfLoops.add(src);
  }

  const index = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cyclic = new Set<string>();

  const visit = (node: string): void => {
    index.set(node, index.size);
    lowLink.set(node, index.get(node) ?? 0);
    stack.push(node);
    onStack.add(node);
    for (const next of adjacency.get(node) ?? []) {
      if (!index.has(next)) {
        visit(next);
        lowLink.set(
          node,
          Math.min(lowLink.get(node) ?? 0, lowLink.get(next) ?? 0),
        );
      } else if (onStack.has(next)) {
        lowLink.set(
          node,
          Math.min(lowLink.get(node) ?? 0, index.get(next) ?? 0),
        );
      }
    }
    if (lowLink.get(node) !== index.get(node)) return;
    const component: string[] = [];
    let member: string | undefined;
    do {
      member = stack.pop();
      if (member === undefined) break;
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    if (component.length > 1 || selfLoops.has(node)) {
      for (const id of component) cyclic.add(id);
    }
  };

  for (const id of ids) if (!index.has(id)) visit(id);
  return ids.filter((id) => cyclic.has(id));
}

/**
 * True when an edge should be treated as carrying upstream response data
 * (rather than pure control-flow routing). API nodes' own "success"/"fail"
 * handles still gate which path runs, but the data on that path is real
 * response data and must remain available to downstream extraction —
 * only routing edges from condition-node branches (arbitrary branch ids)
 * are excluded.
 */
export function isExtractionEdge(edge: ChainEdge): boolean {
  return (
    !edge.branchId ||
    edge.branchId === CHAIN_HANDLE_IDS.SUCCESS ||
    edge.branchId === CHAIN_HANDLE_IDS.FAIL
  );
}

/** Minimal slice of a node's final run state that edge routing depends on. */
export type EdgeSourceState = {
  state: ChainNodeState;
  activeBranchId?: string;
};

/**
 * Whether an edge carries execution forward given its source's final state:
 * an unresolved or skipped source never does; `success` / `fail` handles follow
 * only a passed / failed source; on any other edge a failed source blocks; and
 * a routing edge from a Condition follows only the winning branch.
 * Single source of truth for the ordinary skip rule and Merge lane routing.
 */
export function isEdgeActive(
  edge: ChainEdge,
  srcState: EdgeSourceState | undefined,
): boolean {
  if (!srcState || srcState.state === "skipped") return false;
  if (edge.branchId === CHAIN_HANDLE_IDS.SUCCESS)
    return srcState.state === "passed";
  if (edge.branchId === CHAIN_HANDLE_IDS.FAIL)
    return srcState.state === "failed";
  if (srcState.state === "failed") return false;
  if (edge.branchId !== undefined && srcState.activeBranchId !== undefined) {
    return srcState.activeBranchId === edge.branchId;
  }
  return true;
}

/**
 * Extract a value from a JSON string using a JSONPath expression.
 * Returns null if extraction fails.
 */
export function extractJsonPath(
  responseBody: string,
  jsonPath: string,
): string | null {
  const parsed = tryParseJson(responseBody, undefined);
  const match = firstJsonPathMatch(parsed, jsonPath);
  return match === undefined ? null : String(match);
}

/** Body types whose content is JSON text, so a key path can be written into it. */
const JSON_INJECTABLE_BODY_TYPES: ReadonlyArray<BodyConfig["type"]> = ["json"];

/** Parses JSON body text; an empty body is treated as `{}` so it can be populated. */
function parseJsonBody(content: string | undefined): Record<string, unknown> {
  const text = content?.trim() || "{}";
  let parsed: unknown;
  // Only the parse is guarded: a failure below is a bug, not "body is not JSON".
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InjectionError(CHAIN_ERROR_CODE.INJECTION_BODY_NOT_JSON);
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new InjectionError(CHAIN_ERROR_CODE.INJECTION_BODY_NOT_JSON);
  }
  return parsed as Record<string, unknown>;
}

function injectIntoJsonBody(
  body: BodyConfig,
  targetKey: string,
  value: string,
): BodyConfig {
  if (!JSON_INJECTABLE_BODY_TYPES.includes(body.type)) {
    throw new InjectionError(CHAIN_ERROR_CODE.INJECTION_BODY_TYPE_UNSUPPORTED);
  }
  const bodyObj = parseJsonBody(body.content);
  const keys = targetKey.replace(/^\$\./, "").split(".");
  let obj = bodyObj;
  for (const key of keys.slice(0, -1)) {
    const next = obj[key];
    if (typeof next !== "object" || next === null) obj[key] = {};
    obj = obj[key] as Record<string, unknown>;
  }
  obj[keys[keys.length - 1]] = value;
  return { ...body, content: JSON.stringify(bodyObj, null, 2) };
}

/**
 * Apply a single injection mapping to a request, returning a mutated copy.
 */
export function applyInjection(
  request: RequestModel,
  injection: ChainInjection,
  value: string,
  targetUrl?: string,
): RequestModel {
  const req = JSON.parse(JSON.stringify(request)) as RequestModel; // deep clone

  if (injection.targetField === "header") {
    const existing = req.headers.find((h) => h.key === injection.targetKey);
    if (existing) {
      existing.value = value;
    } else {
      req.headers.push({
        id: crypto.randomUUID(),
        key: injection.targetKey,
        value,
        enabled: true,
      });
    }
  } else if (injection.targetField === "url") {
    const separator = req.url.includes("?") ? "&" : "?";
    req.url = `${req.url}${separator}${encodeURIComponent(injection.targetKey)}=${encodeURIComponent(value)}`;
  } else if (injection.targetField === "path") {
    const baseUrl = targetUrl ?? req.url;
    const placeholder = `:${injection.targetKey}`;
    if (baseUrl.includes(placeholder)) {
      req.url = baseUrl.replace(placeholder, encodeURIComponent(value));
    } else {
      req.url = `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(value)}`;
    }
  } else if (injection.targetField === "body") {
    req.body = injectIntoJsonBody(req.body, injection.targetKey, value);
  }

  return req;
}

/**
 * Early-abort guard for executors: when the run was stopped before this node
 * started, record it as aborted (same shape a mid-request abort produces) so
 * no request is sent, no condition evaluated and no env promotion fired.
 * Returns true when the caller should stop.
 */
export function recordIfAborted(
  context: Pick<
    ExecutionContext,
    "nodeId" | "runState" | "onUpdate" | "options"
  >,
): boolean {
  const { nodeId, runState, onUpdate, options } = context;
  if (!options.signal.aborted) return false;
  const failure = chainError(CHAIN_ERROR_CODE.RUN_STOPPED);
  runState[nodeId] = {
    state: "aborted",
    extractedValues: {},
    error: failure.error,
  };
  onUpdate(nodeId, "aborted", { ...failure });
  return true;
}
