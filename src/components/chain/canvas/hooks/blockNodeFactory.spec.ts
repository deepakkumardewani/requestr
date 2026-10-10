import type { Node } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";
import type { ChainNodeType, ChainRunState } from "@/types/chain";
import type { ChainErrorParams } from "@/lib/chainRunner/errorCodes";
import { BLOCK_REGISTRY } from "../../blockRegistry";
import { createBlockNodeBuilder } from "./blockNodeFactory";

type Data = Record<string, unknown>;

/** Mirrors `useNodeCache`: reuses the node while every dep is `Object.is`-equal. */
function makeCache() {
  const cache = new Map<string, { deps: unknown[]; node: Node }>();
  return (id: string, deps: unknown[], build: () => Node): Node => {
    const hit = cache.get(id);
    if (
      hit &&
      hit.deps.length === deps.length &&
      hit.deps.every((d, i) => Object.is(d, deps[i]))
    ) {
      return hit.node;
    }
    const node = build();
    cache.set(id, { deps, node });
    return node;
  };
}

function setup(
  overrides: Partial<Parameters<typeof createBlockNodeBuilder>[0]> = {},
) {
  const chainErrorMessage = vi.fn(
    (
      _code: string | undefined,
      _params: ChainErrorParams | undefined,
      fallback?: string,
    ) => fallback ?? "",
  );
  const input = {
    runState: {} as ChainRunState,
    nodePositions: {},
    keyboardFocusNodeId: null,
    chainErrorMessage,
    nodeCache: makeCache(),
    ...overrides,
  };
  return { build: createBlockNodeBuilder(input), chainErrorMessage };
}

const spec = (
  type: ChainNodeType,
  index = 0,
  block: { id: string } = { id: "b1" },
  deps: unknown[] = [],
) => ({ block, type, index, deps, data: (common: Data) => ({ ...common }) });

describe("createBlockNodeBuilder", () => {
  it.each(Object.keys(BLOCK_REGISTRY) as ChainNodeType[])(
    "maps a %s block to its registry flow node type",
    (type) => {
      const { build } = setup();

      const node = build(spec(type));

      expect(node.type).toBe(BLOCK_REGISTRY[type].flowNodeType);
      expect(node.deletable).toBe(false);
    },
  );

  it("uses the saved position when the block has one", () => {
    const { build } = setup({ nodePositions: { b1: { x: 5, y: 7 } } });

    expect(build(spec("api", 3)).position).toEqual({ x: 5, y: 7 });
  });

  it("falls back to a per-type row spaced by index when no position is saved", () => {
    const { build } = setup();

    expect(build(spec("api", 2)).position).toEqual({ x: 600, y: 120 });
    expect(build(spec("delay", 1, { id: "d" })).position).toEqual({
      x: 240,
      y: 260,
    });
  });

  it("places the Start block above the first API row", () => {
    const { build } = setup();

    const start = build(spec("start", 0, { id: "s" }));
    const api = build(spec("api", 0, { id: "a" }));

    expect(start.position.y).toBeLessThan(api.position.y);
  });

  it("defaults to idle with no error for a block that has not run", () => {
    const { build } = setup();

    expect(build(spec("api")).data).toEqual({
      state: "idle",
      error: undefined,
      isKeyboardFocused: false,
    });
  });

  it("exposes the run state and translated error through common data", () => {
    const { build, chainErrorMessage } = setup({
      runState: {
        b1: {
          state: "failed",
          extractedValues: {},
          error: "boom",
          errorCode: "REQUEST_FAILED" as never,
          errorParams: { a: 1 } as never,
        },
      },
    });

    const node = build(spec("api"));

    expect(chainErrorMessage).toHaveBeenCalledWith(
      "REQUEST_FAILED",
      { a: 1 },
      "boom",
    );
    expect(node.data).toMatchObject({ state: "failed", error: "boom" });
  });

  it("reports undefined error when the translator returns an empty string", () => {
    const { build } = setup({
      runState: { b1: { state: "passed", extractedValues: {} } },
    });

    expect(build(spec("api")).data.error).toBeUndefined();
  });

  it("marks only the keyboard-focused block as selected and focused", () => {
    const { build } = setup({ keyboardFocusNodeId: "b1" });

    const focused = build(spec("api"));
    const other = build(spec("api", 0, { id: "b2" }));

    expect(focused.selected).toBe(true);
    expect(focused.data.isKeyboardFocused).toBe(true);
    expect(other.selected).toBe(false);
    expect(other.data.isKeyboardFocused).toBe(false);
  });

  it("reuses the same node object while block, run state and deps are unchanged", () => {
    const { build } = setup();
    const block = { id: "b1" };
    const dep = () => {};

    const first = build(spec("api", 0, block, [dep]));
    const second = build(spec("api", 0, block, [dep]));

    expect(second).toBe(first);
  });

  it("rebuilds the node when an extra dep changes", () => {
    const { build } = setup();
    const block = { id: "b1" };

    const first = build(spec("api", 0, block, [() => {}]));
    const second = build(spec("api", 0, block, [() => {}]));

    expect(second).not.toBe(first);
  });
});
