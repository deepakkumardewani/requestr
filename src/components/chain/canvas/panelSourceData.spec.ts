import { describe, expect, it } from "vitest";
import type { ChainRunState, DisplayBlock } from "@/types/chain";
import { resolveArrowPanelData, resolveLoopSourceBody } from "./panelSourceData";

const requests = [
  { id: "a", name: "A" },
  { id: "b", name: "B" },
] as never;
const chainEdges = [
  { id: "e1", sourceRequestId: "a", targetRequestId: "b", injections: [] },
  { id: "e2", sourceRequestId: "a", targetRequestId: "disp", injections: [] },
  { id: "e3", sourceRequestId: "a", targetRequestId: "loop", injections: [] },
] as never;
const runState = {
  a: { state: "passed", response: { body: "payload" } },
} as unknown as ChainRunState;
const lookup = { chainEdges, requests, runState };
const display = { id: "disp", type: "display" } as DisplayBlock;

describe("resolveArrowPanelData", () => {
  it("resolves an edge's endpoints and the source's run data", () => {
    const data = resolveArrowPanelData(
      { open: true, edgeId: "e1", displayNodeId: null },
      [],
      lookup,
    );
    expect(data.existingEdge?.id).toBe("e1");
    expect(data.sourceRequest?.id).toBe("a");
    expect(data.targetRequest?.id).toBe("b");
    expect(data.sourceRunState).toBe("passed");
    expect(data.sourceResponse?.body).toBe("payload");
    expect(data.existingDisplayNode).toBeUndefined();
  });

  it("resolves a Display node's upstream request with no target", () => {
    const data = resolveArrowPanelData(
      { open: true, edgeId: null, displayNodeId: "disp" },
      [display],
      lookup,
    );
    expect(data.existingEdge).toBeNull();
    expect(data.existingDisplayNode).toBe(display);
    expect(data.sourceRequest?.id).toBe("a");
    expect(data.targetRequest).toBeNull();
  });

  it("is empty when nothing is open or the source is missing", () => {
    const closed = resolveArrowPanelData(
      { open: false, edgeId: null, displayNodeId: null },
      [display],
      lookup,
    );
    expect(closed.sourceRequest).toBeNull();
    expect(closed.sourceRunState).toBeUndefined();
    const orphan = resolveArrowPanelData(
      { open: true, edgeId: null, displayNodeId: "disp" },
      [display],
      { ...lookup, chainEdges: [] },
    );
    expect(orphan.sourceRequest).toBeNull();
  });
});

describe("resolveLoopSourceBody", () => {
  it("returns the upstream response body", () => {
    expect(resolveLoopSourceBody("loop", lookup)).toBe("payload");
  });

  it("returns undefined without a loop, upstream edge or run data", () => {
    expect(resolveLoopSourceBody(null, lookup)).toBeUndefined();
    expect(resolveLoopSourceBody("nope", lookup)).toBeUndefined();
    expect(
      resolveLoopSourceBody("loop", { ...lookup, runState: {} }),
    ).toBeUndefined();
  });
});
