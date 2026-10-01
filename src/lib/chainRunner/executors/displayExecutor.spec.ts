import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerEdgeAlias } from "@/lib/chainValueNamespace";
import type { ChainEdge, ChainRunState, DisplayBlock } from "@/types/chain";
import { displayExecutor } from "./displayExecutor";

const display: DisplayBlock = {
  id: "d1",
  type: "display",
  sourceJsonPath: "$.id",
  targetField: "header",
  targetKey: "id",
};

const onUpdate = vi.fn();

function run(aliasValues: Record<string, string>) {
  const edge: ChainEdge = {
    id: "e1",
    sourceRequestId: "api",
    targetRequestId: "d1",
    injections: [],
  };
  const runState: ChainRunState = {
    api: {
      state: "passed",
      extractedValues: {},
      response: { body: JSON.stringify({ id: "42" }) },
    },
  } as unknown as ChainRunState;
  return displayExecutor({
    nodeId: "d1",
    incomingEdges: [edge],
    runState,
    displayNodeMap: new Map([["d1", display]]),
    onUpdate,
    options: { signal: new AbortController().signal, aliasValues },
  } as unknown as Parameters<typeof displayExecutor>[0]);
}

describe("displayExecutor alias collisions", () => {
  beforeEach(() => onUpdate.mockClear());

  it("records a structured warning on the step when a targetKey overwrites an edge's alias", async () => {
    const aliasValues: Record<string, string> = {};
    registerEdgeAlias(aliasValues, "e9", "id", "old");

    await run(aliasValues);

    expect(aliasValues.id).toBe("42");
    expect(onUpdate).toHaveBeenLastCalledWith(
      "d1",
      "passed",
      expect.objectContaining({
        warnings: [
          {
            kind: "alias-collision",
            alias: "id",
            previousOwner: { kind: "edge", id: "e9" },
            owner: { kind: "display", id: "d1" },
          },
        ],
      }),
    );
  });

  it("attaches no warnings when the alias is unclaimed", async () => {
    await run({});
    expect(onUpdate.mock.lastCall?.[2].warnings).toBeUndefined();
  });
});

describe("displayExecutor failure branches", () => {
  function runWith(options: {
    node?: Partial<DisplayBlock>;
    runState?: ChainRunState;
    edges?: ChainEdge[];
    known?: boolean;
  }) {
    const edge: ChainEdge = {
      id: "e1",
      sourceRequestId: "api",
      targetRequestId: "d1",
      injections: [],
    };
    const state: ChainRunState = {};
    const update = vi.fn();
    const promise = displayExecutor({
      nodeId: "d1",
      incomingEdges: options.edges ?? [edge],
      runState: options.runState ?? state,
      displayNodeMap: new Map(
        options.known === false ? [] : [["d1", { ...display, ...options.node }]],
      ),
      onUpdate: update,
      options: { signal: new AbortController().signal, aliasValues: {} },
    } as unknown as Parameters<typeof displayExecutor>[0]);
    return { promise, update, state: options.runState ?? state };
  }

  const responded = {
    api: {
      state: "passed",
      extractedValues: {},
      response: { body: JSON.stringify({ id: "42" }) },
    },
  } as unknown as ChainRunState;

  it("returns false when the node is not a display node", async () => {
    const { promise, update } = runWith({ known: false });
    expect(await promise).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("fails with DISPLAY_NO_SOURCE when there is no upstream response", async () => {
    const { promise, update, state } = runWith({ edges: [] });
    expect(await promise).toBe(true);
    expect(state.d1.state).toBe("failed");
    expect(update).toHaveBeenLastCalledWith(
      "d1",
      "failed",
      expect.objectContaining({ errorCode: "displayNoSource" }),
    );
  });

  it("fails with DISPLAY_NO_PATH when the block has no JSON path", async () => {
    const { promise, update } = runWith({
      node: { sourceJsonPath: "" },
      runState: { ...responded },
    });
    await promise;
    expect(update).toHaveBeenLastCalledWith(
      "d1",
      "failed",
      expect.objectContaining({ errorCode: "displayNoPath" }),
    );
  });

  it("fails with DISPLAY_EXTRACT_FAILED when the path matches nothing", async () => {
    const { promise, update, state } = runWith({
      node: { sourceJsonPath: "$.missing" },
      runState: { ...responded },
    });
    await promise;
    expect(state.d1.state).toBe("failed");
    expect(update).toHaveBeenLastCalledWith(
      "d1",
      "failed",
      expect.objectContaining({
        errorCode: "displayExtractFailed",
        extractedValues: { d1: null },
      }),
    );
  });
});
