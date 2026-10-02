/** @vitest-environment happy-dom */

import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Play, Trash2 } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeToolbar, type ToolbarAction } from "./NodeToolbar";

function makeActions(onRun = vi.fn(), onDelete = vi.fn()): ToolbarAction[] {
  return [
    { id: "run", icon: Play, label: "Run independently", onClick: onRun },
    {
      id: "remove",
      icon: Trash2,
      label: "Remove from chain",
      destructive: true,
      onClick: onDelete,
    },
  ];
}

function renderToolbar(props: Partial<Parameters<typeof NodeToolbar>[0]> = {}) {
  return render(
    <div className="group/node relative">
      <NodeToolbar actions={makeActions()} {...props} />
    </div>,
  );
}

describe("NodeToolbar", () => {
  afterEach(() => {
    cleanup();
  });

  it("invokes an action's handler when its button is pressed", async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    const { getByLabelText } = renderToolbar({ actions: makeActions(onRun) });

    await user.click(getByLabelText("Run independently"));

    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("does not bubble the click to the node", async () => {
    const user = userEvent.setup();
    const onNodeClick = vi.fn();
    const { getByLabelText } = render(
      <div className="group/node" onClick={onNodeClick} role="presentation">
        <NodeToolbar actions={makeActions()} />
      </div>,
    );

    await user.click(getByLabelText("Remove from chain"));

    expect(onNodeClick).not.toHaveBeenCalled();
  });

  it("renders nothing when there are no actions", () => {
    const { container } = renderToolbar({ actions: [] });
    expect(container.querySelector(".rounded-full.border")).toBeNull();
  });

  it("is hidden by default (visible only via hover CSS)", () => {
    const { container } = renderToolbar();
    expect(container.querySelector(".rounded-full.border")).toHaveClass(
      "hidden",
    );
  });

  it("is shown (not hidden) when the node is keyboard-selected", () => {
    const { container } = renderToolbar({ isKeyboardFocused: true });
    const toolbar = container.querySelector(".rounded-full.border");
    expect(toolbar).toHaveClass("flex");
    expect(toolbar).not.toHaveClass("hidden");
  });

  it("is anchored at top-0 of its frame (no className override)", () => {
    const { container } = renderToolbar();
    const toolbar = container.querySelector(".rounded-full.border");
    expect(toolbar).toHaveClass("top-0");
    expect(toolbar).not.toHaveClass("-top-9");
  });

  it("is revealed by hover and by focus-within on the node group", () => {
    const { container } = renderToolbar();
    expect(container.querySelector(".rounded-full.border")).toHaveClass(
      "group-hover/node:flex",
      "group-focus-within/node:flex",
    );
  });
});
