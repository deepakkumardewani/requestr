import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOOP_BODY_HANDLE_ID,
  LOOP_DONE_HANDLE_ID,
} from "@/types/chain";
import { MAX_SUBCHAIN_DEPTH } from "@/lib/chainConstants";
import type { RequestModel } from "@/types";
import type {
  ChainEdge,
  CollectBlock,
  LoopBlock,
  SubChainBlock,
} from "@/types/chain";

vi.mock("@/lib/requestRunner", () => ({ runRequest: vi.fn() }));
vi.mock("@/lib/chainEvalHost", () => ({ runInWorker: vi.fn() }));

import { runRequest } from "@/lib/requestRunner";
import { runChain } from "../chainRunner";
import { CHAIN_ERROR_CODE } from "./errorCodes";
import { LOOP_DEPTH_EXCEEDED_KIND } from "./executors/loop";
import {
  SUBCHAIN_DEPTH_EXCEEDED_KIND,
  type ReferencedChainGraph,
} from "./executors/subchain";
import { graphFromBlocks } from "./runGraph";
import { nestUpdate, parentStepKey, stepKey } from "./nesting";
import type { NodeUpdateData } from "./stepRecording";
import type { RunChainOptions } from "./types";

const ITEMS_BODY = JSON.stringify({ items: [1, 2] });

function rq(id: string): RequestModel {
  return {
    id,
    collectionId: "c",
    name: id,
    method: "GET",
    url: `https://api.test/${id}`,
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "json", content: "{}" },
    preScript: "",
    postScript: "",
    createdAt: 0,
    updatedAt: 0,
  };
}

function edge(
  source: string,
  target: string,
  branchId?: string,
): ChainEdge {
  return {
    id: `${source}->${target}`,
    sourceRequestId: source,
    targetRequestId: target,
    injections: [],
    branchId,
  };
}

type Recorded = {
  nodeId: string;
  state: string;
  data: NodeUpdateData;
};

async function run(opts: Partial<RunChainOptions>): Promise<Recorded[]> {
  const updates: Recorded[] = [];
  await runChain({
    requests: [],
    edges: [],
    onUpdate: (nodeId, state, data) => updates.push({ nodeId, state, data }),
    signal: new AbortController().signal,
    ...opts,
  });
  return updates;
}

const terminal = (updates: Recorded[], nodeId: string) =>
  updates.filter((u) => u.nodeId === nodeId && u.state !== "running");

function callsTo(id: string): number {
  return vi
    .mocked(runRequest)
    .mock.calls.filter(([req]) => req.url.endsWith(`/${id}`)).length;
}

/**
 * up -> L1 -body-> m1 -> L2 -body-> ... -> Ld -body-> leaf, each Lk -done-> Ck,
 * and C(k+1) -> Ck so every inner Collect feeds its enclosing Collect.
 */
function nestedLoops(depth: number) {
  const ids = Array.from({ length: depth }, (_, i) => i + 1);
  const requests = [
    rq("up"),
    ...ids.slice(0, -1).map((k) => rq(`m${k}`)),
    rq("leaf"),
  ];
  const edges: ChainEdge[] = [edge("up", "L1")];
  for (const k of ids) {
    edges.push(
      edge(`L${k}`, k < depth ? `m${k}` : "leaf", LOOP_BODY_HANDLE_ID),
      edge(`L${k}`, `C${k}`, LOOP_DONE_HANDLE_ID),
    );
    if (k < depth) edges.push(edge(`m${k}`, `L${k + 1}`));
    if (k > 1) edges.push(edge(`C${k}`, `C${k - 1}`));
  }
  const loopNodes: LoopBlock[] = ids.map((k) => ({
    id: `L${k}`,
    type: "loop",
    sourceJsonPath: "$.items",
    itemAlias: `item${k}`,
    maxIterations: 100,
  }));
  const collectNodes: CollectBlock[] = ids.map((k) => ({
    id: `C${k}`,
    type: "collect",
    loopId: `L${k}`,
  }));
  return { requests, edges, loopNodes, collectNodes };
}

/** Chain `i` holds one Sub-chain block `s<i>` referencing chain `i + 1`; the last chain holds a request. */
function subChainLadder(levels: number) {
  const block = (i: number): SubChainBlock => ({
    id: `s${i}`,
    type: "subchain",
    chainId: `chain-${i + 1}`,
    inputBindings: {},
  });
  const graphs = new Map<string, ReferencedChainGraph>();
  for (let i = 1; i < levels; i += 1) {
    graphs.set(`chain-${i}`, {
      requests: [],
      edges: [],
      subChainBlocks: [block(i)],
    });
  }
  graphs.set(`chain-${levels}`, {
    requests: [rq("deep")],
    edges: [],
  });
  return {
    host: { subChainBlocks: [block(0)] },
    resolveSubChainGraph: (id: string) => graphs.get(id),
  };
}

beforeEach(() => {
  vi.mocked(runRequest).mockReset();
  vi.mocked(runRequest).mockResolvedValue({
    status: 200,
    statusText: "OK",
    headers: {},
    body: ITEMS_BODY,
    duration: 1,
    size: ITEMS_BODY.length,
    url: "",
    method: "GET",
    timestamp: 0,
  });
});

describe("step ids under nesting", () => {
  it("stepKey/parentStepKey stay backward compatible for a single flat parent", () => {
    expect(stepKey("n", {})).toBe("n");
    expect(stepKey("n", { parentStepId: "loop", iteration: 2 })).toBe(
      "n::loop::2",
    );
    expect(parentStepKey({ parentStepId: "loop", iteration: 2 })).toBe("loop");
    expect(parentStepKey({})).toBeUndefined();
  });

  it("nestUpdate keeps the innermost parent and accumulates the full ancestry", () => {
    const inner = nestUpdate({}, { parentStepId: "inner", iteration: 1 });
    const outer = nestUpdate(inner, { parentStepId: "outer", iteration: 0 });

    expect(outer.parentStepId).toBe("inner");
    expect(outer.iteration).toBe(1);
    expect(stepKey("leaf", outer)).toBe("leaf::inner::1::outer::0");
    expect(parentStepKey(outer)).toBe("inner::outer::0");
  });
});

describe("nested Loops (CR-006)", () => {
  it.each([2, 3])("runs %i levels of nested Loops to completion", async (depth) => {
    const updates = await run({ ...nestedLoops(depth) });

    expect(callsTo("leaf")).toBe(2 ** depth);
    expect(terminal(updates, "L1")[0].state).toBe("passed");
    const innermost = terminal(updates, `L${depth}`);
    expect(innermost.every((u) => u.state === "passed")).toBe(true);
    expect(innermost).toHaveLength(2 ** (depth - 1));
  });

  it("gives every leaf execution a unique id whose parent is its own inner-Loop step", async () => {
    const updates = await run({ ...nestedLoops(2) });

    const leaves = terminal(updates, "leaf");
    const ids = leaves.map((u) => stepKey("leaf", u.data));
    expect(new Set(ids).size).toBe(4);
    const inner = terminal(updates, "L2").map((u) => stepKey("L2", u.data));
    for (const leaf of leaves) {
      expect(inner).toContain(parentStepKey(leaf.data));
    }
  });

  it("fails a Loop nested deeper than 3 with a typed error and never runs its body", async () => {
    const updates = await run({ ...nestedLoops(4) });

    const failed = terminal(updates, "L4");
    expect(failed.length).toBeGreaterThan(0);
    for (const step of failed) {
      expect(step.state).toBe("failed");
      expect(step.data.errorCode).toBe(CHAIN_ERROR_CODE.LOOP_DEPTH_EXCEEDED);
      expect(step.data.errorKind).toBe(LOOP_DEPTH_EXCEEDED_KIND);
    }
    expect(callsTo("leaf")).toBe(0);
  });
});

describe("nested Sub-chains (CR-006)", () => {
  it("executes an A -> B -> C chain and nests C's steps under both Sub-chain steps", async () => {
    const { host, resolveSubChainGraph } = subChainLadder(3);
    const updates = await run({ ...host, resolveSubChainGraph });

    expect(terminal(updates, "s0")[0].state).toBe("passed");
    expect(terminal(updates, "s1")[0].state).toBe("passed");
    expect(terminal(updates, "s2")[0].state).toBe("passed");
    const [deep] = terminal(updates, "deep");
    expect(deep.state).toBe("passed");
    expect(deep.data.parentStepId).toBe("s2");
    expect(parentStepKey(deep.data)).toBe("s2::s1::s0");
    expect(terminal(updates, "s2")[0].data.parentStepId).toBe("s1");
  });

  it("allows 5 nested Sub-chains but fails the 6th with SUBCHAIN_DEPTH_EXCEEDED", async () => {
    const ok = subChainLadder(5);
    const okUpdates = await run({ ...ok.host, resolveSubChainGraph: ok.resolveSubChainGraph });
    expect(terminal(okUpdates, "deep")[0].state).toBe("passed");

    const tooDeep = subChainLadder(6);
    const updates = await run({
      ...tooDeep.host,
      resolveSubChainGraph: tooDeep.resolveSubChainGraph,
    });
    const [failed] = terminal(updates, "s5");
    expect(failed.state).toBe("failed");
    expect(failed.data.errorKind).toBe(SUBCHAIN_DEPTH_EXCEEDED_KIND);
    expect(failed.data.errorCode).toBe(
      CHAIN_ERROR_CODE.SUBCHAIN_DEPTH_EXCEEDED,
    );
    expect(terminal(updates, "deep")).toHaveLength(0);
  });

  describe("graphs built by graphFromBlocks (the hook's resolver)", () => {
    /** Chain `i` holds a Sub-chain block referencing chain `i + 1`; the last holds a request. */
    function resolverFromBlocks(levels: number) {
      const graphs = new Map<string, ReferencedChainGraph>();
      for (let i = 1; i < levels; i += 1) {
        graphs.set(
          `chain-${i}`,
          graphFromBlocks(
            [
              {
                id: `s${i}`,
                type: "subchain",
                chainId: `chain-${i + 1}`,
                inputBindings: {},
              },
            ],
            [],
            [],
          ),
        );
      }
      graphs.set(`chain-${levels}`, graphFromBlocks([], [rq("deep")], []));
      const host = graphFromBlocks(
        [{ id: "s0", type: "subchain", chainId: "chain-1", inputBindings: {} }],
        [],
        [],
      );
      return {
        host: { subChainBlocks: host.subChainBlocks },
        resolveSubChainGraph: (id: string) => graphs.get(id),
      };
    }

    it("runs a nested Sub-chain (HEAD skipped it)", async () => {
      const { host, resolveSubChainGraph } = resolverFromBlocks(3);
      const updates = await run({ ...host, resolveSubChainGraph });
      expect(terminal(updates, "deep")[0].state).toBe("passed");
    });

    it("fails nesting beyond MAX_SUBCHAIN_DEPTH with the depth error", async () => {
      const { host, resolveSubChainGraph } = resolverFromBlocks(
        MAX_SUBCHAIN_DEPTH + 1,
      );
      const updates = await run({ ...host, resolveSubChainGraph });
      const [failed] = terminal(updates, `s${MAX_SUBCHAIN_DEPTH}`);
      expect(failed.data.errorCode).toBe(
      CHAIN_ERROR_CODE.SUBCHAIN_DEPTH_EXCEEDED,
    );
      expect(failed.data.errorKind).toBe(SUBCHAIN_DEPTH_EXCEEDED_KIND);
      expect(terminal(updates, "deep")).toHaveLength(0);
    });
  });

  it("fails a recursive A -> B -> A reference with a typed error instead of running forever", async () => {
    const graphs: Record<string, ReferencedChainGraph> = {
      A: {
        requests: [],
        edges: [],
        subChainBlocks: [
          { id: "to-B", type: "subchain", chainId: "B", inputBindings: {} },
        ],
      },
      B: {
        requests: [],
        edges: [],
        subChainBlocks: [
          { id: "to-A", type: "subchain", chainId: "A", inputBindings: {} },
        ],
      },
    };
    const updates = await run({
      subChainBlocks: graphs.A.subChainBlocks,
      resolveSubChainGraph: (id) => graphs[id],
    });

    const depthFailures = updates.filter(
      (u) => u.data.errorKind === SUBCHAIN_DEPTH_EXCEEDED_KIND,
    );
    expect(depthFailures).toHaveLength(1);
  });

  it("runs a Sub-chain placed inside a Loop body, nested under both", async () => {
    const sub: SubChainBlock = {
      id: "sub",
      type: "subchain",
      chainId: "inner-chain",
      inputBindings: {},
    };
    const updates = await run({
      requests: [rq("up")],
      edges: [
        edge("up", "loop"),
        edge("loop", "sub", LOOP_BODY_HANDLE_ID),
        edge("loop", "collect", LOOP_DONE_HANDLE_ID),
      ],
      loopNodes: [
        {
          id: "loop",
          type: "loop",
          sourceJsonPath: "$.items",
          itemAlias: "item",
          maxIterations: 100,
        },
      ],
      collectNodes: [{ id: "collect", type: "collect", loopId: "loop" }],
      subChainBlocks: [sub],
      resolveSubChainGraph: () => ({ requests: [rq("inner-req")], edges: [] }),
    });

    const inner = terminal(updates, "inner-req");
    expect(inner).toHaveLength(2);
    expect(new Set(inner.map((u) => stepKey("inner-req", u.data))).size).toBe(2);
    for (const step of inner) {
      expect(step.data.parentStepId).toBe("sub");
      expect(parentStepKey(step.data)).toMatch(/^sub::loop::[01]$/);
    }
  });
});

describe("Sub-chain step id collisions (U-P9-b)", () => {
  it("keeps steps distinct when two Sub-chain blocks reference the same chain", async () => {
    const blocks: SubChainBlock[] = ["sub-a", "sub-b"].map((id) => ({
      id,
      type: "subchain",
      chainId: "shared",
      inputBindings: {},
    }));
    const updates = await run({
      subChainBlocks: blocks,
      resolveSubChainGraph: () => ({ requests: [rq("shared-req")], edges: [] }),
    });

    const ids = terminal(updates, "shared-req").map((u) =>
      stepKey("shared-req", u.data),
    );
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
