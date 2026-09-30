import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChainEdge, ChainRunState, SubChainBlock } from "@/types/chain";
import type { RunOptions } from "../types";
import type { ReferencedChainGraph, SubchainExecutorContext } from "./subchain";

const runChainMock = vi.fn();

vi.mock("../../chainRunner", () => ({
  runChain: (...args: unknown[]) => runChainMock(...args),
}));

// Import after the mock so `subchainExecutor` picks up the mocked `runChain`.
const { subchainExecutor } = await import("./subchain");

const START_OVERRIDES_ARG_INDEX = 12;

function buildChain(overrides: Partial<ReferencedChainGraph> = {}): ReferencedChainGraph {
  return {
    requests: [],
    edges: [],
    ...overrides,
  };
}

function buildBlock(overrides: Partial<SubChainBlock> = {}): SubChainBlock {
  return {
    id: "sub-1",
    type: "subchain",
    chainId: "chain-2",
    inputBindings: {},
    ...overrides,
  };
}

function buildContext(
  overrides: Partial<SubchainExecutorContext> = {},
): SubchainExecutorContext {
  return {
    nodeId: "sub-1",
    subChainBlock: buildBlock(),
    chain: buildChain(),
    incomingEdges: [] as ChainEdge[],
    runState: {} as ChainRunState,
    onUpdate: vi.fn(),
    options: { signal: new AbortController().signal },
    ...overrides,
  };
}

describe("subchainExecutor input bindings", () => {
  beforeEach(() => {
    runChainMock.mockReset();
    runChainMock.mockResolvedValue(undefined);
  });

  it("resolves bindings via the shared namespace with chainInputs > aliasValues > env precedence", async () => {
    const options: RunOptions = {
      signal: new AbortController().signal,
      chainInputs: { fromInput: "input-value", shadowed: "input-wins" },
      aliasValues: {
        nonAdjacentAlias: "alias-value",
        shadowed: "alias-loses-to-input",
      },
      resolveVariables: (text: string) =>
        text.replace(/\{\{envVar\}\}/g, "env-value"),
    };

    const block = buildBlock({
      inputBindings: {
        a: "{{fromInput}}",
        b: "{{envVar}}",
        c: "{{nonAdjacentAlias}}",
        d: "{{shadowed}}",
      },
    });

    const context = buildContext({ subChainBlock: block, options });
    await subchainExecutor(context);

    expect(runChainMock).toHaveBeenCalledTimes(1);
    const startOverrides = runChainMock.mock.calls[0][START_OVERRIDES_ARG_INDEX];
    expect(startOverrides).toEqual({
      a: "input-value",
      b: "env-value",
      c: "alias-value",
      d: "input-wins",
    });
  });
});
