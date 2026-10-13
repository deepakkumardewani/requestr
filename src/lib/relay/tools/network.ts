import { buildActiveEnvVars } from "@/lib/activeEnvVars";
import type { RunCounts, RunStatus } from "@/lib/chainRunHistory";
import { buildExecutionOrder, runChain } from "@/lib/chainRunner";
import type { ReferencedChainGraph } from "@/lib/chainRunner/executors/subchain";
import {
  controlFlowNodeIds,
  filterGraphByNodeIds,
  graphFromBlocks,
  graphNodeIds,
} from "@/lib/chainRunner/runGraph";
import {
  idleRunState,
  makeOnUpdate,
  makeRunStep,
  resolveNodeMeta,
  resolveScopedGraph,
  stepKey,
} from "@/lib/chainRunner/stepRecording";
import { sliceChain } from "@/lib/chainSlice";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "@/lib/constants";
import { runRequest } from "@/lib/requestRunner";
import { resolveHttpRequestTemplate } from "@/lib/resolveRequest";
import { generateId, interpolateVariables } from "@/lib/utils";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { RequestModel, ResponseData } from "@/types";
import type { ChainNodeState, ChainRunState } from "@/types/chain";
import { createZustandWorkspaceWriter } from "../changeLog";
import { type RedactContext, redactValue } from "../redact";
import type { StoreAccess } from "../storeAccess";
import type { ConfirmPreview, ToolImpl, ToolOutcome } from "./registry";
import { hasAllowedScheme } from "./requestWrite";
import {
  describeBody,
  describeResponseSummary,
  UNTRUSTED_NOTICE,
} from "./workspaceRead";

/**
 * Network tools (SPEC section 5). Both need Approve first, and both reach the
 * network only through a `NetworkPort`, so a test can prove that nothing was
 * sent before the user said yes (FR-42).
 */

/** Failed steps listed back to the model; the rest are only counted. */
const FAILED_STEPS_MAX = 5;
const STEP_ERROR_CHARS = 200;
const NETWORK_UNAVAILABLE = "the network is not available right now";
const STOPPED = "stopped by the user";
const SCHEME_REFUSED =
  "the address does not resolve to an http, https, ws or wss URL, so it was not sent";

/** Transport and step errors can echo a URL or header, so they are scrubbed before the model sees them. */
function scrubbedMessage(
  error: unknown,
  fallback: string,
  redact: RedactContext,
): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? redactValue(message, redact) : fallback;
}

export type ChainRunReport = {
  status: RunStatus;
  counts: RunCounts;
  failed: { nodeId: string; label: string; error: string }[];
};

export interface NetworkPort {
  /** Sends a saved request the way the Send button would and records the response. */
  send(requestId: string, signal?: AbortSignal): Promise<ResponseData>;
  runChain(options: {
    chainId: string;
    fromNodeId: string | null;
    signal: AbortSignal;
  }): Promise<ChainRunReport>;
}

const fail = (error: string): ToolOutcome => ({ ok: false, error });

const HOST_PATTERN = /^(?:[a-z][a-z0-9+.-]*:)?\/\/(?:[^/?#@]*@)?([^/?#]*)/i;

/** `host[:port]` of a URL, or null for a relative or unparseable one. */
export function hostOf(url: string): string | null {
  return HOST_PATTERN.exec(url.trim())?.[1].toLowerCase() || null;
}

function activeVariables(store: StoreAccess): Record<string, string> {
  return buildActiveEnvVars(
    [...store.environments()],
    store.activeEnvironmentId(),
  );
}

function activeEnvironmentName(store: StoreAccess): string | null {
  const activeId = store.activeEnvironmentId();
  return store.environments().find((env) => env.id === activeId)?.name ?? null;
}

/** Describes where a request will really go, from live state, never from model text. */
function describeSend(request: RequestModel, store: StoreAccess) {
  const host = hostOf(
    interpolateVariables(request.url, activeVariables(store)),
  );
  const lastUrl = store.lastResponseFor(request.id)?.url;
  const previousHost = lastUrl ? hostOf(lastUrl) : null;
  return { host, previousHost, environment: activeEnvironmentName(store) };
}

const sendRequest: ToolImpl<"send_request"> = {
  name: "send_request",
  refs: ({ requestId }) => [{ kind: "request", id: requestId }],
  describe: ({ requestId }, store): ConfirmPreview => {
    const request = store.requests().find((item) => item.id === requestId);
    if (!request) {
      return { action: "send", severity: "caution", targets: [], count: 0 };
    }
    const { host, previousHost, environment } = describeSend(request, store);
    const hostDiffers = previousHost !== null && host !== previousHost;
    return {
      action: "send",
      severity: "caution",
      targets: [request.name],
      count: 1,
      method: request.method,
      host: host ?? undefined,
      ...(hostDiffers ? { previousHost: previousHost ?? undefined } : {}),
      hostDiffers,
      environment,
    };
  },
  run: async ({ requestId }, { network, signal, redact, store }) => {
    if (!network) return fail(NETWORK_UNAVAILABLE);
    const saved = store.requests().find((item) => item.id === requestId);
    // An environment variable can turn a safe-looking template into file: or javascript:.
    if (
      saved &&
      !hasAllowedScheme(interpolateVariables(saved.url, activeVariables(store)))
    ) {
      return fail(SCHEME_REFUSED);
    }
    try {
      const response = await network.send(requestId, signal);
      return {
        ok: true,
        data: {
          requestId,
          untrusted: true,
          notice: UNTRUSTED_NOTICE,
          ...describeResponseSummary(response, redact),
          body: describeBody(response, redact),
        },
      };
    } catch (error) {
      if (signal?.aborted) return fail(STOPPED);
      return fail(scrubbedMessage(error, "the request failed", redact));
    }
  },
};

function chainNodeName(store: StoreAccess, nodeId: string): string {
  return store.requests().find((item) => item.id === nodeId)?.name ?? nodeId;
}

function chainHasNode(
  store: StoreAccess,
  chainId: string,
  nodeId: string,
): boolean {
  const chain = store.chains().find((item) => item.id === chainId);
  return (
    chain !== undefined &&
    (chain.nodeIds.includes(nodeId) ||
      chain.blocks.some((block) => block.id === nodeId))
  );
}

const runChainTool: ToolImpl<"run_chain"> = {
  name: "run_chain",
  refs: ({ chainId }) => [{ kind: "chain", id: chainId }],
  describe: ({ chainId, fromNodeId }, store): ConfirmPreview => {
    const chain = store.chains().find((item) => item.id === chainId);
    return {
      action: "run",
      severity: "caution",
      targets: chain ? [chain.name] : [],
      count: chain ? 1 : 0,
      environment: activeEnvironmentName(store),
      ...(fromNodeId ? { fromNode: chainNodeName(store, fromNodeId) } : {}),
    };
  },
  run: async ({ chainId, fromNodeId }, { store, network, signal, redact }) => {
    if (!network) return fail(NETWORK_UNAVAILABLE);
    if (fromNodeId && !chainHasNode(store, chainId, fromNodeId)) {
      return fail(`node not found: ${fromNodeId}`);
    }
    const controller = signal ?? new AbortController().signal;
    try {
      const report = await network.runChain({
        chainId,
        fromNodeId,
        signal: controller,
      });
      const failed = report.failed.map((step) => ({
        ...step,
        error: redactValue(step.error, redact),
      }));
      return {
        ok: true,
        data: { chainId, untrusted: true, ...report, failed },
      };
    } catch (error) {
      if (controller.aborted) return fail(STOPPED);
      return fail(scrubbedMessage(error, "the chain failed", redact));
    }
  },
};

export const networkTools = [sendRequest, runChainTool] as const;

/* ------------------------------ production port ----------------------------- */

function requireRequest(requestId: string): RequestModel {
  const request = useCollectionsStore
    .getState()
    .requests.find((item) => item.id === requestId);
  if (!request) throw new Error(`request not found: ${requestId}`);
  return request;
}

/** The response goes where the Send button puts it: the request's tab and history. */
async function sendSavedRequest(
  requestId: string,
  signal?: AbortSignal,
): Promise<ResponseData> {
  const request = requireRequest(requestId);
  const { resolveVariables } = useEnvironmentsStore.getState();
  const settings = useSettingsStore.getState();
  const { resolvedRequest, unresolvedVars } = resolveHttpRequestTemplate(
    {
      url: request.url,
      headers: request.headers,
      params: request.params,
      body: request.body,
      globalHeaders: settings.globalHeaders,
      globalBaseUrl: settings.globalBaseUrl,
    },
    resolveVariables,
  );
  if (unresolvedVars.length > 0) {
    throw new Error(`unresolved variables: ${unresolvedVars.join(", ")}`);
  }
  // Scripts are not run: the model must not be able to execute code by sending.
  const response = await runRequest(
    {
      method: request.method,
      url: resolvedRequest.url,
      headers: resolvedRequest.headers,
      body: resolvedRequest.body,
      auth: request.auth,
      sslVerify: request.sslVerify ?? settings.sslVerify,
      followRedirects: request.followRedirects ?? settings.followRedirects,
      timeoutMs: request.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    },
    signal,
  );
  const tabId = createZustandWorkspaceWriter().openRequest(request);
  useResponseStore.getState().setResponse(tabId, response);
  const tab = useTabsStore
    .getState()
    .tabs.find((item) => item.tabId === tabId && item.type === "http");
  if (tab?.type === "http") {
    useHistoryStore.getState().addEntry({
      id: generateId(),
      method: request.method,
      url: resolvedRequest.url,
      status: response.status,
      duration: response.duration,
      size: response.size,
      timestamp: response.timestamp,
      request: tab,
      response,
    });
  }
  return response;
}

function emptyCounts(): RunCounts {
  return { passed: 0, failed: 0, skipped: 0, aborted: 0 };
}

const COUNT_KEY: Partial<Record<ChainNodeState, keyof RunCounts>> = {
  passed: "passed",
  failed: "failed",
  skipped: "skipped",
  aborted: "aborted",
};

function finalStatus(signal: AbortSignal, counts: RunCounts): RunStatus {
  if (signal.aborted) return "stopped";
  return counts.failed > 0 ? "failed" : "passed";
}

/** Runs a chain through the same store entry points as the chain page's Run button. */
async function runSavedChain({
  chainId,
  fromNodeId,
  signal,
}: {
  chainId: string;
  fromNodeId: string | null;
  signal: AbortSignal;
}): Promise<ChainRunReport> {
  const chains = useChainStore.getState().chains;
  const chain = chains[chainId];
  if (!chain) throw new Error(`chain not found: ${chainId}`);
  const runs = useChainRunStore.getState();
  if (runs.abortControllers[chainId])
    throw new Error("the chain is already running");

  const all = useCollectionsStore.getState().requests;
  const requests = chain.nodeIds
    .map((id) => all.find((item) => item.id === id))
    .filter((item): item is RequestModel => item !== undefined);
  const fullGraph = graphFromBlocks(chain.blocks, requests, chain.edges);
  let graph = fullGraph;
  if (fromNodeId) {
    const order = buildExecutionOrder(
      requests,
      chain.edges,
      controlFlowNodeIds(fullGraph),
    );
    const ids = sliceChain(order, fromNodeId, "fromHere");
    if (!ids) throw new Error(`node not found: ${fromNodeId}`);
    graph = filterGraphByNodeIds(fullGraph, ids);
  }

  const resolveSubChainGraph = (
    id: string,
  ): ReferencedChainGraph | undefined => {
    const referenced = chains[id];
    if (!referenced) return undefined;
    const nodes = referenced.nodeIds
      .map((nodeId) => all.find((item) => item.id === nodeId))
      .filter((item): item is RequestModel => item !== undefined);
    return {
      ...graphFromBlocks(referenced.blocks, nodes, referenced.edges),
      nodeAssertions: referenced.nodeAssertions,
    };
  };

  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();

  let liveState: ChainRunState = idleRunState(graphNodeIds(graph));
  const counts = emptyCounts();
  const failed: ChainRunReport["failed"] = [];
  const startedAt = new Map<string, number>();
  runs.setRunState(chainId, liveState);
  runs.startRun(chainId, fromNodeId ? "fromHere" : "full", {
    abortController: controller,
    anchorNodeId: fromNodeId ?? undefined,
  });

  const onUpdate = makeOnUpdate({
    setRunState: (update) => {
      liveState = update(liveState);
      useChainRunStore.getState().setRunState(chainId, liveState);
    },
    onFailed: () => {},
    recordStep: (nodeId, state, data) => {
      const key = stepKey(nodeId, data);
      if (state === "running") startedAt.set(key, Date.now());
      const scoped = resolveScopedGraph(graph, data, resolveSubChainGraph);
      useChainRunStore.getState().recordStep(
        makeRunStep({
          nodeId,
          state,
          data,
          meta: resolveNodeMeta(nodeId, scoped),
          request: scoped.requests.find((item) => item.id === nodeId),
          startedAt: startedAt.get(key) ?? Date.now(),
        }),
      );
      const countKey = COUNT_KEY[state];
      if (!countKey || data.parentStepId) return;
      counts[countKey] += 1;
      if (state === "failed" && failed.length < FAILED_STEPS_MAX) {
        failed.push({
          nodeId,
          label: resolveNodeMeta(nodeId, scoped).label,
          error: (data.error ?? "").slice(0, STEP_ERROR_CHARS),
        });
      }
    },
  });

  const environments = useEnvironmentsStore.getState();
  try {
    await runChain({
      ...graph,
      nodeAssertions: chain.nodeAssertions,
      resolveVariables: environments.resolveVariables,
      envVars: buildActiveEnvVars(
        environments.environments,
        environments.activeEnvId,
      ),
      concurrency: useUIStore.getState().chainConcurrency,
      resolveSubChainGraph,
      onUpdate,
      signal: controller.signal,
    });
  } finally {
    signal.removeEventListener("abort", stop);
    await useChainRunStore
      .getState()
      .finishRun(finalStatus(controller.signal, counts));
  }
  return { status: finalStatus(controller.signal, counts), counts, failed };
}

export function createBrowserNetworkPort(): NetworkPort {
  return { send: sendSavedRequest, runChain: runSavedChain };
}
