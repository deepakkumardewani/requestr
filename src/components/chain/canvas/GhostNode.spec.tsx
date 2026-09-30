/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GhostNode } from "./GhostNode";

describe("GhostNode", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows delay preview copy at cursor offset", () => {
    render(<GhostNode type="delay" cursorPos={{ x: 10, y: 20 }} />);

    expect(screen.getByText("Wait")).toBeInTheDocument();
    expect(screen.getByText("1000")).toBeInTheDocument();
    expect(screen.getByText("ms")).toBeInTheDocument();
  });

  it("shows the placement hint alongside the preview", () => {
    render(<GhostNode type="condition" cursorPos={{ x: 0, y: 0 }} />);

    expect(
      screen.getByText("Click to place, Esc to cancel"),
    ).toBeInTheDocument();
  });
});
