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

  describe("outcome matrix", () => {
    const edge: ChainEdge = {
      id: "edge-1",
      sourceRequestId: "api-1",
      targetRequestId: "validate-1",
      injections: [],
    };

    function runWith({
      body,
      block,
      edges = [edge],
    }: {
      body?: string;
      block: ValidateBlock;
      edges?: ChainEdge[];
    }) {
      const runState: ChainRunState =
        body === undefined
          ? {}
          : {
              "api-1": {
                state: "passed",
                extractedValues: {},
                response: { ...buildResponse(null), body },
              },
            };
      const context = buildContext({ edges, runState, block });
      return { context, runState, run: () => validateExecutor(context) };
    }

    it("passes when the whole body (empty path) matches the schema", async () => {
      const { context, runState, run } = runWith({
        body: JSON.stringify("hello"),
        block: buildBlock(),
      });
      await run();
      expect(runState["validate-1"].state).toBe("passed");
      expect(context.onUpdate).toHaveBeenLastCalledWith(
        "validate-1",
        "passed",
        expect.objectContaining({ response: expect.anything() }),
      );
    });

    it("fails with a path-prefixed message when the schema does not match", async () => {
      const { runState, run } = runWith({
        body: JSON.stringify(42),
        block: buildBlock(),
      });
      await run();
      expect(runState["validate-1"].state).toBe("failed");
      expect(runState["validate-1"].error).toContain(":");
    });

    it("reports at most MAX_REPORTED_ERRORS (3) errors", async () => {
      const keys = ["a", "b", "c", "d", "e"];
      const { runState, run } = runWith({
        body: JSON.stringify({}),
        block: buildBlock({
          schema: JSON.stringify({ type: "object", required: keys }),
        }),
      });
      await run();
      const reported = (runState["validate-1"].error ?? "").split("; ");
      expect(reported).toHaveLength(3);
    });

    it("fails with the VALIDATE_NO_UPSTREAM code when there is no upstream response", async () => {
      const { context, runState, run } = runWith({
        block: buildBlock(),
        edges: [],
      });
      await run();
      expect(runState["validate-1"].state).toBe("failed");
      expect(context.onUpdate).toHaveBeenLastCalledWith(
        "validate-1",
        "failed",
        expect.objectContaining({ errorCode: "validateNoUpstream" }),
      );
    });

    it("fails with validateInvalidJson (does not throw) when the upstream body is not JSON", async () => {
      const { context, runState, run } = runWith({
        body: "<html>not json</html>",
        block: buildBlock(),
      });
      await expect(run()).resolves.toBe(true);
      expect(runState["validate-1"].state).toBe("failed");
      expect(context.onUpdate).toHaveBeenLastCalledWith(
        "validate-1",
        "failed",
        expect.objectContaining({ errorCode: "validateInvalidJson" }),
      );
    });

    it("fails with validateNoMatch when the JSONPath matches nothing", async () => {
      const { context, runState, run } = runWith({
        body: JSON.stringify({ a: 1 }),
        block: buildBlock({ sourceJsonPath: "$.missing" }),
      });
      await run();
      expect(runState["validate-1"].state).toBe("failed");
      expect(context.onUpdate).toHaveBeenLastCalledWith(
        "validate-1",
        "failed",
        expect.objectContaining({
          errorCode: "validateNoMatch",
          errorParams: { path: "$.missing" },
        }),
      );
    });

    it("fails with validateInvalidJsonPath when the JSONPath is malformed", async () => {
      const { context, run } = runWith({
        body: JSON.stringify({ a: 1 }),
        block: buildBlock({ sourceJsonPath: "$..[?(@.x ==" }),
      });
      await run();
      expect(context.onUpdate).toHaveBeenLastCalledWith(
        "validate-1",
        "failed",
        expect.objectContaining({
          errorCode: "validateInvalidJsonPath",
          errorParams: { path: "$..[?(@.x ==" },
        }),
      );
    });

    it("validates a literal null match against the schema instead of reporting noMatch", async () => {
      const { runState, run } = runWith({
        body: JSON.stringify({ a: null }),
        block: buildBlock({
          sourceJsonPath: "$.a",
          schema: JSON.stringify({ type: "null" }),
        }),
      });
      await run();
      expect(runState["validate-1"].state).toBe("passed");
    });

    it("fails with validateInvalidSchemaJson when the schema text is not JSON", async () => {
      const { context, run } = runWith({
        body: JSON.stringify("x"),
        block: buildBlock({ schema: "{not json" }),
      });
      await run();
      expect(context.onUpdate).toHaveBeenLastCalledWith(
        "validate-1",
        "failed",
        expect.objectContaining({ errorCode: "validateInvalidSchemaJson" }),
      );
    });

    it("fails with validateInvalidSchema when the schema does not compile", async () => {
      const { context, run } = runWith({
        body: JSON.stringify("x"),
        block: buildBlock({ schema: JSON.stringify({ type: "bogus" }) }),
      });
      await run();
      expect(context.onUpdate).toHaveBeenLastCalledWith(
        "validate-1",
        "failed",
        expect.objectContaining({ errorCode: "validateInvalidSchema" }),
      );
    });

    it("treats a whitespace-only path as empty and validates the whole body", async () => {
      const { runState, run } = runWith({
        body: JSON.stringify("ok"),
        block: buildBlock({ sourceJsonPath: "   " }),
      });
      await run();
      expect(runState["validate-1"].state).toBe("passed");
    });
  });
});
