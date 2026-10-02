/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultBlock, useAddBlock } from "./useAddBlock";

const store = vi.hoisted(() => ({ addBlockWithEdge: vi.fn() }));
const flow = vi.hoisted(() => ({
  state: { width: 800, height: 600, transform: [100, 50, 2] },
}));

vi.mock("@/stores/useChainStore", () => ({
  useChainStore: { getState: () => store },
}));
vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  useStoreApi: () => ({ getState: () => flow.state }),
}));

const openers = {
  condition: vi.fn(),
  start: vi.fn(),
  evaluate: vi.fn(),
  validate: vi.fn(),
  merge: vi.fn(),
  loop: vi.fn(),
  collect: vi.fn(),
  subchain: vi.fn(),
};
const onOpenApiPicker = vi.fn();
const onEnterGhostMode = vi.fn();
const onOpenSubChainPicker = vi.fn();

function setup(hasStartBlock = false) {
  return renderHook(() =>
    useAddBlock({
      chainId: "c1",
      hasStartBlock,
      onOpenApiPicker,
      onEnterGhostMode,
      panelOpeners: openers,
      onOpenSubChainPicker,
    }),
  ).result.current;
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
    cb();
    return 0;
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("useAddBlock", () => {
  it("opens the picker with the position and pending connection for requests", () => {
    const connectFrom = { nodeId: "n1", handleId: "success" };
    setup()("api", { position: { x: 1, y: 2 }, connectFrom });
    expect(onOpenApiPicker).toHaveBeenCalledWith({
      position: { x: 1, y: 2 },
      pendingConnection: connectFrom,
    });
    expect(store.addBlockWithEdge).not.toHaveBeenCalled();
  });

  it("enters ghost mode for ghost types without a position", () => {
    setup()("delay");
    expect(onEnterGhostMode).toHaveBeenCalledWith("delay");
    expect(store.addBlockWithEdge).not.toHaveBeenCalled();
  });

  it("skips ghost mode and places directly when a position is given", () => {
    setup()("delay", { position: { x: 10, y: 20 } });
    expect(onEnterGhostMode).not.toHaveBeenCalled();
    expect(store.addBlockWithEdge).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ type: "delay" }),
      { position: { x: 10, y: 20 }, connectFrom: undefined },
    );
  });

  it("forwards connectFrom and opens the matching config panel", () => {
    const connectFrom = { nodeId: "loop-1", handleId: "body" };
    setup()("evaluate", { position: { x: 0, y: 0 }, connectFrom });
    const [, block, options] = store.addBlockWithEdge.mock.calls[0];
    expect(options.connectFrom).toBe(connectFrom);
    expect(openers.evaluate).toHaveBeenCalledWith(block.id);
  });

  it("opens the sub-chain picker for subchain and no panel for delay/display", () => {
    const add = setup();
    add("subchain", { position: { x: 0, y: 0 } });
    expect(onOpenSubChainPicker).toHaveBeenCalledTimes(1);
    add("delay", { position: { x: 0, y: 0 } });
    add("display", { position: { x: 0, y: 0 } });
    expect(onOpenSubChainPicker).toHaveBeenCalledTimes(1);
    for (const opener of Object.values(openers)) {
      expect(opener).not.toHaveBeenCalled();
    }
  });

  it("inserts Start at the viewport center directly", () => {
    setup()("start");
    expect(store.addBlockWithEdge).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ type: "start" }),
      // (800/2 - 100) / 2 and (600/2 - 50) / 2
      { position: { x: 150, y: 125 } },
    );
    expect(onEnterGhostMode).not.toHaveBeenCalled();
  });

  it("places Start at an explicit position when given", () => {
    setup()("start", { position: { x: 7, y: 8 } });
    expect(store.addBlockWithEdge).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ type: "start" }),
      { position: { x: 7, y: 8 } },
    );
  });

  it("does not mutate when Start already exists or a connection is supplied", () => {
    setup(true)("start");
    setup(false)("start", { connectFrom: { nodeId: "n1" } });
    expect(store.addBlockWithEdge).not.toHaveBeenCalled();
  });

  it("moves focus to the new node card after adding", () => {
    const el = document.createElement("div");
    el.className = "react-flow__node";
    el.tabIndex = 0;
    document.body.appendChild(el);
    const focus = vi.spyOn(el, "focus");
    vi.spyOn(document, "querySelector").mockReturnValue(el);
    setup()("delay", { position: { x: 0, y: 0 } });
    expect(focus).toHaveBeenCalled();
    vi.restoreAllMocks();
    el.remove();
  });
});

describe("createDefaultBlock", () => {
  it.each([
    "delay",
    "display",
    "evaluate",
    "validate",
    "merge",
    "loop",
    "collect",
    "subchain",
    "condition",
  ] as const)("builds a %s block with the given id", (type) => {
    const block = createDefaultBlock(type, "x1");
    expect(block).toMatchObject({ id: "x1", type });
  });

  it("gives conditions a branch plus an else branch", () => {
    const block = createDefaultBlock("condition");
    expect(block.type === "condition" && block.branches).toHaveLength(2);
  });
});
