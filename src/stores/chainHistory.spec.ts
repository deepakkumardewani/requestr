import { describe, expect, it } from "vitest";
import { createHistory, emptyChainHistory } from "./chainHistory";

describe("chainHistory", () => {
  it("emptyChainHistory returns empty past/future", () => {
    expect(emptyChainHistory<number>()).toEqual({ past: [], future: [] });
  });

  it("push appends to past and clears future", () => {
    const history = createHistory<number>(100);
    const h1 = history.push(emptyChainHistory(), 1);
    expect(h1).toEqual({ past: [1], future: [] });
    const h2 = history.push({ past: [1], future: [9] }, 2);
    expect(h2).toEqual({ past: [1, 2], future: [] });
  });

  it("push bounds past to the given limit", () => {
    const history = createHistory<number>(2);
    let h = emptyChainHistory<number>();
    h = history.push(h, 1);
    h = history.push(h, 2);
    h = history.push(h, 3);
    expect(h.past).toEqual([2, 3]);
  });

  it("undo returns null when past is empty", () => {
    const history = createHistory<number>(100);
    expect(history.undo(emptyChainHistory(), 5)).toBeNull();
  });

  it("undo moves the last past entry out and stashes current in future", () => {
    const history = createHistory<number>(100);
    const result = history.undo({ past: [1, 2], future: [] }, 3);
    expect(result).toEqual({
      snapshot: 2,
      history: { past: [1], future: [3] },
    });
  });

  it("redo returns null when future is empty", () => {
    const history = createHistory<number>(100);
    expect(history.redo(emptyChainHistory(), 5)).toBeNull();
  });

  it("redo moves the first future entry out and stashes current in past", () => {
    const history = createHistory<number>(100);
    const result = history.redo({ past: [1], future: [3, 4] }, 2);
    expect(result).toEqual({
      snapshot: 3,
      history: { past: [1, 2], future: [4] },
    });
  });

  it("undo then redo round-trips to the original sequence", () => {
    const history = createHistory<number>(100);
    let h = emptyChainHistory<number>();
    h = history.push(h, 1);
    h = history.push(h, 2);
    let current = 3;

    const undone = history.undo(h, current);
    expect(undone).not.toBeNull();
    if (!undone) throw new Error("unreachable");
    h = undone.history;
    current = undone.snapshot;
    expect(current).toBe(2);

    const redone = history.redo(h, current);
    expect(redone).not.toBeNull();
    if (!redone) throw new Error("unreachable");
    h = redone.history;
    current = redone.snapshot;
    expect(current).toBe(3);
    expect(h).toEqual({ past: [1, 2], future: [] });
  });
});
