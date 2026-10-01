/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GhostNode } from "./GhostNode";

describe("GhostNode", () => {
  afterEach(() => {
    cleanup();
  });

  it("labels the preview with the block name at the cursor offset", () => {
    const { container } = render(
      <GhostNode type="delay" cursorPos={{ x: 10, y: 20 }} />,
    );

    expect(screen.getByText("Delay")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({ left: "22px", top: "32px" });
  });

  it("shows the placement hint alongside the preview", () => {
    render(<GhostNode type="condition" cursorPos={{ x: 0, y: 0 }} />);

    expect(
      screen.getByText("Click to place, Esc to cancel"),
    ).toBeInTheDocument();
  });
});
