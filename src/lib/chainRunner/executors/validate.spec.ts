import { describe, expect, it, vi } from "vitest";
import type { ResponseData } from "@/types";
import type { ChainEdge, ChainRunState, ValidateBlock } from "@/types/chain";
import type { RunOptions } from "../types";
import { validateExecutor } from "./validate";

function buildResponse(body: unknown): ResponseData {
  return {
    status: 200,
    statusText: "OK",
    headers: {},
    body: JSON.stringify(body),
    duration: 0,
    size: 0,
    url: "https://api.example.com",
    method: "GET",
    timestamp: Date.now(),
  };
}

function buildBlock(overrides: Partial<ValidateBlock> = {}): ValidateBlock {
  return {
    id: "validate-1",
    type: "validate",
    sourceJsonPath: "",
    schema: JSON.stringify({ type: "string" }),
    ...overrides,
  };
}

function buildContext({
  edges,
  runState,
  block,
  options = { signal: new AbortController().signal },
}: {
  edges: ChainEdge[];
  runState: ChainRunState;
  block: ValidateBlock;
  options?: RunOptions;
}) {
  return {
    nodeId: "validate-1",
    incomingEdges: edges,
    runState,
    requestMap: new Map(),
    displayNodeMap: new Map(),
    delayNodeMap: new Map(),
    conditionNodeMap: new Map(),
    validateNodeMap: new Map([["validate-1", block]]),
    onUpdate: vi.fn(),
    options,
  };
}

describe("validateExecutor", () => {
  it("resolves a {{alias}} in sourceJsonPath via aliasValues before JSONPath evaluation", async () => {
    const runState: ChainRunState = {
      "api-1": {
        state: "passed",
        extractedValues: {},
        response: buildResponse({ user: { id: "abc123" } }),
      },
    };
    const edges: ChainEdge[] = [
      {
        id: "edge-1",
        sourceRequestId: "api-1",
        targetRequestId: "validate-1",
        injections: [],
      },
    ];
    const block = buildBlock({
      sourceJsonPath: "$.{{field}}.id",
      schema: JSON.stringify({ type: "string" }),
    });
    const options: RunOptions = {
      signal: new AbortController().signal,
      aliasValues: { field: "user" },
    };

    const context = buildContext({ edges, runState, block, options });
    const result = await validateExecutor(context);

    expect(result).toBe(true);
    expect(runState["validate-1"].state).toBe("passed");
  });
});
