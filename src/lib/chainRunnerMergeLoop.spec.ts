import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOOP_BODY_HANDLE_ID,
  LOOP_DONE_HANDLE_ID,
} from "@/types/chain";
import type { RequestModel } from "@/types";
import type {
  ChainEdge,
  CollectBlock,
  ConditionNodeConfig,
  DisplayBlock,
  LoopBlock,
  MergeBlock,
} from "@/types/chain";

vi.mock("@/lib/requestRunner", () => ({
  runRequest: vi.fn(),
}));

vi.mock("@/lib/chainEvalHost", () => ({
  runInWorker: vi.fn(),
}));

import { runRequest } from "@/lib/requestRunner";
import { runChain } from "./chainRunner";
import { CHAIN_ERROR_CODE } from "./chainRunner/errorCodes";
import type { OnUpdateFn } from "./chainRunner/types";

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

const response = (status: number, body = "{}") => ({
  status,
  statusText: status === 200 ? "OK" : "Error",
  headers: {},
  body,
  duration: 1,
  size: body.length,
  url: "",
  method: "GET" as const,
  timestamp: 0,
});

const edge = (
  source: string,
  target: string,
  extra: Partial<ChainEdge> = {},
): ChainEdge => ({
  id: `${source}->${target}${extra.branchId ? `:${extra.branchId}` : ""}`,
  sourceRequestId: source,
  targetRequestId: target,
  injections: [],
  ...extra,
});

const merge = (mode: MergeBlock["mode"]): MergeBlock[] => [
  { id: "m", type: "merge", mode },
];

/** Runs a chain and returns each node's last non-"running" state, plus the raw update log. */
async function run(
  options: Partial<Parameters<typeof runChain>[0]>,
  tap?: OnUpdateFn,
) {
  const states: Record<string, string> = {};
  const log: string[] = [];
  await runChain({
    requests: [],
    edges: [],
    onUpdate: (id, state, data) => {
      tap?.(id, state, data);
      if (state === "running") return;
      states[id] = state;
      log.push(`${id} ${state}`);
    },
    signal: new AbortController().signal,
    ...options,
  });
  return { states, log };
}

const calledUrls = () =>
  vi.mocked(runRequest).mock.calls.map(([req]) => req.url);

/** Condition over an unset variable: "win" matches the empty value, so "lose" (the else) is the losing handle. */
const conditionNodes: ConditionNodeConfig[] = [
  {
    id: "cond",
    type: "condition",
    variable: "{{unused}}",
    branches: [
      { id: "win", label: "win", expression: "== ''" },
      { id: "lose", label: "lose", expression: "" },
    ],
  },
];

describe("CR-026: Merge respects branch routing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(runRequest).mockResolvedValue(response(200));
  });

  it("'all' Merge collapses to skipped when a Condition's losing handle feeds it", async () => {
    const { states } = await run({
      requests: [rq("a")],
      edges: [
        edge("cond", "a", { branchId: "win" }),
        edge("a", "m"),
        edge("cond", "m", { branchId: "lose" }),
      ],
      conditionNodes,
      mergeNodes: merge("all"),
    });

    expect(states.cond).toBe("passed");
    expect(states.a).toBe("passed");
    expect(states.m).toBe("skipped");
  });

  it("'all' Merge still runs when every lane is live (winning handle + plain edge)", async () => {
    const { states } = await run({
      requests: [rq("a")],
      edges: [edge("cond", "m", { branchId: "win" }), edge("a", "m")],
      conditionNodes,
      mergeNodes: merge("all"),
    });

    expect(states.m).toBe("passed");
  });

  it("'any' Merge does not fire on a Condition lane that never executed", async () => {
    const { states, log } = await run({
      requests: [rq("a")],
      edges: [
        edge("cond", "a", { branchId: "win" }),
        edge("cond", "m", { branchId: "lose" }),
      ],
      conditionNodes,
      mergeNodes: merge("any"),
    });

    expect(states.a).toBe("passed");
    expect(states.m).toBe("skipped");
    expect(log).not.toContain("m passed");
  });

  it("'any' Merge fires on the winning Condition lane", async () => {
    const { states } = await run({
      requests: [],
      edges: [
        edge("cond", "m", { branchId: "win" }),
        edge("cond", "m", { branchId: "lose" }),
      ],
      conditionNodes,
      mergeNodes: merge("any"),
    });

    expect(states.m).toBe("passed");
  });

  it("a success handle feeding an 'all' Merge fails (not skips) when the source failed", async () => {
    vi.mocked(runRequest).mockResolvedValue(response(500));
    const { states } = await run({
      requests: [rq("a")],
      edges: [edge("a", "m", { branchId: "success" })],
      mergeNodes: merge("all"),
    });

    expect(states.a).toBe("failed");
    expect(states.m).toBe("failed");
  });

  it("a fail handle feeding an 'any' Merge is dead when the source passed", async () => {
    const { states, log } = await run({
      requests: [rq("a")],
      edges: [edge("a", "m", { branchId: "fail" })],
      mergeNodes: merge("any"),
    });

    expect(states.a).toBe("passed");
    expect(states.m).toBe("skipped");
    expect(log).not.toContain("m passed");
  });

  it("a fail handle counts as a live lane when the source failed", async () => {
    vi.mocked(runRequest).mockResolvedValue(response(500));
    const { states } = await run({
      requests: [rq("a")],
      edges: [edge("a", "m", { branchId: "fail" })],
      mergeNodes: merge("all"),
    });

    expect(states.m).toBe("passed");
  });

  it("a success handle from a passed source fires an 'any' Merge", async () => {
    const { states } = await run({
      requests: [rq("a")],
      edges: [edge("a", "m", { branchId: "success" })],
      mergeNodes: merge("any"),
    });

    expect(states.m).toBe("passed");
  });
});

describe("CR-026: 'any' Merge early-fire follows lane liveness", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(runRequest).mockResolvedValue(response(500));
  });

  it("fires via a fail handle from a failed source", async () => {
    const { states } = await run({
      requests: [rq("a")],
      edges: [edge("a", "m", { branchId: "fail" })],
      mergeNodes: merge("any"),
    });

    expect(states.a).toBe("failed");
    expect(states.m).toBe("passed");
  });

  it("does not fire via a success handle from a failed source", async () => {
    const { states, log } = await run({
      requests: [rq("a")],
      edges: [edge("a", "m", { branchId: "success" })],
      mergeNodes: merge("any"),
    });

    expect(states.m).toBe("skipped");
    expect(log).not.toContain("m passed");
  });

  it("does not fire from an aborted source", async () => {
    const stop = new AbortController();
    vi.mocked(runRequest).mockImplementation((_req, signal) => {
      const aborted = new Promise<never>((_, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
      stop.abort();
      return aborted;
    });

    const { states, log } = await run({
      requests: [rq("a")],
      edges: [edge("a", "m")],
      mergeNodes: merge("any"),
      signal: stop.signal,
    });

    expect(states.a).toBe("aborted");
    expect(log).not.toContain("m passed");
  });
});

describe("CR-027: 'any' Merge early-fire", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(runRequest).mockResolvedValue(response(200));
  });

  it("does not skip an un-started predecessor that also feeds another node", async () => {
    // concurrency 1: `a` passes and fires the Merge while `b` is still queued.
    const { states } = await run({
      requests: [rq("a"), rq("b"), rq("c")],
      edges: [edge("a", "m"), edge("b", "m"), edge("b", "c")],
      mergeNodes: merge("any"),
      concurrency: 1,
    });

    expect(states.m).toBe("passed");
    expect(states.b).toBe("passed");
    expect(states.c).toBe("passed");
  });

  it("still skips an un-started predecessor that feeds only the Merge", async () => {
    const { states } = await run({
      requests: [rq("a"), rq("b")],
      edges: [edge("a", "m"), edge("b", "m")],
      mergeNodes: merge("any"),
      concurrency: 1,
    });

    expect(states.b).toBe("skipped");
    expect(calledUrls()).toEqual(["https://api.test/a"]);
  });

  it("at concurrency 4 aborts the in-flight lane and records it skipped (spec: remaining lanes skipped)", async () => {
    let laneSignal: AbortSignal | undefined;
    vi.mocked(runRequest).mockImplementation((req, signal) => {
      if (!req.url.endsWith("/slow")) return Promise.resolve(response(200));
      laneSignal = signal;
      return new Promise((_, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });

    const { states, log } = await run({
      requests: [rq("fast"), rq("slow")],
      edges: [edge("fast", "m"), edge("slow", "m")],
      mergeNodes: merge("any"),
      concurrency: 4,
    });

    expect(states.fast).toBe("passed");
    expect(states.m).toBe("passed");
    expect(states.slow).toBe("skipped");
    expect(laneSignal?.aborted).toBe(true);
    expect(log.filter((entry) => entry.startsWith("slow "))).toEqual([
      "slow skipped",
    ]);
  });

  it("does not abort an in-flight predecessor that also feeds another node", async () => {
    let shared: AbortSignal | undefined;
    vi.mocked(runRequest).mockImplementation(async (req, signal) => {
      if (req.url.endsWith("/shared")) {
        shared = signal;
        await Promise.resolve();
        await Promise.resolve();
      }
      return response(200);
    });

    const { states } = await run({
      requests: [rq("fast"), rq("shared"), rq("other")],
      edges: [
        edge("fast", "m"),
        edge("shared", "m"),
        edge("shared", "other"),
      ],
      mergeNodes: merge("any"),
      concurrency: 4,
    });

    expect(states.m).toBe("passed");
    expect(states.shared).toBe("passed");
    expect(states.other).toBe("passed");
    expect(shared?.aborted).toBe(false);
  });

  it("a real Stop still records an in-flight node as aborted, not skipped", async () => {
    const stop = new AbortController();
    vi.mocked(runRequest).mockImplementation((_req, signal) => {
      const aborted = new Promise<never>((_, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
      stop.abort();
      return aborted;
    });

    const { states } = await run({
      requests: [rq("a")],
      edges: [],
      signal: stop.signal,
    });

    expect(states.a).toBe("aborted");
  });
});

describe("CR-028: Loop -> Collect scheduling", () => {
  const loopNodes: LoopBlock[] = [
    {
      id: "loop",
      type: "loop",
      sourceJsonPath: "$.items",
      itemAlias: "item",
      maxIterations: 100,
    },
  ];
  const collectNodes: CollectBlock[] = [
    { id: "collect", type: "collect", loopId: "loop" },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(runRequest).mockImplementation(async (req) =>
      req.url.endsWith("/upstream")
        ? response(200, JSON.stringify({ items: ["a", "b"] }))
        : response(200, JSON.stringify({ v: 1 })),
    );
  });

  it("runs Collect's downstream even when no done edge is drawn", async () => {
    const { states } = await run({
      requests: [rq("upstream"), rq("body-1"), rq("downstream")],
      edges: [
        edge("upstream", "loop"),
        edge("loop", "body-1", { branchId: LOOP_BODY_HANDLE_ID }),
        edge("collect", "downstream"),
      ],
      loopNodes,
      collectNodes,
    });

    expect(states.loop).toBe("passed");
    expect(states.collect).toBe("passed");
    expect(states.downstream).toBe("passed");
    const bodyCalls = calledUrls().filter((u) => u.endsWith("/body-1"));
    expect(bodyCalls).toHaveLength(2);
    // Downstream ran only after the Loop finished its iterations.
    expect(calledUrls().at(-1)).toBe("https://api.test/downstream");
  });

  it("behaves identically when the done edge is drawn (no double scheduling)", async () => {
    const { states } = await run({
      requests: [rq("upstream"), rq("body-1"), rq("downstream")],
      edges: [
        edge("upstream", "loop"),
        edge("loop", "body-1", { branchId: LOOP_BODY_HANDLE_ID }),
        edge("loop", "collect", { branchId: LOOP_DONE_HANDLE_ID }),
        edge("collect", "downstream"),
      ],
      loopNodes,
      collectNodes,
    });

    expect(states.downstream).toBe("passed");
    expect(
      calledUrls().filter((u) => u.endsWith("/downstream")),
    ).toHaveLength(1);
  });

  it("collects terminal non-request body nodes (Display wired into Collect)", async () => {
    const displayNodes: DisplayBlock[] = [
      {
        id: "disp",
        type: "display",
        sourceJsonPath: "$.v",
        targetField: "header",
        targetKey: "x-v",
      },
    ];
    let collected = "";
    await runChain({
      requests: [rq("upstream"), rq("body-1")],
      edges: [
        edge("upstream", "loop"),
        edge("loop", "body-1", { branchId: LOOP_BODY_HANDLE_ID }),
        edge("body-1", "disp"),
        edge("disp", "collect"),
      ],
      loopNodes,
      collectNodes,
      displayNodes,
      signal: new AbortController().signal,
      onUpdate: (id, state, data) => {
        if (id === "collect" && state === "passed") {
          collected = data.extractedValues?.["collect.collect"] ?? "";
        }
      },
    });

    const items = JSON.parse(collected) as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(Object.keys(item)).toEqual(["disp"]);
      expect(item.disp).toMatchObject({
        state: "passed",
        extractedValues: { disp: "1" },
      });
    }
  });

  it("fails a Loop whose body handle is not connected and skips its Collect's downstream", async () => {
    let loopErrorCode: string | undefined;
    const { states } = await run(
      {
        requests: [rq("upstream"), rq("downstream")],
        edges: [edge("upstream", "loop"), edge("collect", "downstream")],
        loopNodes,
        collectNodes,
      },
      (id, state, data) => {
        if (id === "loop" && state === "failed") loopErrorCode = data.errorCode;
      },
    );

    expect(loopErrorCode).toBe(CHAIN_ERROR_CODE.LOOP_BODY_UNCONNECTED);
    expect(states.collect).toBe("skipped");
    expect(states.downstream).toBe("skipped");
  });
});
