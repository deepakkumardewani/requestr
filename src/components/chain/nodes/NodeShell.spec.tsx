/** @vitest-environment happy-dom */

import { Position, ReactFlowProvider } from "@xyflow/react";
import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Braces, Trash2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeShell } from "./NodeShell";
import type { ToolbarAction } from "./NodeToolbar";

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
});
