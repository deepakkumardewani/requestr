import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestModel } from "@/types";
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
} from "@/components/chain/nodes/LoopNode";

vi.mock("@/lib/requestRunner", () => ({
  runRequest: vi.fn(),
}));

vi.mock("@/lib/chainEvalHost", () => ({
  runInWorker: vi.fn(),
}));

import { runInWorker } from "@/lib/chainEvalHost";
import { runRequest } from "@/lib/requestRunner";
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
    await runChain(
      [a, b],
      edges,
      (id, state) => {
        if (state === "running" || state === "passed" || state === "failed") {
          updates.push({ id, state });
        }
      },
      new AbortController().signal,
    );

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
    await runChain(
      [a, b],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
    );

    expect(states.a).toBe("failed");
    expect(states.b).toBe("skipped");
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(1);
  });

  it("marks node failed when runRequest throws", async () => {
    vi.mocked(runRequest).mockRejectedValueOnce(new Error("network down"));

    const a = rq("a");
    let finalState = "";
    let finalError: string | undefined;
    await runChain(
      [a],
      [],
      (id, state, data) => {
        if (id === "a" && state === "failed") {
          finalState = state;
          finalError = data.error;
        }
      },
      new AbortController().signal,
    );

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
    await runChain(
      [a],
      [],
      (id, state) => {
        if (id === "a" && (state === "passed" || state === "failed")) {
          finalState = state;
        }
      },
      new AbortController().signal,
      { a: assertions },
    );

    expect(finalState).toBe("failed");
  });

  it("marks every node skipped when graph has a circular dependency", async () => {
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

    const skipped: string[] = [];
    await runChain(
      [a, b],
      edges,
      (id, state, data) => {
        if (state === "skipped" && data.error?.includes("Circular")) {
          skipped.push(id);
        }
      },
      new AbortController().signal,
    );

    expect(skipped.sort()).toEqual(["a", "b"]);
    expect(vi.mocked(runRequest)).not.toHaveBeenCalled();
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

    await runChain(
      [a, b],
      edges,
      (id, state, data) => {
        if (id === "d" && state === "running") {
          delaySawRunning = true;
          ac.abort();
        }
        if (state !== "running") {
          states[id] = state;
          errors[id] = data.error;
        }
      },
      ac.signal,
      undefined,
      [{ id: "d", type: "delay", delayMs: 60_000 }],
    );

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
    await runChain(
      [a, b],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
    );

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
    await runChain(
      [a, b],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
    );

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

    await runChain(
      [a, b],
      edges,
      vi.fn(),
      new AbortController().signal,
      undefined,
      undefined,
      conditionNodes,
    );

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

    await runChain(
      [a, b],
      edges,
      vi.fn(),
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      displayNodes,
    );

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

    await runChain([a, b], edges, vi.fn(), new AbortController().signal);

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
    await runChain(
      [a, b],
      edges,
      vi.fn(),
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      [
        {
          edgeId: "e1",
          envId: "env-1",
          envVarName: "PROMOTED",
        },
      ],
      promote,
    );

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
    await runChain(
      [a, b],
      edges,
      (id, state) => {
        if (id === "b" && state !== "running") bState = state;
      },
      new AbortController().signal,
    );

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

    await runChain(
      [a],
      [],
      () => {},
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      resolveVariables,
    );

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
    await runChain(
      [a],
      [],
      (id, state, data) => {
        if (data.unresolvedVars) {
          unresolvedVars = data.unresolvedVars;
        }
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      resolveVariables,
    );

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

    await runChain(
      [a, b],
      edges,
      () => {},
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      (text: string) => text, // no env resolution needed for this scenario
    );

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

    await runChain(
      [a, b],
      edges,
      (id, state, data) => {
        if (state !== "running") {
          states[id] = state;
          errors[id] = data.error;
        }
      },
      ac.signal,
    );

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

    const runPromise = runChain(
      [a, b],
      edges,
      (id, state) => {
        if (state !== "running") {
          states[id] = state;
          if (id === "a" && state === "aborted") {
            abortedDuringA = true;
          }
        }
      },
      ac.signal,
    );

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
    await runChain(
      [a, b],
      edges,
      (id, state, data) => {
        if (id === "b" && state !== "running") {
          bState = state;
          bError = data.error ?? "";
        }
      },
      new AbortController().signal,
    );

    expect(bState).toBe("failed");
    expect(bError).toBe("Body is not JSON");
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
      inputs: [{ key: "token", defaultValue: "default-token", source: "literal" }],
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
    await runChain(
      [a],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      startBlock,
    );

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
      inputs: [{ key: "token", defaultValue: "input-token", source: "literal" }],
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

    await runChain(
      [a],
      edges,
      vi.fn(),
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      resolveVariables,
      startBlock,
    );

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
    await runChain(
      [a],
      edges,
      (id, state, data) => {
        if (state !== "running") updates.push({ id, state, ...data });
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [evaluateNode],
    );

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
    await runChain(
      [a],
      edges,
      (id, state, data) => {
        if (state !== "running") updates.push({ id, state, ...data });
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [validateNode],
    );

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
    await runChain(
      [a],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [validateNode],
    );

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

    await runChain(
      [a, b],
      [],
      vi.fn(),
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      4,
    );

    expect(maxInFlight).toBe(2);
  });

  it("throws SchedulerDepthExceededError once schedulerDepth exceeds MAX_SCHEDULER_DEPTH", async () => {
    const a = rq("a");

    await expect(
      runChain(
        [a],
        [],
        vi.fn(),
        new AbortController().signal,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        DEFAULT_CONCURRENCY,
        MAX_SCHEDULER_DEPTH + 1,
      ),
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

    await runChain(
      [a, b, c],
      edges,
      onUpdate,
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1,
    );

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
    await runChain(
      [a, b, c],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
    );

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
    await runChain(
      [a, b],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
    );

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
          { sourceJsonPath: "$.role", targetField: "header", targetKey: "role" },
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
    await runChain(
      [a, b],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
      undefined,
      undefined,
      conditionNodes,
    );

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
    await runChain(
      [a, b],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mergeNodes,
    );

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
    await runChain(
      [a, b],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mergeNodes,
    );

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
    await runChain(
      [a, b, next],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mergeNodes,
    );

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
    await runChain(
      [a, b, next],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mergeNodes,
      1, // concurrency = 1: deterministic early-fire ordering
    );

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
    await runChain(
      [a, b, next],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mergeNodes,
    );

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
    await runChain(
      [a, b, onSuccess],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
      undefined,
      undefined,
      conditionNodes,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mergeNodes,
    );

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
    await runChain(
      [a, b],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mergeNodes,
      1, // concurrency = 1: `b` never leaves the ready queue before `m` fires
    );

    expect(states.a).toBe("passed");
    expect(states.b).toBe("skipped");
    expect(states.m).toBe("passed");
    // Only `a` was ever dispatched to the executor — `b` was short-circuited.
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(1);
  });

  it("Merge mode 'any' fires early: resolves passed before a slower in-flight sibling branch settles", async () => {
    // `a` resolves on the next microtask; `b` is deliberately slower (an
    // extra microtask hop) and already in-flight (concurrency = 2 dispatches
    // both at once) when `a` passes. The Merge must fire as soon as `a`
    // passes rather than waiting for `b`'s still-pending promise — proven by
    // "m passed" appearing in the update log before "b passed".
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
    await runChain(
      [a, b],
      edges,
      (id, state) => {
        if (state !== "running") {
          states[id] = state;
          order.push(`${id} ${state}`);
        }
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      mergeNodes,
      2, // concurrency = 2: both `a` and `b` are in-flight simultaneously
    );

    expect(states.a).toBe("passed");
    expect(states.b).toBe("passed");
    expect(states.m).toBe("passed");
    expect(vi.mocked(runRequest)).toHaveBeenCalledTimes(2);
    // "m" resolves before the slower "b" branch, proving the early fire.
    expect(order.indexOf("m passed")).toBeLessThan(order.indexOf("b passed"));
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
    await runChain(
      [a, b],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      ac.signal,
    );

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
      { id: "e-u-loop", sourceRequestId: "upstream", targetRequestId: "loop", injections: [] },
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
    await runChain(
      [upstream, bodyReq, downstream],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      DEFAULT_CONCURRENCY,
      0,
      loopNodes,
      collectNodes,
    );

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
    await runChain(
      [upstreamFailing, bodyReq, downstream],
      edges,
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      DEFAULT_CONCURRENCY,
      0,
      loopNodes,
      collectNodes,
    );

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
      { id: "sub-1", type: "subchain", chainId: "referenced-chain", inputBindings: {} },
    ];
    const edges: ChainEdge[] = [
      { id: "e-outer-sub", sourceRequestId: "outer", targetRequestId: "sub-1", injections: [] },
    ];

    const states: Record<string, string> = {};
    const nestedParents: Record<string, string | undefined> = {};
    await runChain(
      [outer],
      edges,
      (id, state, data) => {
        if (state !== "running") {
          states[id] = state;
          nestedParents[id] = data.parentStepId;
        }
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      DEFAULT_CONCURRENCY,
      0,
      undefined,
      undefined,
      subChainBlocks,
      (chainId) =>
        chainId === "referenced-chain"
          ? { requests: [referenced], edges: [] }
          : undefined,
    );

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
      { id: "sub-1", type: "subchain", chainId: "deleted-chain", inputBindings: {} },
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
    await runChain(
      [outer],
      [],
      (id, state) => {
        if (state !== "running") states[id] = state;
      },
      new AbortController().signal,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      DEFAULT_CONCURRENCY,
      0,
      undefined,
      undefined,
      subChainBlocks,
      () => undefined,
    );

    expect(states["sub-1"]).toBe("failed");
  });
});
