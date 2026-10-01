import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestModel, ResponseData } from "@/types";
import type {
  ChainAssertion,
  ChainEdge,
  CollectBlock,
  ConditionNodeConfig,
  DisplayBlock,
  LoopBlock,
  MergeBlock,
  StartBlock,
  SubChainBlock,
} from "@/types/chain";
import {
  LOOP_BODY_HANDLE_ID,
  LOOP_DONE_HANDLE_ID,
} from "@/types/chain";

vi.mock("@/lib/requestRunner", () => ({
  runRequest: vi.fn(),
}));

vi.mock("@/lib/chainEvalHost", () => ({
  runInWorker: vi.fn(),
}));

import { runInWorker } from "@/lib/chainEvalHost";
import { runRequest } from "@/lib/requestRunner";
import {
  P214_EDGES,
  P214_REQUEST_IDS,
} from "./chainRunner/__fixtures__/p214OrderingBaseline";
import {
  buildExecutionOrder,
  CircularDependencyError,
  DEFAULT_CONCURRENCY,
  InjectionError,
  MAX_SCHEDULER_DEPTH,
  runChain,
  SchedulerDepthExceededError,
} from "./chainRunner";

function rq(id: string, overrides?: Partial<RequestModel>): RequestModel {
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
    ...overrides,
  };
}

describe("buildExecutionOrder", () => {
  it("orders nodes in dependency order", () => {
    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [],
      },
    ];
    expect(buildExecutionOrder([a, b], edges)).toEqual(["a", "b"]);
  });

  it("throws CircularDependencyError when a cycle exists", () => {
    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [],
      },
      {
        id: "e2",
        sourceRequestId: "b",
        targetRequestId: "a",
        injections: [],
      },
    ];
    expect(() => buildExecutionOrder([a, b], edges)).toThrow(
      CircularDependencyError,
    );
  });

  it("returns offending node IDs when a cycle is detected", () => {
    const a = rq("a");
    const b = rq("b");
    const c = rq("c");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [],
      },
      {
        id: "e2",
        sourceRequestId: "b",
        targetRequestId: "a",
        injections: [],
      },
      {
        id: "e3",
        sourceRequestId: "c",
        targetRequestId: "a",
        injections: [],
      },
    ];
    try {
      buildExecutionOrder([a, b, c], edges);
      expect.fail("Should have thrown CircularDependencyError");
    } catch (err) {
      expect(err).toBeInstanceOf(CircularDependencyError);
      expect((err as CircularDependencyError).nodeIds).toContain("a");
      expect((err as CircularDependencyError).nodeIds).toContain("b");
    }
  });
});

describe("runChain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs API nodes sequentially and marks them passed", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [],
      },
    ];

    const updates: Array<{ id: string; state: string }> = [];
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state) => {
        if (state === "running" || state === "passed" || state === "failed") {
          updates.push({ id, state });
        }
      },
      signal: new AbortController().signal,
    });

    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(2);
    expect(
      updates.filter((u) => u.state === "passed").map((u) => u.id),
    ).toEqual(["a", "b"]);
  });

  it("skips downstream when upstream HTTP request fails", async () => {
    vi.mocked(runRequest).mockResolvedValueOnce({
      status: 500,
      statusText: "Err",
      headers: {},
      body: "",
      duration: 1,
      size: 0,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [],
      },
    ];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
    });

    expect(states.a).toBe("failed");
    expect(states.b).toBe("skipped");
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(1);
  });

  it("marks node failed when runRequest throws", async () => {
    vi.mocked(runRequest).mockRejectedValueOnce(new Error("network down"));

    const a = rq("a");
    let finalState = "";
    let finalError: string | undefined;
    await runChain({
      requests: [a],
      edges: [],
      onUpdate: (id, state, data) => {
        if (id === "a" && state === "failed") {
          finalState = state;
          finalError = data.error;
        }
      },
      signal: new AbortController().signal,
    });

    expect(finalState).toBe("failed");
    expect(finalError).toBe("network down");
  });

  it("fails node when assertions do not pass", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const assertions: ChainAssertion[] = [
      {
        id: "as1",
        source: "status",
        operator: "eq",
        expectedValue: "404",
        enabled: true,
      },
    ];

    let finalState = "";
    await runChain({
      requests: [a],
      edges: [],
      onUpdate: (id, state) => {
        if (id === "a" && (state === "passed" || state === "failed")) {
          finalState = state;
        }
      },
      signal: new AbortController().signal,
      nodeAssertions: { a: assertions },
    });

    expect(finalState).toBe("failed");
  });

  it("marks every cycle node failed when graph has a circular dependency", async () => {
    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [],
      },
      {
        id: "e2",
        sourceRequestId: "b",
        targetRequestId: "a",
        injections: [],
      },
    ];

    const failed: string[] = [];
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state, data) => {
        if (state === "failed" && data.error?.includes("Circular")) {
          failed.push(id);
        }
      },
      signal: new AbortController().signal,
    });

    expect(failed.sort()).toEqual(["a", "b"]);
    expect(vi.mocked(runRequest)).not.toHaveBeenCalled();
  });

  it("reports only true cycle members, including cycles through non-API blocks", () => {
    const a = rq("a");
    const edge = (id: string, from: string, to: string): ChainEdge => ({
      id,
      sourceRequestId: from,
      targetRequestId: to,
      injections: [],
    });
    // a -> m(erge) -> l(oop) -> m is a cycle; d only hangs off it.
    const edges = [
      edge("e1", "a", "m"),
      edge("e2", "m", "l"),
      edge("e3", "l", "m"),
      edge("e4", "l", "d"),
    ];
    try {
      buildExecutionOrder([a, rq("d")], edges, ["m", "l"]);
      expect.fail("Should have thrown CircularDependencyError");
    } catch (err) {
      expect(err).toBeInstanceOf(CircularDependencyError);
      expect((err as CircularDependencyError).nodeIds.sort()).toEqual(["l", "m"]);
    }
  });

  it("a throwing executor at concurrency 4 fails only its node and does not orphan siblings", async () => {
    const okResponse = (body: string) => ({
      status: 200,
      statusText: "OK",
      headers: {},
      body,
      duration: 1,
      size: body.length,
      url: "",
      method: "GET" as const,
      timestamp: 0,
    });
    vi.mocked(runRequest).mockImplementation(async (request) => {
      if (request.url === rq("sibling").url) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return okResponse("{}");
      }
      return okResponse(JSON.stringify({ id: "x" }));
    });

    const states: Record<string, string> = {};
    await runChain({
      requests: [rq("a"), rq("b"), rq("sibling")],
      edges: [
        {
          id: "e1",
          sourceRequestId: "a",
          targetRequestId: "b",
          injections: [
            {
              sourceJsonPath: "$.id",
              targetField: "header",
              targetKey: "X-Id",
            },
          ],
        },
      ],
      envPromotions: [{ edgeId: "e1", envId: "env", envVarName: "V" }],
      onPromoteToEnv: () => {
        throw new Error("promotion exploded");
      },
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      concurrency: 4,
    });

    expect(states.b).toBe("failed");
    expect(states.sibling).toBe("passed");
  });

  it("skips remaining nodes when run is aborted during a delay node", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "d",
        injections: [],
      },
      {
        id: "e2",
        sourceRequestId: "d",
        targetRequestId: "b",
        injections: [],
      },
    ];

    const ac = new AbortController();
    let delaySawRunning = false;
    const states: Record<string, string> = {};
    const errors: Record<string, string | undefined> = {};

    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state, data) => {
        if (id === "d" && state === "running") {
          delaySawRunning = true;
          ac.abort();
        }
        if (state !== "running") {
          states[id] = state;
          errors[id] = data.error;
        }
      },
      signal: ac.signal,
      delayNodes: [{ id: "d", type: "delay", delayMs: 60_000 }],
    });

    expect(delaySawRunning).toBe(true);
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(1);
    // Abort semantics: the in-flight delay node ends `aborted`, not `skipped`.
    expect(states.d).toBe("aborted");
    expect(errors.d).toBe("Run stopped");
    expect(states.b).toBe("skipped");
  });

  it("skips success-branch downstream when upstream request fails", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 500,
      statusText: "Err",
      headers: {},
      body: "",
      duration: 1,
      size: 0,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        branchId: "success",
        injections: [],
      },
    ];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
    });

    expect(states.a).toBe("failed");
    expect(states.b).toBe("skipped");
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(1);
  });

  it("runs fail-branch downstream when upstream request fails", async () => {
    vi.mocked(runRequest)
      .mockResolvedValueOnce({
        status: 500,
        statusText: "Err",
        headers: {},
        body: "",
        duration: 1,
        size: 0,
        url: "",
        method: "GET",
        timestamp: 0,
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        branchId: "fail",
        injections: [],
      },
    ];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
    });

    expect(states.a).toBe("failed");
    expect(states.b).toBe("passed");
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(2);
  });

  it("evaluates condition node and follows matching branch", async () => {
    vi.mocked(runRequest)
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({ role: "admin" }),
        duration: 1,
        size: 10,
        url: "",
        method: "GET",
        timestamp: 0,
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e_ac",
        sourceRequestId: "a",
        targetRequestId: "c",
        injections: [
          {
            sourceJsonPath: "$.role",
            targetField: "header",
            targetKey: "role",
          },
        ],
      },
      {
        id: "e_cb",
        sourceRequestId: "c",
        targetRequestId: "b",
        branchId: "br1",
        injections: [],
      },
    ];

    const conditionNodes: ConditionNodeConfig[] = [
      {
        id: "c",
        type: "condition",
        variable: "{{e_ac:role}}",
        branches: [
          { id: "br1", label: "admin", expression: "== 'admin'" },
          { id: "br_else", label: "else", expression: "" },
        ],
      },
    ];

    await runChain({
      requests: [a, b],
      edges,
      onUpdate: vi.fn(),
      signal: new AbortController().signal,
      conditionNodes,
    });

    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(2);
  });

  it("runs display node and forwards extracted value into downstream request", async () => {
    vi.mocked(runRequest)
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({ token: "secret" }),
        duration: 1,
        size: 20,
        url: "",
        method: "GET",
        timestamp: 0,
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      });

    const a = rq("a");
    const b = rq("b", { headers: [] });
    const edges: ChainEdge[] = [
      {
        id: "e_ad",
        sourceRequestId: "a",
        targetRequestId: "disp",
        injections: [],
      },
      {
        id: "e_db",
        sourceRequestId: "disp",
        targetRequestId: "b",
        injections: [],
      },
    ];

    const displayNodes: DisplayBlock[] = [
      {
        id: "disp",
        type: "display",
        sourceJsonPath: "$.token",
        targetField: "header",
        targetKey: "X-Token",
      },
    ];

    await runChain({
      requests: [a, b],
      edges,
      onUpdate: vi.fn(),
      signal: new AbortController().signal,
      displayNodes,
    });

    const second = vi.mocked(runRequest).mock.calls[1]?.[0];
    expect(second?.headers.some((h) => h.key === "X-Token")).toBe(true);
    expect(second?.headers.find((h) => h.key === "X-Token")?.value).toBe(
      "secret",
    );
  });

  it("applies URL query injection from upstream JSON", async () => {
    vi.mocked(runRequest)
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({ q: "hello world" }),
        duration: 1,
        size: 30,
        url: "",
        method: "GET",
        timestamp: 0,
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      });

    const a = rq("a");
    const b = rq("b", { url: "https://api.test/search" });
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [
          {
            sourceJsonPath: "$.q",
            targetField: "url",
            targetKey: "q",
          },
        ],
      },
    ];

    await runChain({
      requests: [a, b],
      edges,
      onUpdate: vi.fn(),
      signal: new AbortController().signal,
    });

    const second = vi.mocked(runRequest).mock.calls[1]?.[0];
    expect(second?.url).toContain("q=");
    expect(second?.url).toContain(encodeURIComponent("hello world"));
  });

  it("calls onPromoteToEnv when promotion matches an edge", async () => {
    vi.mocked(runRequest)
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({ id: "promo-val" }),
        duration: 1,
        size: 30,
        url: "",
        method: "GET",
        timestamp: 0,
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [
          {
            sourceJsonPath: "$.id",
            targetField: "header",
            targetKey: "X-Id",
          },
        ],
      },
    ];

    const promote = vi.fn();
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: vi.fn(),
      signal: new AbortController().signal,
      envPromotions: [
        {
          edgeId: "e1",
          envId: "env-1",
          envVarName: "PROMOTED",
        },
      ],
      onPromoteToEnv: promote,
    });

    expect(promote).toHaveBeenCalledWith("env-1", "PROMOTED", "promo-val");
  });

  it("skips node when JSONPath extraction fails for required injection", async () => {
    vi.mocked(runRequest).mockResolvedValueOnce({
      status: 200,
      statusText: "OK",
      headers: {},
      body: JSON.stringify({ x: 1 }),
      duration: 1,
      size: 10,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [
          {
            sourceJsonPath: "$.missing",
            targetField: "header",
            targetKey: "h",
          },
        ],
      },
    ];

    let bState = "";
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state) => {
        if (id === "b" && state !== "running") bState = state;
      },
      signal: new AbortController().signal,
    });

    expect(bState).toBe("skipped");
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(1);
  });

  it("resolves environment variables in request URL before running", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a", { url: "{{baseUrl}}/api/users" });
    const resolveVariables = (text: string) =>
      text.replace("{{baseUrl}}", "https://api.test");

    await runChain({
      requests: [a],
      edges: [],
      onUpdate: () => {},
      signal: new AbortController().signal,
      resolveVariables,
    });

    expect(vi.mocked(runRequest)).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://api.test/api/users",
      }),
      expect.any(AbortSignal),
    );
  });

  it("records unresolvedVars when environment variables cannot be resolved", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a", { url: "{{baseUrl}}/users/{{userId}}" });
    const resolveVariables = (text: string) =>
      text.replace("{{baseUrl}}", "https://api.test"); // userId is unresolved

    let unresolvedVars: string[] = [];
    await runChain({
      requests: [a],
      edges: [],
      onUpdate: (id, state, data) => {
        if (data.unresolvedVars) {
          unresolvedVars = data.unresolvedVars;
        }
      },
      signal: new AbortController().signal,
      resolveVariables,
    });

    expect(unresolvedVars).toContain("userId");
    expect(unresolvedVars).not.toContain("baseUrl");
  });

  it("resolves {{alias}} in a downstream request template to an upstream extracted value (shared namespace, spec precedence)", async () => {
    vi.mocked(runRequest)
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({ token: "extracted-token" }),
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      });

    const a = rq("a");
    // b's URL template references the alias directly — no injection into a
    // header/param needed for this to resolve, proving the shared namespace
    // (not just applyInjection's targetField/targetKey write path) carries
    // the extracted value forward.
    const b = rq("b", { url: "https://api.test/b/{{token}}" });
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [
          {
            sourceJsonPath: "$.token",
            targetField: "header",
            targetKey: "token",
          },
        ],
      },
    ];

    await runChain({
      requests: [a, b],
      edges,
      onUpdate: () => {},
      signal: new AbortController().signal,
      // no env resolution needed for this scenario
      resolveVariables: (text: string) => text,
    });

    expect(vi.mocked(runRequest)).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: "https://api.test/b/extracted-token",
      }),
      expect.any(AbortSignal),
    );
  });

  it("marks node aborted with 'Run stopped' when signal is aborted during API request", async () => {
    const ac = new AbortController();
    let requestWasCalled = false;

    vi.mocked(runRequest).mockImplementation(async () => {
      requestWasCalled = true;
      ac.abort();
      throw new Error("Aborted");
    });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [],
      },
    ];

    const states: Record<string, string> = {};
    const errors: Record<string, string | undefined> = {};

    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state, data) => {
        if (state !== "running") {
          states[id] = state;
          errors[id] = data.error;
        }
      },
      signal: ac.signal,
    });

    expect(requestWasCalled).toBe(true);
    expect(states.a).toBe("aborted");
    expect(errors.a).toBe("Run stopped");
    expect(states.b).toBe("skipped");
  });

  it("marks in-flight API request aborted when abort is triggered", async () => {
    const ac = new AbortController();
    let requestSawSignal = false;

    vi.mocked(runRequest).mockImplementation(async (req, signal) => {
      requestSawSignal = signal !== undefined;
      // Return a promise that waits for abort
      return new Promise((resolve, reject) => {
        const handler = () => {
          reject(new Error("Aborted"));
        };
        if (signal?.aborted) {
          reject(new Error("Aborted"));
        } else {
          signal?.addEventListener("abort", handler);
        }
        // This will never resolve naturally; abort will trigger
        setTimeout(() => {
          signal?.removeEventListener("abort", handler);
        }, 5000);
      });
    });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [],
      },
    ];

    const states: Record<string, string> = {};
    let abortedDuringA = false;

    const runPromise = runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") {
          states[id] = state;
          if (id === "a" && state === "aborted") {
            abortedDuringA = true;
          }
        }
      },
      signal: ac.signal,
    });

    // Trigger abort after a short delay to let request start
    setTimeout(() => ac.abort(), 10);

    await runPromise;

    expect(requestSawSignal).toBe(true);
    expect(abortedDuringA).toBe(true);
    expect(states.b).toBe("skipped");
  });

  it("marks node failed with 'Body is not JSON' when injecting into form-data body", async () => {
    vi.mocked(runRequest).mockResolvedValueOnce({
      status: 200,
      statusText: "OK",
      headers: {},
      body: JSON.stringify({ value: "test-data" }),
      duration: 1,
      size: 30,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const b = rq("b", {
      body: { type: "form-data", content: "key1=value1&key2=value2" },
    });
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        injections: [
          {
            sourceJsonPath: "$.value",
            targetField: "body",
            targetKey: "$.injected",
          },
        ],
      },
    ];

    let bState = "";
    let bError = "";
    let bCode: string | undefined;
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state, data) => {
        if (id === "b" && state !== "running") {
          bState = state;
          bError = data.error ?? "";
          bCode = data.errorCode;
        }
      },
      signal: new AbortController().signal,
    });

    expect(bState).toBe("failed");
    expect(bCode).toBe("injectionBodyTypeUnsupported");
    expect(bError).toBe(
      "Body injection needs a JSON body; change the request body type to JSON",
    );
    // Ensure the second request was never called since injection failed
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(1);
  });
});

describe("runChain — Start block dispatch (real executor-map path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes a start node through the real dispatcher and resolves its inputs before downstream nodes run", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const startBlock: StartBlock = {
      id: "start-1",
      type: "start",
      inputs: [
        { key: "token", defaultValue: "default-token", source: "literal" },
      ],
    };

    const a = rq("a");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "start-1",
        targetRequestId: "a",
        injections: [],
      },
    ];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      startBlock,
    });

    // If getExecutor could not resolve "start" it would throw and the run
    // would reject instead of reaching these assertions.
    expect(states["start-1"]).toBe("passed");
    expect(states.a).toBe("passed");
  });

  it("threads a resolved chain input through the real dispatcher into the API request, shadowing an env var of the same name", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const startBlock: StartBlock = {
      id: "start-1",
      type: "start",
      inputs: [
        { key: "token", defaultValue: "input-token", source: "literal" },
      ],
    };

    const a = rq("a", { url: "https://api.test/{{token}}" });
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "start-1",
        targetRequestId: "a",
        injections: [],
      },
    ];

    // Env resolver would win if the input didn't shadow it first.
    const resolveVariables = (text: string) =>
      text.replace("{{token}}", "env-token");

    await runChain({
      requests: [a],
      edges,
      onUpdate: vi.fn(),
      signal: new AbortController().signal,
      resolveVariables,
      startBlock,
    });

    expect(vi.mocked(runRequest)).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://api.test/input-token" }),
      expect.anything(),
    );
  });
});

describe("runChain — evaluate/validate dispatch (real executor-map path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs an evaluate node and publishes its output as a synthetic response", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: '{"token":"abc123"}',
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });
    vi.mocked(runInWorker).mockResolvedValue({ output: "abc123" });

    const a = rq("a");
    const evaluateNode = {
      id: "eval-1",
      type: "evaluate" as const,
      code: "return data.response.token",
      outputAlias: "token",
    };
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "eval-1",
        injections: [],
      },
    ];

    const updates: Array<{ id: string; state: string; response?: unknown }> =
      [];
    await runChain({
      requests: [a],
      edges,
      onUpdate: (id, state, data) => {
        if (state !== "running") updates.push({ id, state, ...data });
      },
      signal: new AbortController().signal,
      evaluateNodes: [evaluateNode],
    });

    const evalUpdate = updates.find((u) => u.id === "eval-1");
    expect(evalUpdate?.state).toBe("passed");
    expect(evalUpdate?.response).toEqual(
      expect.objectContaining({ body: JSON.stringify("abc123") }),
    );
  });

  it("runs a validate node and fails with schema errors on a bad response", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: '{"name":"Ada"}',
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const validateNode = {
      id: "validate-1",
      type: "validate" as const,
      schema: JSON.stringify({
        type: "object",
        required: ["id"],
        properties: { id: { type: "number" } },
      }),
      sourceJsonPath: "",
    };
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "validate-1",
        injections: [],
      },
    ];

    const updates: Array<{ id: string; state: string; error?: string }> = [];
    await runChain({
      requests: [a],
      edges,
      onUpdate: (id, state, data) => {
        if (state !== "running") updates.push({ id, state, ...data });
      },
      signal: new AbortController().signal,
      validateNodes: [validateNode],
    });

    const validateUpdate = updates.find((u) => u.id === "validate-1");
    expect(validateUpdate?.state).toBe("failed");
    expect(validateUpdate?.error).toMatch(/id/);
  });

  it("passes a validate node when the response conforms to the schema", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: '{"id":1,"name":"Ada"}',
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const validateNode = {
      id: "validate-1",
      type: "validate" as const,
      schema: JSON.stringify({ type: "object", required: ["id"] }),
      sourceJsonPath: "",
    };
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "validate-1",
        injections: [],
      },
    ];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      validateNodes: [validateNode],
    });

    expect(states["validate-1"]).toBe("passed");
  });
});

describe("runChain — concurrency and Merge blocks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("defaults to DEFAULT_CONCURRENCY when no concurrency argument is passed", () => {
    expect(DEFAULT_CONCURRENCY).toBe(4);
  });

  it("runs independent branches concurrently when concurrency > 1", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(runRequest).mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      };
    });

    // a and b have no edge between them — independent branches.
    const a = rq("a");
    const b = rq("b");

    await runChain({
      requests: [a, b],
      edges: [],
      onUpdate: vi.fn(),
      signal: new AbortController().signal,
      concurrency: 4,
    });

    expect(maxInFlight).toBe(2);
  });

  it("throws SchedulerDepthExceededError once schedulerDepth exceeds MAX_SCHEDULER_DEPTH", async () => {
    const a = rq("a");

    await expect(
      runChain({
        requests: [a],
        edges: [],
        onUpdate: vi.fn(),
        signal: new AbortController().signal,
        concurrency: DEFAULT_CONCURRENCY,
        schedulerDepth: MAX_SCHEDULER_DEPTH + 1,
      }),
    ).rejects.toThrow(SchedulerDepthExceededError);

    expect(vi.mocked(runRequest)).not.toHaveBeenCalled();
  });

  it("concurrency = 1 reproduces the sequential baseline order", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const b = rq("b");
    const c = rq("c");
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "a", targetRequestId: "c", injections: [] },
      { id: "e2", sourceRequestId: "b", targetRequestId: "c", injections: [] },
    ];

    const passOrder: string[] = [];
    const onUpdate = (id: string, state: string) => {
      if (state === "passed") passOrder.push(id);
    };

    await runChain({
      requests: [a, b, c],
      edges,
      onUpdate,
      signal: new AbortController().signal,
      concurrency: 1,
    });

    // Baseline captured from the pre-Phase-7 concurrency = 1 walk: FIFO
    // ready-queue dequeue order (a, b both ready first, then c).
    expect(passOrder).toEqual(["a", "b", "c"]);
  });

  it("skip-table: all inputs skipped propagates skip", async () => {
    vi.mocked(runRequest).mockRejectedValueOnce(new Error("boom"));

    const a = rq("a");
    const b = rq("b");
    const c = rq("c");
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "a", targetRequestId: "b", injections: [] },
      { id: "e2", sourceRequestId: "b", targetRequestId: "c", injections: [] },
    ];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b, c],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
    });

    expect(states.a).toBe("failed");
    expect(states.b).toBe("skipped");
    expect(states.c).toBe("skipped");
  });

  it("skip-table: fail-branch downstream runs when source fails (not skipped)", async () => {
    vi.mocked(runRequest)
      .mockResolvedValueOnce({
        status: 500,
        statusText: "Err",
        headers: {},
        body: "",
        duration: 1,
        size: 0,
        url: "",
        method: "GET",
        timestamp: 0,
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e1",
        sourceRequestId: "a",
        targetRequestId: "b",
        branchId: "fail",
        injections: [],
      },
    ];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
    });

    expect(states.a).toBe("failed");
    expect(states.b).toBe("passed");
  });

  it("skip-table: condition losing branch is skipped", async () => {
    vi.mocked(runRequest)
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: JSON.stringify({ role: "guest" }),
        duration: 1,
        size: 10,
        url: "",
        method: "GET",
        timestamp: 0,
      })
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      {
        id: "e_ac",
        sourceRequestId: "a",
        targetRequestId: "c",
        injections: [
          {
            sourceJsonPath: "$.role",
            targetField: "header",
            targetKey: "role",
          },
        ],
      },
      {
        id: "e_cb",
        sourceRequestId: "c",
        targetRequestId: "b",
        branchId: "br1",
        injections: [],
      },
    ];

    const conditionNodes: ConditionNodeConfig[] = [
      {
        id: "c",
        type: "condition",
        variable: "{{e_ac:role}}",
        branches: [
          { id: "br1", label: "admin", expression: "== 'admin'" },
          { id: "br_else", label: "else", expression: "" },
        ],
      },
    ];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      conditionNodes,
    });

    expect(states.c).toBe("passed");
    expect(states.b).toBe("skipped");
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(1);
  });

  it("skip-table: Merge mode 'all' skips when any input did not pass", async () => {
    vi.mocked(runRequest)
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      })
      .mockRejectedValueOnce(new Error("boom"));

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "a", targetRequestId: "m", injections: [] },
      { id: "e2", sourceRequestId: "b", targetRequestId: "m", injections: [] },
    ];
    const mergeNodes: MergeBlock[] = [{ id: "m", type: "merge", mode: "all" }];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      mergeNodes,
    });

    expect(states.a).toBe("passed");
    expect(states.b).toBe("failed");
    expect(states.m).toBe("skipped");
  });

  it("skip-table: Merge mode 'any' passes when at least one input passed", async () => {
    vi.mocked(runRequest)
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      })
      .mockRejectedValueOnce(new Error("boom"));

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "a", targetRequestId: "m", injections: [] },
      { id: "e2", sourceRequestId: "b", targetRequestId: "m", injections: [] },
    ];
    const mergeNodes: MergeBlock[] = [{ id: "m", type: "merge", mode: "any" }];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      mergeNodes,
    });

    expect(states.a).toBe("passed");
    expect(states.b).toBe("failed");
    expect(states.m).toBe("passed");
  });

  it("regression: downstream API node runs and passes after Merge mode 'all' passes", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const b = rq("b");
    const next = rq("next");
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "a", targetRequestId: "m", injections: [] },
      { id: "e2", sourceRequestId: "b", targetRequestId: "m", injections: [] },
      {
        id: "e3",
        sourceRequestId: "m",
        targetRequestId: "next",
        injections: [],
      },
    ];
    const mergeNodes: MergeBlock[] = [{ id: "m", type: "merge", mode: "all" }];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b, next],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      mergeNodes,
    });

    expect(states.a).toBe("passed");
    expect(states.b).toBe("passed");
    expect(states.m).toBe("passed");
    expect(states.next).toBe("passed");
  });

  it("regression: downstream API node runs exactly once after Merge mode 'any' fires early", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const b = rq("b");
    const next = rq("next");
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "a", targetRequestId: "m", injections: [] },
      { id: "e2", sourceRequestId: "b", targetRequestId: "m", injections: [] },
      {
        id: "e3",
        sourceRequestId: "m",
        targetRequestId: "next",
        injections: [],
      },
    ];
    const mergeNodes: MergeBlock[] = [{ id: "m", type: "merge", mode: "any" }];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b, next],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      mergeNodes,
      // concurrency = 1: deterministic early-fire ordering
      concurrency: 1,
    });

    expect(states.a).toBe("passed");
    expect(states.b).toBe("skipped");
    expect(states.m).toBe("passed");
    expect(states.next).toBe("passed");
    // `next` must run exactly once — not once per resolved merge branch.
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(2); // a + next
  });

  it("regression: downstream node is skipped when Merge mode 'all' skips", async () => {
    vi.mocked(runRequest)
      .mockResolvedValueOnce({
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      })
      .mockRejectedValueOnce(new Error("boom"));

    const a = rq("a");
    const b = rq("b");
    const next = rq("next");
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "a", targetRequestId: "m", injections: [] },
      { id: "e2", sourceRequestId: "b", targetRequestId: "m", injections: [] },
      {
        id: "e3",
        sourceRequestId: "m",
        targetRequestId: "next",
        injections: [],
      },
    ];
    const mergeNodes: MergeBlock[] = [{ id: "m", type: "merge", mode: "all" }];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b, next],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      mergeNodes,
    });

    expect(states.a).toBe("passed");
    expect(states.b).toBe("failed");
    expect(states.m).toBe("skipped");
    expect(states.next).toBe("skipped");
  });

  it("regression: a Condition node downstream of a passing Merge evaluates its branch instead of being skipped for lack of a response", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const b = rq("b");
    const onSuccess = rq("onSuccess");
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "a", targetRequestId: "m", injections: [] },
      { id: "e2", sourceRequestId: "b", targetRequestId: "m", injections: [] },
      {
        id: "e3",
        sourceRequestId: "m",
        targetRequestId: "cond",
        injections: [],
      },
      {
        id: "e4",
        sourceRequestId: "cond",
        targetRequestId: "onSuccess",
        branchId: "true",
        injections: [],
      },
    ];
    const mergeNodes: MergeBlock[] = [{ id: "m", type: "merge", mode: "all" }];
    const conditionNodes: ConditionNodeConfig[] = [
      {
        id: "cond",
        type: "condition",
        variable: "{{unused}}",
        // Empty expression = the else branch, which always matches — this
        // test only needs the node to run and resolve, not to exercise
        // condition-matching logic.
        branches: [{ id: "true", label: "true", expression: "" }],
      },
    ];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b, onSuccess],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      conditionNodes,
      mergeNodes,
    });

    expect(states.m).toBe("passed");
    expect(states.cond).toBe("passed");
  });

  it("Merge mode 'any' fires early: an un-started sibling lane is skipped without ever dispatching", async () => {
    // concurrency = 1 keeps `b` off the ready queue entirely while `a` runs,
    // so once `a` passes and the Merge fires, `b` must be short-circuited to
    // "skipped" instead of ever being dispatched to the executor.
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "a", targetRequestId: "m", injections: [] },
      { id: "e2", sourceRequestId: "b", targetRequestId: "m", injections: [] },
    ];
    const mergeNodes: MergeBlock[] = [{ id: "m", type: "merge", mode: "any" }];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      mergeNodes,
      // concurrency = 1: `b` never leaves the ready queue before `m` fires
      concurrency: 1,
    });

    expect(states.a).toBe("passed");
    expect(states.b).toBe("skipped");
    expect(states.m).toBe("passed");
    // Only `a` was ever dispatched to the executor — `b` was short-circuited.
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(1);
  });

  it("Merge mode 'any' fires early: a slower in-flight sibling branch is cut and recorded skipped", async () => {
    // `a` resolves on the next microtask; `b` is deliberately slower (an
    // extra microtask hop) and already in-flight (concurrency = 2 dispatches
    // both at once) when `a` passes. The Merge fires as soon as `a` passes
    // (spec: remaining lanes are skipped), so `b` ends skipped even though
    // its request was already dispatched.
    const order: string[] = [];
    vi.mocked(runRequest).mockImplementation(async (request) => {
      if (request.url === b.url) {
        // Extra hop makes `b` resolve strictly after `a`.
        await Promise.resolve();
        await Promise.resolve();
      }
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      };
    });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "a", targetRequestId: "m", injections: [] },
      { id: "e2", sourceRequestId: "b", targetRequestId: "m", injections: [] },
    ];
    const mergeNodes: MergeBlock[] = [{ id: "m", type: "merge", mode: "any" }];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") {
          states[id] = state;
          order.push(`${id} ${state}`);
        }
      },
      signal: new AbortController().signal,
      mergeNodes,
      // concurrency = 2: both `a` and `b` are in-flight simultaneously
      concurrency: 2,
    });

    expect(states.a).toBe("passed");
    expect(states.b).toBe("skipped");
    expect(states.m).toBe("passed");
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(2);
    // `b`'s own executor result is never surfaced — only the skip.
    expect(order.filter((entry) => entry.startsWith("b "))).toEqual([
      "b skipped",
    ]);
  });

  it("skip-table: aborting mid-run skips nodes that never started", async () => {
    const ac = new AbortController();
    vi.mocked(runRequest).mockImplementation(async () => {
      ac.abort();
      return {
        status: 200,
        statusText: "OK",
        headers: {},
        body: "{}",
        duration: 1,
        size: 2,
        url: "",
        method: "GET",
        timestamp: 0,
      };
    });

    const a = rq("a");
    const b = rq("b");
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "a", targetRequestId: "b", injections: [] },
    ];

    const states: Record<string, string> = {};
    await runChain({
      requests: [a, b],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: ac.signal,
    });

    expect(states.a).toBe("passed");
    expect(states.b).toBe("skipped");
  });
});

describe("loop/collect runner integration (P8.7)", () => {
  const ok = (body: string) => ({
    status: 200,
    statusText: "OK",
    headers: {},
    body,
    duration: 1,
    size: body.length,
    url: "",
    method: "GET" as const,
    timestamp: 0,
  });

  function buildLoopChain() {
    const upstream = rq("upstream");
    const bodyReq = rq("body-1");
    const downstream = rq("downstream");
    const edges: ChainEdge[] = [
      {
        id: "e-u-loop",
        sourceRequestId: "upstream",
        targetRequestId: "loop",
        injections: [],
      },
      {
        id: "e-loop-body",
        sourceRequestId: "loop",
        targetRequestId: "body-1",
        injections: [],
        branchId: LOOP_BODY_HANDLE_ID,
      },
      {
        id: "e-loop-collect",
        sourceRequestId: "loop",
        targetRequestId: "collect",
        injections: [],
        branchId: LOOP_DONE_HANDLE_ID,
      },
      {
        id: "e-collect-downstream",
        sourceRequestId: "collect",
        targetRequestId: "downstream",
        injections: [
          {
            sourceJsonPath: "$[0]['body-1'].state",
            targetField: "header",
            targetKey: "x-collected",
          },
        ],
      },
    ];
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
    return { upstream, bodyReq, downstream, edges, loopNodes, collectNodes };
  }

  it("dispatches loop and collect, exposing collect.<id> to a downstream injection", async () => {
    const { upstream, bodyReq, downstream, edges, loopNodes, collectNodes } =
      buildLoopChain();

    vi.mocked(runRequest).mockImplementation(async (req) => {
      if (req.url.includes("/upstream")) {
        return ok(JSON.stringify({ items: ["a", "b", "c"] }));
      }
      return ok("{}");
    });

    const states: Record<string, string> = {};
    await runChain({
      requests: [upstream, bodyReq, downstream],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      concurrency: DEFAULT_CONCURRENCY,
      schedulerDepth: 0,
      loopNodes,
      collectNodes,
    });

    expect(states.upstream).toBe("passed");
    expect(states.loop).toBe("passed");
    expect(states.collect).toBe("passed");
    expect(states.downstream).toBe("passed");
    // body-1 ran once per item (3 items).
    const bodyCalls = vi
      .mocked(runRequest)
      .mock.calls.filter(([req]) => req.url.includes("/body-1"));
    expect(bodyCalls).toHaveLength(3);

    // The header actually injected into the downstream request carries the
    // collected array — verified via the request runRequest received.
    const downstreamCall = vi
      .mocked(runRequest)
      .mock.calls.find(([req]) => req.url.includes("/downstream"));
    const headerValue = downstreamCall?.[0].headers.find(
      (h) => h.key === "x-collected",
    )?.value;
    expect(headerValue).toBe("passed");
  });

  it("skips the paired Collect when the Loop itself is skipped upstream", async () => {
    const { bodyReq, downstream, edges, loopNodes, collectNodes } =
      buildLoopChain();
    // No upstream response at all — loop has nothing to iterate, and its
    // failure should also settle Collect + advance downstream.
    const upstreamFailing = rq("upstream");
    vi.mocked(runRequest).mockImplementation(async (req) => {
      if (req.url.includes("/upstream")) throw new Error("boom");
      return ok("{}");
    });

    const states: Record<string, string> = {};
    await runChain({
      requests: [upstreamFailing, bodyReq, downstream],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      concurrency: DEFAULT_CONCURRENCY,
      schedulerDepth: 0,
      loopNodes,
      collectNodes,
    });

    expect(states.upstream).toBe("failed");
    expect(states.loop).toBe("skipped");
    expect(states.collect).toBe("skipped");
    expect(states.downstream).toBe("skipped");
  });
});

describe("runChain — subchain dispatch", () => {
  beforeEach(() => {
    vi.mocked(runRequest).mockReset();
  });

  it("dispatches a subchain node, running the referenced chain's graph via resolveSubChainGraph", async () => {
    const outer = rq("outer");
    const referenced = rq("referenced-req");
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const subChainBlocks: SubChainBlock[] = [
      {
        id: "sub-1",
        type: "subchain",
        chainId: "referenced-chain",
        inputBindings: {},
      },
    ];
    const edges: ChainEdge[] = [
      {
        id: "e-outer-sub",
        sourceRequestId: "outer",
        targetRequestId: "sub-1",
        injections: [],
      },
    ];

    const states: Record<string, string> = {};
    const nestedParents: Record<string, string | undefined> = {};
    await runChain({
      requests: [outer],
      edges,
      onUpdate: (id, state, data) => {
        if (state !== "running") {
          states[id] = state;
          nestedParents[id] = data.parentStepId;
        }
      },
      signal: new AbortController().signal,
      concurrency: DEFAULT_CONCURRENCY,
      schedulerDepth: 0,
      subChainBlocks,
      resolveSubChainGraph: (chainId) =>
        chainId === "referenced-chain"
          ? { requests: [referenced], edges: [] }
          : undefined,
    });

    expect(states.outer).toBe("passed");
    expect(states["sub-1"]).toBe("passed");
    // The referenced chain's own request ran as a nested step, tagged with
    // the SubChain block's id as its parentStepId (run-log nesting, P9.8).
    expect(states["referenced-req"]).toBe("passed");
    expect(nestedParents["referenced-req"]).toBe("sub-1");
  });

  it("fails a subchain node when resolveSubChainGraph cannot resolve the reference", async () => {
    const outer = rq("outer");
    const subChainBlocks: SubChainBlock[] = [
      {
        id: "sub-1",
        type: "subchain",
        chainId: "deleted-chain",
        inputBindings: {},
      },
    ];
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });

    const states: Record<string, string> = {};
    await runChain({
      requests: [outer],
      edges: [],
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      concurrency: DEFAULT_CONCURRENCY,
      schedulerDepth: 0,
      subChainBlocks,
      resolveSubChainGraph: () => undefined,
    });

    expect(states["sub-1"]).toBe("failed");
  });
});

/** `rq(id)` gives every request the url `https://api.test/<id>`; the runner passes only the url on. */
const sentId = (sent: { url: string }) => sent.url.split("/").pop() ?? "";

describe("runChain — scheduler concurrency limits (CR-034)", () => {
  const okResponse: ResponseData = {
    status: 200,
    statusText: "OK",
    headers: {},
    body: "{}",
    duration: 1,
    size: 2,
    url: "",
    method: "GET",
    timestamp: 0,
  };

  type Deferred = { id: string; release: () => void; fail: () => void };

  /** Each request blocks on a deferred promise so in-flight counts are observable. */
  function mockGatedRequests() {
    const started: Deferred[] = [];
    const tracker = { inFlight: 0, maxInFlight: 0 };
    vi.mocked(runRequest).mockImplementation(
      (request) =>
        new Promise((resolve, reject) => {
          tracker.inFlight += 1;
          tracker.maxInFlight = Math.max(tracker.maxInFlight, tracker.inFlight);
          started.push({
            id: sentId(request),
            release: () => {
              tracker.inFlight -= 1;
              resolve(okResponse);
            },
            fail: () => {
              tracker.inFlight -= 1;
              reject(new Error("boom"));
            },
          });
        }),
    );
    return { started, tracker };
  }

  const independent = (count: number) =>
    Array.from({ length: count }, (_, i) => rq(`n${i}`));

  async function drain(started: Deferred[], total: number) {
    let released = 0;
    while (released < total) {
      await vi.waitFor(() => expect(started.length).toBeGreaterThan(released));
      started[released].release();
      released += 1;
    }
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("concurrency = 1 never has more than one request in flight", async () => {
    const { started, tracker } = mockGatedRequests();
    const run = runChain({
      requests: independent(4),
      edges: [],
      onUpdate: vi.fn(),
      signal: new AbortController().signal,
      concurrency: 1,
    });
    await drain(started, 4);
    await run;

    expect(tracker.maxInFlight).toBe(1);
  });

  it("throttles N independent nodes to the concurrency limit", async () => {
    const { started, tracker } = mockGatedRequests();
    const run = runChain({
      requests: independent(6),
      edges: [],
      onUpdate: vi.fn(),
      signal: new AbortController().signal,
      concurrency: 2,
    });

    await vi.waitFor(() => expect(started).toHaveLength(2));
    // Give the scheduler a chance to (wrongly) start more before we release.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toHaveLength(2);

    await drain(started, 6);
    await run;
    expect(tracker.maxInFlight).toBe(2);
  });

  it("aborting with several branches in flight resolves without dispatching dependents", async () => {
    const { started } = mockGatedRequests();
    const controller = new AbortController();
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "n0", targetRequestId: "dep", injections: [] },
    ];
    const states: Record<string, string> = {};
    const run = runChain({
      requests: [...independent(3), rq("dep")],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: controller.signal,
      concurrency: 3,
    });

    await vi.waitFor(() => expect(started).toHaveLength(3));
    controller.abort();
    started.forEach((call) => {
      call.release();
    });
    await expect(run).resolves.not.toThrow();

    expect(started.map((call) => call.id)).not.toContain("dep");
    expect(states.dep).toBe("skipped");
  });

  it("a throwing request at concurrency > 1 fails only its own lane and the run settles", async () => {
    vi.mocked(runRequest).mockImplementation(async (request) => {
      if (sentId(request) === "bad") throw new Error("boom");
      return okResponse;
    });
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "bad", targetRequestId: "after", injections: [] },
    ];
    const states: Record<string, string> = {};

    await runChain({
      requests: [rq("bad"), rq("good"), rq("after")],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      concurrency: 3,
    });

    expect(states).toEqual({ bad: "failed", good: "passed", after: "skipped" });
  });

  it("a shared predecessor runs exactly once when several branches depend on it", async () => {
    vi.mocked(runRequest).mockResolvedValue(okResponse);
    const edges: ChainEdge[] = [
      { id: "e1", sourceRequestId: "a", targetRequestId: "b", injections: [] },
      { id: "e2", sourceRequestId: "a", targetRequestId: "c", injections: [] },
      { id: "e3", sourceRequestId: "b", targetRequestId: "m", injections: [] },
      { id: "e4", sourceRequestId: "c", targetRequestId: "m", injections: [] },
    ];
    const states: Record<string, string> = {};

    await runChain({
      requests: [rq("a"), rq("b"), rq("c")],
      edges,
      onUpdate: (id, state) => {
        if (state !== "running") states[id] = state;
      },
      signal: new AbortController().signal,
      mergeNodes: [{ id: "m", type: "merge", mode: "all" }],
      concurrency: 4,
    });

    const dispatched = vi.mocked(runRequest).mock.calls.map(([r]) => sentId(r));
    expect(dispatched.filter((id) => id === "a")).toHaveLength(1);
    expect(states.m).toBe("passed");
  });

  describe("Condition feeding a Merge", () => {
    const conditionBranchEdges: ChainEdge[] = [
      {
        id: "e_ac",
        sourceRequestId: "a",
        targetRequestId: "cond",
        injections: [
          { sourceJsonPath: "$.role", targetField: "header", targetKey: "role" },
        ],
      },
      {
        id: "e_x",
        sourceRequestId: "cond",
        targetRequestId: "x",
        branchId: "br1",
        injections: [],
      },
      {
        id: "e_y",
        sourceRequestId: "cond",
        targetRequestId: "y",
        branchId: "br_else",
        injections: [],
      },
      { id: "e_xm", sourceRequestId: "x", targetRequestId: "m", injections: [] },
      { id: "e_ym", sourceRequestId: "y", targetRequestId: "m", injections: [] },
    ];
    const conditionNodes: ConditionNodeConfig[] = [
      {
        id: "cond",
        type: "condition",
        variable: "{{e_ac:role}}",
        branches: [
          { id: "br1", label: "admin", expression: "== 'admin'" },
          { id: "br_else", label: "else", expression: "" },
        ],
      },
    ];

    async function runWithMode(mode: MergeBlock["mode"]) {
      vi.mocked(runRequest).mockImplementation(async (request) => ({
        ...okResponse,
        body: sentId(request) === "a" ? JSON.stringify({ role: "guest" }) : "{}",
      }));
      const states: Record<string, string> = {};
      await runChain({
        requests: [rq("a"), rq("x"), rq("y")],
        edges: conditionBranchEdges,
        onUpdate: (id, state) => {
          if (state !== "running") states[id] = state;
        },
        signal: new AbortController().signal,
        conditionNodes,
        mergeNodes: [{ id: "m", type: "merge", mode }],
        concurrency: 4,
      });
      return states;
    }

    it("mode 'any' passes when only the taken branch reaches the Merge", async () => {
      const states = await runWithMode("any");
      expect(states).toMatchObject({ x: "skipped", y: "passed", m: "passed" });
    });

    it("mode 'all' skips because the losing branch never passes", async () => {
      const states = await runWithMode("all");
      expect(states).toMatchObject({ x: "skipped", y: "passed", m: "skipped" });
    });
  });
});

describe("runChain — P2.14 ordering baseline fixture at concurrency 1", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("executes the fixture DAG in the recorded Kahn / insertion order", async () => {
    vi.mocked(runRequest).mockResolvedValue({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "{}",
      duration: 1,
      size: 2,
      url: "",
      method: "GET",
      timestamp: 0,
    });
    const requests = P214_REQUEST_IDS.map((id) => rq(id));
    const transitions: string[] = [];

    await runChain({
      requests,
      edges: P214_EDGES,
      onUpdate: (id, state) => {
        transitions.push(`${id}:${state}`);
      },
      signal: new AbortController().signal,
      concurrency: 1,
    });

    const dispatched = vi.mocked(runRequest).mock.calls.map(([r]) => sentId(r));
    expect(dispatched).toEqual(buildExecutionOrder(requests, P214_EDGES));
    expect(transitions).toMatchInlineSnapshot(`
      [
        "side:running",
        "side:passed",
        "root:running",
        "root:passed",
        "left:running",
        "left:passed",
        "right:running",
        "right:passed",
        "join:running",
        "join:passed",
        "tail:running",
        "tail:passed",
      ]
    `);
  });
});
