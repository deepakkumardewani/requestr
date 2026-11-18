/** @vitest-environment happy-dom */

import { Position, ReactFlowProvider } from "@xyflow/react";
import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Braces, Trash2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectNode } from "./CollectNode";
import { ConditionNode } from "./ConditionNode";
import { DelayNode } from "./DelayNode";
import { EvaluateNode } from "./EvaluateNode";
import { LoopNode } from "./LoopNode";
import { MergeNode } from "./MergeNode";
import { NodeShell } from "./NodeShell";
import { StartNode } from "./StartNode";
import { SubChainNode } from "./SubChainNode";
import { ValidateNode } from "./ValidateNode";
import type { ToolbarAction } from "./NodeToolbar";

const TOOLBAR_SELECTOR = ".rounded-full.border";
// onDeleteNode yields one toolbar action; without any callback a block has no toolbar.
const BASE = { nodeId: "n1", state: "idle", onDeleteNode: vi.fn() } as const;

// The 9 block types built on NodeShell.
const SHELL_BLOCKS: [string, () => React.ReactElement][] = [
  ["Start", () => <StartNode data={{ ...BASE, inputs: [] }} />],
  ["Delay", () => <DelayNode data={{ ...BASE, delayMs: 100 }} />],
  [
    "Condition",
    () => (
      <ConditionNode
        data={{
          ...BASE,
          variable: "x",
          branches: [{ id: "b1", label: "a", expression: "=== 1" }],
        }}
      />
    ),
  ],
  ["Evaluate", () => <EvaluateNode data={{ ...BASE, outputAlias: "a" }} />],
  ["Validate", () => <ValidateNode data={{ ...BASE, sourceJsonPath: "$" }} />],
  ["Merge", () => <MergeNode data={{ ...BASE, mode: "all" }} />],
  [
    "Loop",
    () => <LoopNode data={{ ...BASE, itemAlias: "i", maxIterations: 10 }} />,
  ],
  ["Collect", () => <CollectNode data={{ ...BASE, loopId: "l1" }} />],
  ["SubChain", () => <SubChainNode data={{ ...BASE, chainId: "c1" }} />],
];

type ShellProps = Parameters<typeof NodeShell>[0];

function renderShell(props: Partial<ShellProps> = {}) {
  return render(
    <ReactFlowProvider>
      <NodeShell
        testId="shell-1"
        state="idle"
        toolbar={[]}
        icon={Braces}
        title="Title"
        subtitle="Subtitle"
        {...props}
      />
    </ReactFlowProvider>,
  );
}

describe("NodeShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders icon, title and subtitle in the summary layout", () => {
    const { getByTestId } = renderShell();
    const card = getByTestId("shell-1");
    expect(card).toHaveTextContent("Title");
    expect(card).toHaveTextContent("Subtitle");
    expect(card).toHaveClass("flex", "border-border", "bg-card");
  });

  it("wires toolbar actions to their handlers", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const toolbar: ToolbarAction[] = [
      { id: "remove", icon: Trash2, label: "Remove", onClick: onDelete },
    ];
    const { getByLabelText } = renderShell({ toolbar });

    await user.click(getByLabelText("Remove"));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("renders one target and one source handle by default", () => {
    const { container } = renderShell();
    expect(container.querySelectorAll(".react-flow__handle.target")).toHaveLength(1);
    expect(container.querySelectorAll(".react-flow__handle.source")).toHaveLength(1);
  });

  it("supports custom source handles and no target handle", () => {
    const { container } = renderShell({
      hasTargetHandle: false,
      sourceHandles: [
        { id: "body", position: Position.Bottom },
        { id: "done", position: Position.Right },
      ],
    });
    expect(container.querySelectorAll(".react-flow__handle.target")).toHaveLength(0);
    expect(container.querySelectorAll(".react-flow__handle.source")).toHaveLength(2);
  });

  it("shows the error strip only when failed with a message", () => {
    const { queryByText, rerender } = renderShell({ state: "failed", error: "boom" });
    expect(queryByText("boom")).toBeInTheDocument();

    rerender(
      <ReactFlowProvider>
        <NodeShell testId="shell-1" state="passed" error="boom" toolbar={[]} />
      </ReactFlowProvider>,
    );
    expect(queryByText("boom")).not.toBeInTheDocument();
  });

  it("disables the running pulse under reduced motion", () => {
    const { getByTestId } = renderShell({ state: "running" });
    expect(getByTestId("shell-1").className).toContain("motion-reduce:animate-none");
  });

  it("applies the destructive tint for invalid nodes", () => {
    const { getByTestId } = renderShell({ invalid: true });
    expect(getByTestId("shell-1")).toHaveClass("border-destructive");
  });

  it("renders bespoke children instead of the summary", () => {
    const { getByTestId, queryByText } = renderShell({
      children: <span>custom body</span>,
    });
    expect(getByTestId("shell-1")).toHaveTextContent("custom body");
    expect(queryByText("Title")).not.toBeInTheDocument();
  });

  it("wraps the card in a NodeHoverFrame bridge when it has actions", () => {
    const toolbar: ToolbarAction[] = [
      { id: "remove", icon: Trash2, label: "Remove", onClick: vi.fn() },
    ];
    const { container, getByTestId } = renderShell({ toolbar });
    const frame = container.firstElementChild as HTMLElement;

    expect(frame).toHaveClass("group/node", "-mt-9", "pt-9");
    expect(frame.querySelector(TOOLBAR_SELECTOR)).toHaveClass("top-0");
    expect(frame).toContainElement(getByTestId("shell-1"));
  });

  it("renders no toolbar and no bridge zone without actions", () => {
    const { container } = renderShell({ toolbar: [] });
    const frame = container.firstElementChild as HTMLElement;

    expect(frame.querySelector(TOOLBAR_SELECTOR)).toBeNull();
    expect(frame).not.toHaveClass("pt-9");
  });

  it.each(SHELL_BLOCKS)(
    "%s block keeps its toolbar inside the hover frame",
    (_name, renderBlock) => {
      const { container } = render(
        <ReactFlowProvider>{renderBlock()}</ReactFlowProvider>,
      );
      const frame = container.firstElementChild as HTMLElement;
      const toolbar = frame.querySelector(TOOLBAR_SELECTOR);

      expect(frame).toHaveClass("group/node", "-mt-9", "pt-9");
      expect(toolbar).not.toBeNull();
      expect(toolbar).toHaveClass(
        "top-0",
        "group-hover/node:flex",
        "group-focus-within/node:flex",
      );
    },
  );
});
