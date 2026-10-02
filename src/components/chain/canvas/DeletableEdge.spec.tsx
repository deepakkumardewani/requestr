/** @vitest-environment happy-dom */

import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EdgeProps } from "@xyflow/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeletableEdge } from "./DeletableEdge";

const zoom = { current: 1 };

vi.mock("@xyflow/react", () => ({
  useStore: (selector: (s: { transform: number[] }) => unknown) =>
    selector({ transform: [0, 0, zoom.current] }),
  getBezierPath: () => ["M0,0 L100,100", 50, 50],
  BaseEdge: ({ path }: { path?: string }) =>
    React.createElement("path", { "data-testid": "base-edge", d: path }),
  EdgeLabelRenderer: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "edge-label" }, children),
}));

function edgeProps(
  overrides: Partial<EdgeProps> & {
    data?: { onDeleteEdge?: (id: string) => void };
  } = {},
): EdgeProps {
  return {
    id: "e1",
    source: "a",
    target: "b",
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: "right",
    targetPosition: "left",
    ...overrides,
  } as EdgeProps;
}

describe("DeletableEdge", () => {
  afterEach(() => {
    cleanup();
    zoom.current = 1;
  });

  it.each([
    ["success", "Success"],
    ["fail", "Fail"],
  ] as const)("renders the %s status label at normal zoom", (statusLabel, text) => {
    const { getByTestId } = render(
      <DeletableEdge {...edgeProps({ data: { statusLabel } })} />,
    );
    expect(getByTestId("edge-status-label").textContent).toBe(text);
  });

  it("shows the status label exactly at the 0.6 threshold and hides it below", () => {
    zoom.current = 0.6;
    const { queryByTestId, unmount } = render(
      <DeletableEdge {...edgeProps({ data: { statusLabel: "fail" } })} />,
    );
    expect(queryByTestId("edge-status-label")).not.toBeNull();
    unmount();

    zoom.current = 0.59;
    const hidden = render(
      <DeletableEdge {...edgeProps({ data: { statusLabel: "fail" } })} />,
    );
    expect(hidden.queryByTestId("edge-status-label")).toBeNull();
  });

  it("renders no status label for plain edges", () => {
    const { queryByTestId } = render(<DeletableEdge {...edgeProps()} />);
    expect(queryByTestId("edge-status-label")).toBeNull();
  });

  it("calls onDeleteEdge when delete control is used", async () => {
    const user = userEvent.setup();
    const onDeleteEdge = vi.fn();

    const { container } = render(
      <DeletableEdge
        {...edgeProps({
          data: { onDeleteEdge },
        })}
      />,
    );

    const deleteBtn = container.querySelector(
      'button[title="Delete edge"]',
    ) as HTMLButtonElement;
    await user.click(deleteBtn);

    expect(onDeleteEdge).toHaveBeenCalledWith("e1");
  });

  it("exposes the delete button without hover when the edge is selected", () => {
    const { container } = render(
      <DeletableEdge {...edgeProps({ selected: true })} />,
    );

    const deleteBtn = container.querySelector(
      'button[title="Delete edge"]',
    ) as HTMLButtonElement;

    expect(deleteBtn).toHaveClass("opacity-100");
    expect(deleteBtn).toHaveClass("pointer-events-auto");
  });

  it("hides the delete button by default (visible only via hover CSS)", () => {
    const { container } = render(<DeletableEdge {...edgeProps()} />);

    const deleteBtn = container.querySelector(
      'button[title="Delete edge"]',
    ) as HTMLButtonElement;

    expect(deleteBtn).toHaveClass("opacity-0");
    expect(deleteBtn).toHaveClass("pointer-events-none");
  });
});
