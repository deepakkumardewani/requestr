/** @vitest-environment happy-dom */

import { cleanup, render } from "@testing-library/react";
import { Play } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeHoverFrame } from "./NodeHoverFrame";
import type { ToolbarAction } from "./NodeToolbar";

const ACTIONS: ToolbarAction[] = [
  { id: "run", icon: Play, label: "Run", onClick: vi.fn() },
];
const TOOLBAR_SELECTOR = ".rounded-full.border";

function renderFrame(
  actions: ToolbarAction[] = ACTIONS,
  isKeyboardFocused?: boolean,
) {
  const utils = render(
    <NodeHoverFrame actions={actions} isKeyboardFocused={isKeyboardFocused}>
      <div data-testid="card">card</div>
    </NodeHoverFrame>,
  );
  const frame = utils.container.firstElementChild as HTMLElement;
  return { ...utils, frame, toolbar: frame.querySelector(TOOLBAR_SELECTOR) };
}

describe("NodeHoverFrame", () => {
  afterEach(() => {
    cleanup();
  });

  it("hosts the toolbar inside the group/node hover scope with a bridging pt-9 zone", () => {
    const { frame, toolbar, getByTestId } = renderFrame();

    expect(frame).toHaveClass("group/node", "relative", "-mt-9", "pt-9");
    expect(toolbar).not.toBeNull();
    expect(frame).toContainElement(toolbar as HTMLElement);
    expect(frame).toContainElement(getByTestId("card"));
  });

  it("anchors the toolbar to the top of the bridge zone and shows it on hover or focus-within", () => {
    const { toolbar } = renderFrame();

    expect(toolbar).toHaveClass(
      "top-0",
      "hidden",
      "group-hover/node:flex",
      "group-focus-within/node:flex",
    );
    expect(toolbar).not.toHaveClass("-top-9");
  });

  it("lets clicks pass through the strip so a neighbour's strip never covers a node, bridging the toolbar gap itself", () => {
    const { frame, toolbar } = renderFrame();

    expect(frame).toHaveClass(
      "pointer-events-none",
      "[&>*]:pointer-events-auto",
    );
    expect(toolbar).toHaveClass("after:absolute", "after:top-full");
  });

  it("stays visible while keyboard-focused", () => {
    const { toolbar } = renderFrame(ACTIONS, true);

    expect(toolbar).toHaveClass("flex");
    expect(toolbar).not.toHaveClass("hidden");
  });

  it("renders no toolbar and no bridge zone without actions", () => {
    const { frame, toolbar } = renderFrame([]);

    expect(toolbar).toBeNull();
    expect(frame).toHaveClass("group/node", "relative");
    expect(frame).not.toHaveClass("pt-9");
    expect(frame).not.toHaveClass("-mt-9");
    expect(frame).not.toHaveClass("pointer-events-none");
  });

  it("keeps the card bounds identical: the bridge's pt-9 is cancelled by -mt-9", () => {
    const { frame } = renderFrame();

    const topPadding = frame.className.match(/(?:^|\s)pt-(\d+)/)?.[1];
    const topMargin = frame.className.match(/(?:^|\s)-mt-(\d+)/)?.[1];
    expect(topPadding).toBeDefined();
    expect(topPadding).toBe(topMargin);
  });
});
