/** @vitest-environment happy-dom */

import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodeToolbar } from "./NodeToolbar";

describe("NodeToolbar", () => {
  afterEach(() => {
    cleanup();
  });

  it("invokes onRunNode when run button is pressed", async () => {
    const user = userEvent.setup();
    const onRunNode = vi.fn();

    const { container } = render(
      <div className="group/node relative">
        <NodeToolbar
          data={{
            requestId: "r1",
            name: "Test",
            method: "GET",
            url: "https://a.test",
            state: "idle",
            onRunNode,
          }}
        />
      </div>,
    );

    const runBtn = container.querySelector(
      '[aria-label="Run independently"]',
    ) as HTMLButtonElement;
    await user.click(runBtn);

    expect(onRunNode).toHaveBeenCalledWith("r1");
  });
});
