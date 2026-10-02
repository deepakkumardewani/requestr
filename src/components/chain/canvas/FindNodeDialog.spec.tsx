/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIND_NODE_VIRTUALIZE_ABOVE, FindNodeDialog } from "./FindNodeDialog";

const fitView = vi.hoisted(() => vi.fn());
vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  useReactFlow: () => ({ fitView }),
}));

// The virtualizer needs layout; a fixed-size viewport keeps the DOM window real.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(288);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(400);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const apiNode = (id: string, name: string): Node => ({
  id,
  type: "chainNode",
  position: { x: 0, y: 0 },
  data: { name, method: "GET", url: `https://api.test/${id}` },
});

const manyNodes = (count: number) =>
  Array.from({ length: count }, (_, i) => apiNode(`n${i}`, `Request ${i}`));

function setup(nodes: Node[], open = true) {
  const onOpenChange = vi.fn();
  const onSelectNode = vi.fn();
  render(
    <FindNodeDialog
      open={open}
      onOpenChange={onOpenChange}
      nodes={nodes}
      onSelectNode={onSelectNode}
    />,
  );
  return { onOpenChange, onSelectNode };
}

const input = () => screen.getByTestId("find-node-input");

describe("FindNodeDialog", () => {
  it("renders nothing while closed", () => {
    setup([apiNode("a", "Alpha")], false);
    expect(screen.queryByTestId("find-node-input")).toBeNull();
  });

  it("shows the empty state when the chain has no nodes", () => {
    setup([]);
    expect(screen.getByTestId("find-node-empty").textContent).toBe(
      "No nodes yet",
    );
  });

  it("shows a no-results message when the query matches nothing", () => {
    setup([apiNode("a", "Alpha")]);
    fireEvent.change(input(), { target: { value: "zzzzqq" } });
    expect(screen.getByTestId("find-node-empty").textContent).toBe(
      "No matching nodes",
    );
  });

  it("lists nodes with their method and filters as you type", () => {
    setup([apiNode("a", "Alpha"), apiNode("b", "Beta")]);
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getAllByText("GET")).toHaveLength(2);
    fireEvent.change(input(), { target: { value: "beta" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("does not virtualize at the threshold", () => {
    setup(manyNodes(FIND_NODE_VIRTUALIZE_ABOVE));
    expect(screen.getByTestId("find-node-list").dataset.virtualized).toBe(
      "false",
    );
    expect(screen.getAllByRole("option")).toHaveLength(
      FIND_NODE_VIRTUALIZE_ABOVE,
    );
  });

  it.each([60, 500])("virtualizes %i nodes into a small DOM window", (count) => {
    setup(manyNodes(count));
    expect(screen.getByTestId("find-node-list").dataset.virtualized).toBe(
      "true",
    );
    const rendered = screen.getAllByRole("option").length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(count);
  });

  it("Enter selects the active node, fits only that node and closes", () => {
    const { onSelectNode, onOpenChange } = setup([
      apiNode("a", "Alpha"),
      apiNode("b", "Beta"),
    ]);
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: "b" }] }),
    );
    expect(onSelectNode).toHaveBeenCalledWith("b");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("arrow keys wrap and track aria-activedescendant", () => {
    setup([apiNode("a", "Alpha"), apiNode("b", "Beta")]);
    expect(input().getAttribute("aria-activedescendant")).toBe(
      "find-node-option-a",
    );
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(input().getAttribute("aria-activedescendant")).toBe(
      "find-node-option-b",
    );
    fireEvent.keyDown(input(), { key: "Home" });
    expect(input().getAttribute("aria-activedescendant")).toBe(
      "find-node-option-a",
    );
    fireEvent.keyDown(input(), { key: "End" });
    expect(input().getAttribute("aria-activedescendant")).toBe(
      "find-node-option-b",
    );
  });

  it("clicking a row selects that node", () => {
    const { onSelectNode } = setup([apiNode("a", "Alpha"), apiNode("b", "Beta")]);
    fireEvent.click(screen.getByTestId("find-node-row-b"));
    expect(onSelectNode).toHaveBeenCalledWith("b");
  });

  it("Enter with no results does nothing", () => {
    const { onSelectNode } = setup([]);
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onSelectNode).not.toHaveBeenCalled();
    expect(fitView).not.toHaveBeenCalled();
  });

  it("Escape asks to close", () => {
    const { onOpenChange } = setup([apiNode("a", "Alpha")]);
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });
});
