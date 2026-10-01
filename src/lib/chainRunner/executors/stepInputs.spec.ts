import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestModel, ResponseData } from "@/types";
import type {
  ChainAssertion,
  ChainEdge,
  ConditionNodeConfig,
} from "@/types/chain";

vi.mock("@/lib/requestRunner", () => ({ runRequest: vi.fn() }));

import { runRequest } from "@/lib/requestRunner";
import { runChain } from "../../chainRunner";
import type { OnUpdateFn } from "../types";
import { loopExecutor } from "./loop";

type UpdateData = Parameters<OnUpdateFn>[2];

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

function response(overrides: Partial<ResponseData> = {}): ResponseData {
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
    ...overrides,
  };
}

/** Runs a chain and returns the terminal update data per node id. */
async function runAndCollect(
  options: Omit<Parameters<typeof runChain>[0], "onUpdate" | "signal">,
): Promise<Record<string, UpdateData>> {
  const terminal: Record<string, UpdateData> = {};
  await runChain({
    ...options,
    signal: new AbortController().signal,
    onUpdate: (nodeId, state, data) => {
      if (state !== "running") terminal[nodeId] = data;
    },
  });
  return terminal;
}

describe("step detail data emitted by executors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("apiExecutor emits the request as sent (variables resolved) on success", async () => {
    vi.mocked(runRequest).mockResolvedValue(response());
    const a = rq("a", {
      url: "{{baseUrl}}/users",
      headers: [{ id: "h1", key: "X-Env", value: "{{baseUrl}}", enabled: true }],
    });

    const terminal = await runAndCollect({
      requests: [a],
      edges: [],
      resolveVariables: (text) =>
        text.replaceAll("{{baseUrl}}", "https://api.test"),
    });

    expect(terminal.a.request?.url).toBe("https://api.test/users");
    expect(terminal.a.request?.headers["X-Env"]).toBe("https://api.test");
  });

  it("apiExecutor still emits the attempted request when the network call throws", async () => {
    vi.mocked(runRequest).mockRejectedValue(new Error("boom"));

    const terminal = await runAndCollect({
      requests: [rq("a", { url: "{{baseUrl}}/x" })],
      edges: [],
      resolveVariables: (text) => text.replace("{{baseUrl}}", "https://h.test"),
    });

    expect(terminal.a.errorKind).toBe("network");
    expect(terminal.a.request?.url).toBe("https://h.test/x");
  });

  it("apiExecutor snapshots assertion definitions and the assertion error kind", async () => {
    vi.mocked(runRequest).mockResolvedValue(response({ status: 500 }));
    const assertion: ChainAssertion = {
      id: "as-1",
      source: "status",
      operator: "eq",
      expectedValue: "200",
      enabled: true,
    };

    const terminal = await runAndCollect({
      requests: [rq("a")],
      edges: [],
      nodeAssertions: { a: [assertion] },
    });

    expect(terminal.a.assertions).toEqual([assertion]);
    expect(terminal.a.assertionResults?.[0]).toMatchObject({
      assertionId: "as-1",
      passed: false,
    });
  });

  it("delayExecutor records the configured delay", async () => {
    const terminal = await runAndCollect({
      requests: [],
      edges: [],
      delayNodes: [{ id: "d", type: "delay", delayMs: 5 }],
    });

    expect(terminal.d.inputs).toEqual({ delayMs: 5 });
  });

  it("conditionExecutor records the tested variable and its resolved value", async () => {
    vi.mocked(runRequest).mockResolvedValue(
      response({ body: JSON.stringify({ role: "admin" }) }),
    );
    const edges: ChainEdge[] = [
      {
        id: "e_ac",
        sourceRequestId: "a",
        targetRequestId: "c",
        injections: [
          { sourceJsonPath: "$.role", targetField: "header", targetKey: "role" },
        ],
      },
    ];
    const conditionNodes: ConditionNodeConfig[] = [
      {
        id: "c",
        type: "condition",
        variable: "{{e_ac:role}}",
        branches: [{ id: "br1", label: "admin", expression: "== 'admin'" }],
      },
    ];

    const terminal = await runAndCollect({
      requests: [rq("a")],
      edges,
      conditionNodes,
    });

    expect(terminal.c.inputs).toEqual({
      condition: { variable: "{{e_ac:role}}", value: "admin" },
    });
  });

  it("loopExecutor records its source path, alias and item count", async () => {
    vi.mocked(runRequest).mockResolvedValue(response());
    const onUpdate = vi.fn();

    await loopExecutor({
      runChain,
      nodeId: "loop-1",
      loopBlock: {
        id: "loop-1",
        type: "loop",
        sourceJsonPath: "$.items",
        itemAlias: "item",
        maxIterations: 100,
      },
      collectBlock: { id: "collect-1", type: "collect", loopId: "loop-1" },
      body: { requests: [rq("body-1")], edges: [] },
      incomingEdges: [
        {
          id: "e-up",
          sourceRequestId: "up",
          targetRequestId: "loop-1",
          injections: [],
        },
      ],
      runState: {
        up: {
          state: "passed",
          extractedValues: {},
          response: response({ body: JSON.stringify({ items: ["a", "b"] }) }),
        },
      },
      onUpdate,
      options: { signal: new AbortController().signal, chainInputs: {} },
    });

    expect(onUpdate).toHaveBeenCalledWith(
      "loop-1",
      "passed",
      expect.objectContaining({
        inputs: {
          loop: { sourceJsonPath: "$.items", itemAlias: "item", itemCount: 2 },
        },
      }),
    );
  });

  it("loopExecutor records source path and alias (no item count) when the source does not resolve", async () => {
    const onUpdate = vi.fn();

    await loopExecutor({
      runChain,
      nodeId: "loop-1",
      loopBlock: {
        id: "loop-1",
        type: "loop",
        sourceJsonPath: "$.missing",
        itemAlias: "item",
        maxIterations: 10,
      },
      collectBlock: { id: "collect-1", type: "collect", loopId: "loop-1" },
      body: { requests: [], edges: [] },
      incomingEdges: [
        {
          id: "e-up",
          sourceRequestId: "up",
          targetRequestId: "loop-1",
          injections: [],
        },
      ],
      runState: {
        up: {
          state: "passed",
          extractedValues: {},
          response: response({ body: "{}" }),
        },
      },
      onUpdate,
      options: { signal: new AbortController().signal, chainInputs: {} },
    });

    expect(onUpdate).toHaveBeenCalledWith(
      "loop-1",
      "failed",
      expect.objectContaining({
        inputs: { loop: { sourceJsonPath: "$.missing", itemAlias: "item" } },
      }),
    );
  });

  it("loopExecutor records inputs when there is no upstream response", async () => {
    const onUpdate = vi.fn();

    await loopExecutor({
      runChain,
      nodeId: "loop-1",
      loopBlock: {
        id: "loop-1",
        type: "loop",
        sourceJsonPath: "$.items",
        itemAlias: "row",
        maxIterations: 10,
      },
      collectBlock: { id: "collect-1", type: "collect", loopId: "loop-1" },
      body: { requests: [], edges: [] },
      incomingEdges: [],
      runState: {},
      onUpdate,
      options: { signal: new AbortController().signal, chainInputs: {} },
    });

    expect(onUpdate).toHaveBeenCalledWith(
      "loop-1",
      "failed",
      expect.objectContaining({
        inputs: { loop: { sourceJsonPath: "$.items", itemAlias: "row" } },
      }),
    );
  });
});
