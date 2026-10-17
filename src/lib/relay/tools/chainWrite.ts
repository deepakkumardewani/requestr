import {
  getMultiInboundDisplayIds,
  hasLoopNestingViolation,
} from "@/components/chain/canvas/hooks/chainConnectionRules";
import {
  buildExecutionOrder,
  CircularDependencyError,
} from "@/lib/chainRunner";
import { generateId } from "@/lib/utils";
import { buildEdgeForNewNode, createEmptyChain } from "@/stores/useChainStore";
import type {
  Chain,
  ChainBlock,
  ChainEdge,
  ChainNodeState,
  ChainRunState,
  ConditionBranch,
} from "@/types/chain";
import {
  CHAIN_HANDLE_IDS,
  LOOP_BODY_HANDLE_ID,
  LOOP_DONE_HANDLE_ID,
  LOOP_MAX_ITERATIONS_DEFAULT,
} from "@/types/chain";
import { commitChange } from "../changeLog";
import { type RedactContext, redactUrl, redactValue } from "../redact";
import type { StoreAccess } from "../storeAccess";
import type { ToolImpl, ToolOutcome } from "./registry";
import type { RelayToolInput } from "./schemas";
import { UNTRUSTED_NOTICE } from "./workspaceRead";

/**
 * Chain tools (SPEC section 5). Reads shape the chain for the model; the write
 * tools below auto-apply through the change log, replacing the whole chain so
 * one snapshot undoes any chain edit (FR-41, FR-44).
 */

const ok = (data: unknown): ToolOutcome => ({ ok: true, data });
const fail = (error: string): ToolOutcome => ({ ok: false, error });

const STEP_ERROR_CHARS = 200;

function findChain(store: StoreAccess, chainId: string): Chain | undefined {
  return store.chains().find((chain) => chain.id === chainId);
}

/* ---------------------------------- reads ---------------------------------- */

/** Everything a block exposes to the model; request-bearing snapshots drop headers, auth and body. */
function describeBlock(block: ChainBlock, redact: RedactContext) {
  switch (block.type) {
    case "history":
      return {
        id: block.id,
        type: "request",
        name: block.name,
        method: block.method,
        url: redactUrl(block.url, redact),
        saved: false,
      };
    case "start":
      return {
        id: block.id,
        type: block.type,
        inputs: block.inputs.map((input) => input.key),
      };
    case "evaluate":
      return { id: block.id, type: block.type, outputAlias: block.outputAlias };
    case "subchain":
      return {
        id: block.id,
        type: block.type,
        chainId: block.chainId,
        inputBindings: Object.keys(block.inputBindings),
      };
    default:
      return { ...block };
  }
}

function describeRequestNode(
  store: StoreAccess,
  requestId: string,
  redact: RedactContext,
) {
  const request = store.requests().find((item) => item.id === requestId);
  return {
    id: requestId,
    type: "request",
    name: request?.name ?? requestId,
    method: request?.method ?? null,
    url: request ? redactUrl(request.url, redact) : null,
    saved: true,
  };
}

function describeEdge(edge: ChainEdge) {
  return {
    id: edge.id,
    from: edge.sourceRequestId,
    to: edge.targetRequestId,
    handle: edge.branchId ?? null,
    injections: edge.injections.filter(
      (injection) => injection.sourceJsonPath || injection.targetKey,
    ),
  };
}

function describeAssertions(chain: Chain, redact: RedactContext) {
  return Object.entries(chain.nodeAssertions ?? {}).map(
    ([nodeId, assertions]) => ({
      nodeId,
      assertions: assertions.map((assertion) => ({
        id: assertion.id,
        source: assertion.source,
        sourcePath: assertion.sourcePath ?? null,
        operator: assertion.operator,
        expectedValue: redactValue(assertion.expectedValue ?? "", redact),
        enabled: assertion.enabled,
      })),
    }),
  );
}

function describeChain(
  store: StoreAccess,
  chain: Chain,
  redact: RedactContext,
) {
  return {
    id: chain.id,
    name: chain.name,
    scope: chain.scope,
    collectionId: chain.collectionId ?? null,
    nodes: [
      ...chain.nodeIds.map((id) => describeRequestNode(store, id, redact)),
      ...chain.blocks.map((block) => describeBlock(block, redact)),
    ],
    edges: chain.edges.map(describeEdge),
    assertions: describeAssertions(chain, redact),
  };
}

const getChain: ToolImpl<"get_chain"> = {
  name: "get_chain",
  refs: ({ chainId }) => [{ kind: "chain", id: chainId }],
  run: ({ chainId }, { store, redact }) => {
    const chain = findChain(store, chainId);
    return chain
      ? ok(describeChain(store, chain, redact))
      : fail(`chain not found: ${chainId}`);
  },
};

function nodeName(chain: Chain, store: StoreAccess, nodeId: string): string {
  const block = chain.blocks.find((item) => item.id === nodeId);
  if (block) return block.type === "history" ? block.name : block.type;
  return store.requests().find((item) => item.id === nodeId)?.name ?? nodeId;
}

function describeRunNode(
  chain: Chain,
  store: StoreAccess,
  nodeId: string,
  result: ChainRunState[string],
) {
  return {
    nodeId,
    name: nodeName(chain, store, nodeId),
    state: result.state,
    status: result.response?.status ?? null,
    error: result.error?.slice(0, STEP_ERROR_CHARS) ?? null,
    assertions: (result.assertionResults ?? []).map(
      ({ assertionId, passed }) => ({ assertionId, passed }),
    ),
  };
}

function countStates(nodes: readonly { state: ChainNodeState }[]) {
  const counts: Partial<Record<ChainNodeState, number>> = {};
  for (const { state } of nodes) counts[state] = (counts[state] ?? 0) + 1;
  return counts;
}

const getChainRun: ToolImpl<"get_chain_run"> = {
  name: "get_chain_run",
  refs: ({ chainId }) => [{ kind: "chain", id: chainId }],
  run: ({ chainId }, { store }) => {
    const chain = findChain(store, chainId);
    if (!chain) return fail(`chain not found: ${chainId}`);
    const runState = store.chainRunState(chainId);
    if (!runState) return ok({ chainId, available: false });
    const nodes = Object.entries(runState).map(([nodeId, result]) =>
      describeRunNode(chain, store, nodeId, result),
    );
    return ok({
      chainId,
      available: true,
      untrusted: true,
      notice: UNTRUSTED_NOTICE,
      counts: countStates(nodes),
      nodes,
    });
  },
};

/* --------------------------------- writes ---------------------------------- */

const NAME_REQUIRED = "name must not be empty";
const SCHEMA_NOT_OBJECT = "schema must be a JSON object, as text";
const NODE_X_STEP = 280;
const NODE_Y_STEP = 140;
const FIRST_NODE_X = 40;
const FIRST_NODE_Y = 120;
const DEFAULT_ITEM_ALIAS = "item";
const DEFAULT_BRANCH_LABEL = "branch 1";
const DEFAULT_BRANCH_EXPRESSION = "== 'value'";
const DEFAULT_TARGET_FIELD = "header";

type BlockInput = RelayToolInput<"add_chain_node">["block"];

type NewNode = {
  id: string;
  /** `api` for a saved request, otherwise the block type. */
  type: string;
  blocks: ChainBlock[];
};

type Built = { node: NewNode } | { error: string };

const missing = (field: string, kind: string): Built => ({
  error: `${field} is required for a ${kind} node`,
});

function schemaProblem(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text);
    const isObject =
      parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
    return isObject ? null : SCHEMA_NOT_OBJECT;
  } catch {
    return SCHEMA_NOT_OBJECT;
  }
}

function buildBranches(
  given: readonly { label: string; expression: string }[] | null,
): ConditionBranch[] {
  const conditional = (given ?? []).filter(
    ({ label }) => label.toLowerCase() !== CHAIN_HANDLE_IDS.ELSE,
  );
  const branches =
    conditional.length > 0
      ? conditional
      : [
          {
            label: DEFAULT_BRANCH_LABEL,
            expression: DEFAULT_BRANCH_EXPRESSION,
          },
        ];
  return [
    ...branches.map((branch) => ({ id: generateId(), ...branch })),
    { id: generateId(), label: CHAIN_HANDLE_IDS.ELSE, expression: "" },
  ];
}

function buildLoop(input: BlockInput): Built {
  if (!input.sourceJsonPath) return missing("sourceJsonPath", "loop");
  const id = generateId();
  return {
    node: {
      id,
      type: "loop",
      blocks: [
        {
          id,
          type: "loop",
          sourceJsonPath: input.sourceJsonPath,
          itemAlias: input.itemAlias ?? DEFAULT_ITEM_ALIAS,
          maxIterations: input.maxIterations ?? LOOP_MAX_ITERATIONS_DEFAULT,
        },
        // A Loop without its Collect is invalid, so they are created together.
        { id: generateId(), type: "collect", loopId: id },
      ],
    },
  };
}

function buildExtract(input: BlockInput): Built {
  if (!input.sourceJsonPath) return missing("sourceJsonPath", "extract");
  if (!input.targetKey) return missing("targetKey", "extract");
  const id = generateId();
  return {
    node: {
      id,
      type: "display",
      blocks: [
        {
          id,
          type: "display",
          sourceJsonPath: input.sourceJsonPath,
          targetField: input.targetField ?? DEFAULT_TARGET_FIELD,
          targetKey: input.targetKey,
        },
      ],
    },
  };
}

function buildAssertion(input: BlockInput): Built {
  const schema = input.schema ?? "{}";
  const problem = schemaProblem(schema);
  if (problem) return { error: problem };
  const id = generateId();
  return {
    node: {
      id,
      type: "validate",
      blocks: [
        {
          id,
          type: "validate",
          schema,
          sourceJsonPath: input.sourceJsonPath ?? "",
        },
      ],
    },
  };
}

function buildRequest(
  input: BlockInput,
  chain: Chain,
  store: StoreAccess,
): Built {
  const requestId = input.requestId;
  if (!requestId) return missing("requestId", "request");
  if (!store.exists("request", requestId)) {
    return { error: `request not found: ${requestId}` };
  }
  if (chain.nodeIds.includes(requestId)) {
    return { error: `request is already in this chain: ${requestId}` };
  }
  return { node: { id: requestId, type: "api", blocks: [] } };
}

function buildNode(input: BlockInput, chain: Chain, store: StoreAccess): Built {
  switch (input.kind) {
    case "request":
      return buildRequest(input, chain, store);
    case "assertion":
      return buildAssertion(input);
    case "delay": {
      if (input.delayMs === null) return missing("delayMs", "delay");
      const id = generateId();
      return {
        node: {
          id,
          type: "delay",
          blocks: [{ id, type: "delay", delayMs: input.delayMs }],
        },
      };
    }
    case "loop":
      return buildLoop(input);
    case "condition": {
      if (!input.variable) return missing("variable", "condition");
      const id = generateId();
      return {
        node: {
          id,
          type: "condition",
          blocks: [
            {
              id,
              type: "condition",
              variable: input.variable,
              branches: buildBranches(input.branches),
            },
          ],
        },
      };
    }
    case "extract":
      return buildExtract(input);
  }
}

function hasNode(chain: Chain, nodeId: string): boolean {
  return (
    chain.nodeIds.includes(nodeId) ||
    chain.blocks.some((block) => block.id === nodeId)
  );
}

type HandleResult = { handle: string | null } | { error: string };

/** The edge handle a source node really has, or why the one asked for does not exist. */
function resolveSourceHandle(
  chain: Chain,
  sourceId: string,
  requested: string | null,
): HandleResult {
  const block = chain.blocks.find((item) => item.id === sourceId);
  if (block?.type === "condition") {
    const branch = block.branches.find(
      (item) => item.id === requested || item.label === requested,
    );
    return branch
      ? { handle: branch.id }
      : {
          error: `handle must be one of this condition's branches: ${block.branches.map((item) => item.label).join(", ")}`,
        };
  }
  if (block?.type === "loop") {
    return requested === LOOP_BODY_HANDLE_ID ||
      requested === LOOP_DONE_HANDLE_ID
      ? { handle: requested }
      : {
          error: `handle must be ${LOOP_BODY_HANDLE_ID} or ${LOOP_DONE_HANDLE_ID} for a loop`,
        };
  }
  const hasOutcomeHandles = !block || block.type === "history";
  if (hasOutcomeHandles) {
    if (requested === null || requested === CHAIN_HANDLE_IDS.SUCCESS) {
      return { handle: null };
    }
    return requested === CHAIN_HANDLE_IDS.FAIL
      ? { handle: requested }
      : {
          error: `handle must be ${CHAIN_HANDLE_IDS.SUCCESS} or ${CHAIN_HANDLE_IDS.FAIL} for a request`,
        };
  }
  return requested === null
    ? { handle: null }
    : { error: "this node has no output handles; leave handle empty" };
}

function placeNode(chain: Chain, anchorId: string | null) {
  const anchor = anchorId ? chain.nodePositions[anchorId] : undefined;
  if (anchor) {
    const siblings = chain.edges.filter(
      (edge) => edge.sourceRequestId === anchorId,
    ).length;
    return { x: anchor.x + NODE_X_STEP, y: anchor.y + siblings * NODE_Y_STEP };
  }
  const placed = chain.nodeIds.length + chain.blocks.length;
  return { x: FIRST_NODE_X + placed * NODE_X_STEP, y: FIRST_NODE_Y };
}

function allNodeIds(chain: Chain): string[] {
  return [...chain.nodeIds, ...chain.blocks.map((block) => block.id)];
}

function hasCycle(chain: Chain): boolean {
  try {
    buildExecutionOrder([], chain.edges, allNodeIds(chain));
    return false;
  } catch (error) {
    if (error instanceof CircularDependencyError) return true;
    throw error;
  }
}

/**
 * What an edit would break that the chain did not already have, so a seeded
 * chain with an older flaw never blocks an unrelated change (FR-43).
 */
function introducedProblem(before: Chain, after: Chain): string | null {
  if (!hasCycle(before) && hasCycle(after)) {
    return "that would create a cycle in the chain";
  }
  const hadMultiInbound = new Set(
    getMultiInboundDisplayIds(before.blocks, before.edges),
  );
  const newMultiInbound = getMultiInboundDisplayIds(
    after.blocks,
    after.edges,
  ).some((id) => !hadMultiInbound.has(id));
  if (newMultiInbound) return "an extract node accepts only one incoming edge";
  if (
    !hasLoopNestingViolation(before.blocks, before.edges) &&
    hasLoopNestingViolation(after.blocks, after.edges)
  ) {
    return "loops cannot be nested that deeply";
  }
  return null;
}

/** Applies a whole-chain change through the log; `before` is the inverse (FR-44). */
function commitChainChange(
  write: Parameters<typeof commitChange>[0],
  before: Chain,
  after: Chain,
  summary: string,
  data: Record<string, unknown>,
) {
  return commitChange(
    write,
    {
      entity: "chain",
      entityId: before.id,
      summary,
      before,
      mutate: () => write?.writer.put("chain", after),
    },
    { chainId: before.id, ...data },
  );
}

const createChain: ToolImpl<"create_chain"> = {
  name: "create_chain",
  run: async ({ name, collectionId }, { store, write }) => {
    const label = name.trim();
    if (!label) return fail(NAME_REQUIRED);
    if (collectionId && !store.exists("collection", collectionId)) {
      return fail(`collection not found: ${collectionId}`);
    }
    if (collectionId && store.exists("chain", collectionId)) {
      return fail(`that collection already has a chain: ${collectionId}`);
    }
    const id = collectionId ?? generateId();
    const chain = createEmptyChain(
      id,
      collectionId ? "collection" : "standalone",
      label,
    );
    return commitChange(
      write,
      {
        entity: "chain",
        entityId: id,
        summary: `Created chain "${label}"`,
        before: null,
        mutate: () => write?.writer.put("chain", chain),
      },
      { chainId: id, createdIds: [id] },
    );
  },
};

const renameChain: ToolImpl<"rename_chain"> = {
  name: "rename_chain",
  refs: ({ id }) => [{ kind: "chain", id }],
  run: async ({ id, name }, { store, write }) => {
    const label = name.trim();
    if (!label) return fail(NAME_REQUIRED);
    const chain = findChain(store, id);
    if (!chain) return fail(`chain not found: ${id}`);
    return commitChange(write, {
      entity: "chain",
      entityId: id,
      summary: `Renamed chain "${chain.name}" to "${label}"`,
      before: chain,
      mutate: () => write?.writer.put("chain", { ...chain, name: label }),
    });
  },
};

const addChainNode: ToolImpl<"add_chain_node"> = {
  name: "add_chain_node",
  refs: ({ chainId }) => [{ kind: "chain", id: chainId }],
  run: async ({ chainId, block, after, afterHandle }, { store, write }) => {
    const chain = findChain(store, chainId);
    if (!chain) return fail(`chain not found: ${chainId}`);
    if (after && !hasNode(chain, after)) {
      return fail(`node not found in chain: ${after}`);
    }
    const built = buildNode(block, chain, store);
    if ("error" in built) return fail(built.error);
    const { node } = built;

    const source = after
      ? resolveSourceHandle(chain, after, afterHandle)
      : null;
    if (source && "error" in source) return fail(source.error);
    const edge: ChainEdge | null =
      after && source && "handle" in source
        ? buildEdgeForNewNode(chain, node.id, node.type, {
            nodeId: after,
            handleId: source.handle,
          })
        : null;
    if (after && !edge) return fail("those nodes cannot be connected");

    const position = placeNode(chain, after);
    const collect = node.blocks.find((item) => item.type === "collect");
    const next: Chain = {
      ...chain,
      nodeIds:
        node.type === "api" ? [...chain.nodeIds, node.id] : chain.nodeIds,
      blocks: [...chain.blocks, ...node.blocks],
      edges: edge ? [...chain.edges, edge] : chain.edges,
      nodePositions: {
        ...chain.nodePositions,
        [node.id]: position,
        ...(collect
          ? { [collect.id]: { x: position.x + NODE_X_STEP, y: position.y } }
          : {}),
      },
    };
    const problem = introducedProblem(chain, next);
    if (problem) return fail(problem);

    return commitChainChange(
      write,
      chain,
      next,
      `Added ${block.kind} node to chain "${chain.name}"`,
      {
        nodeId: node.id,
        ...(edge ? { edgeId: edge.id } : {}),
        createdIds: node.blocks.map((item) => item.id),
      },
    );
  },
};

type PatchInput = RelayToolInput<"update_chain_node">["patch"];
type Patched = { block: ChainBlock } | { error: string };

/** Patch fields each block type accepts; anything else set on the patch is a mistake. */
const PATCH_FIELDS: Record<string, readonly (keyof PatchInput)[]> = {
  delay: ["delayMs"],
  loop: ["sourceJsonPath", "itemAlias", "maxIterations"],
  condition: ["variable", "branches"],
  display: ["sourceJsonPath", "targetField", "targetKey"],
  validate: ["schema", "sourceJsonPath"],
};

function unsupportedFields(
  type: string,
  patch: PatchInput,
): (keyof PatchInput)[] {
  const allowed = PATCH_FIELDS[type] ?? [];
  return (Object.keys(patch) as (keyof PatchInput)[]).filter(
    (field) => patch[field] !== null && !allowed.includes(field),
  );
}

/** Keeps the ids of branches that survive (matched by label) so their edges stay wired. */
function patchBranches(
  existing: readonly ConditionBranch[],
  given: NonNullable<PatchInput["branches"]>,
): ConditionBranch[] {
  const kept = buildBranches(given);
  return kept.map((branch) => ({
    ...branch,
    id: existing.find((old) => old.label === branch.label)?.id ?? branch.id,
  }));
}

function applyPatch(block: ChainBlock, patch: PatchInput): Patched {
  const bad = unsupportedFields(block.type, patch);
  if (bad.length > 0) {
    return { error: `${bad.join(", ")} cannot be set on a ${block.type} node` };
  }
  switch (block.type) {
    case "delay":
      return { block: { ...block, delayMs: patch.delayMs ?? block.delayMs } };
    case "loop":
      return {
        block: {
          ...block,
          sourceJsonPath: patch.sourceJsonPath ?? block.sourceJsonPath,
          itemAlias: patch.itemAlias ?? block.itemAlias,
          maxIterations: patch.maxIterations ?? block.maxIterations,
        },
      };
    case "condition":
      return {
        block: {
          ...block,
          variable: patch.variable ?? block.variable,
          branches: patch.branches
            ? patchBranches(block.branches, patch.branches)
            : block.branches,
        },
      };
    case "display":
      return {
        block: {
          ...block,
          sourceJsonPath: patch.sourceJsonPath ?? block.sourceJsonPath,
          targetField: patch.targetField ?? block.targetField,
          targetKey: patch.targetKey ?? block.targetKey,
        },
      };
    case "validate": {
      const schema = patch.schema ?? block.schema;
      const problem = schemaProblem(schema);
      if (problem) return { error: problem };
      return {
        block: {
          ...block,
          schema,
          sourceJsonPath: patch.sourceJsonPath ?? block.sourceJsonPath,
        },
      };
    }
    default:
      return { error: `a ${block.type} node has no settings to update` };
  }
}

/** Edges left pointing at a branch that a patch removed would silently never run. */
function orphanedBranchEdge(
  before: Chain,
  after: Chain,
): ChainEdge | undefined {
  const live = new Set(
    after.blocks.flatMap((block) =>
      block.type === "condition" ? block.branches.map((item) => item.id) : [],
    ),
  );
  const had = new Set(
    before.blocks.flatMap((block) =>
      block.type === "condition" ? block.branches.map((item) => item.id) : [],
    ),
  );
  return after.edges.find(
    (edge) =>
      edge.branchId && had.has(edge.branchId) && !live.has(edge.branchId),
  );
}

const updateChainNode: ToolImpl<"update_chain_node"> = {
  name: "update_chain_node",
  refs: ({ chainId }) => [{ kind: "chain", id: chainId }],
  run: async ({ chainId, nodeId, patch }, { store, write }) => {
    const chain = findChain(store, chainId);
    if (!chain) return fail(`chain not found: ${chainId}`);
    const target = chain.blocks.find((block) => block.id === nodeId);
    if (!target) {
      return fail(
        chain.nodeIds.includes(nodeId)
          ? "request nodes have no settings to update"
          : `node not found in chain: ${nodeId}`,
      );
    }
    const patched = applyPatch(target, patch);
    if ("error" in patched) return fail(patched.error);
    const next: Chain = {
      ...chain,
      blocks: chain.blocks.map((block) =>
        block.id === nodeId ? patched.block : block,
      ),
    };
    if (orphanedBranchEdge(chain, next)) {
      return fail("a branch that still has an edge cannot be removed");
    }
    return commitChainChange(
      write,
      chain,
      next,
      `Updated ${target.type} node in chain "${chain.name}"`,
      { nodeId },
    );
  },
};

const sameWire = (
  edge: ChainEdge,
  from: string,
  to: string,
  handle: string | null,
) =>
  edge.sourceRequestId === from &&
  edge.targetRequestId === to &&
  (edge.branchId ?? null) === handle;

function nodeType(chain: Chain, nodeId: string): string {
  return chain.blocks.find((block) => block.id === nodeId)?.type ?? "api";
}

const connectChainNodes: ToolImpl<"connect_chain_nodes"> = {
  name: "connect_chain_nodes",
  refs: ({ chainId }) => [{ kind: "chain", id: chainId }],
  run: async ({ chainId, from, to, handle, remove }, { store, write }) => {
    const chain = findChain(store, chainId);
    if (!chain) return fail(`chain not found: ${chainId}`);
    for (const nodeId of [from, to]) {
      if (!hasNode(chain, nodeId))
        return fail(`node not found in chain: ${nodeId}`);
    }
    const source = resolveSourceHandle(chain, from, handle);
    if ("error" in source) return fail(source.error);

    if (remove) {
      const edge = chain.edges.find((item) =>
        sameWire(item, from, to, source.handle),
      );
      if (!edge) return fail("no such connection to remove");
      return commitChainChange(
        write,
        chain,
        { ...chain, edges: chain.edges.filter((item) => item.id !== edge.id) },
        `Disconnected nodes in chain "${chain.name}"`,
        { edgeId: edge.id },
      );
    }
    if (nodeType(chain, to) === "start")
      return fail("nothing can connect into a start node");
    if (chain.edges.some((item) => sameWire(item, from, to, source.handle))) {
      return fail("those nodes are already connected");
    }
    const edge = buildEdgeForNewNode(chain, to, nodeType(chain, to), {
      nodeId: from,
      handleId: source.handle,
    });
    if (!edge)
      return fail(
        "that connection is not allowed (same node, or the output is already in use)",
      );
    const next: Chain = { ...chain, edges: [...chain.edges, edge] };
    const problem = introducedProblem(chain, next);
    if (problem) return fail(problem);
    return commitChainChange(
      write,
      chain,
      next,
      `Connected nodes in chain "${chain.name}"`,
      { edgeId: edge.id },
    );
  },
};

export const chainWriteTools = [
  getChain,
  getChainRun,
  createChain,
  renameChain,
  addChainNode,
  updateChainNode,
  connectChainNodes,
] as const;
