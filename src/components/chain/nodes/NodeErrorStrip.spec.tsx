/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ChainNodeState } from "@/types/chain";
import { NodeErrorStrip } from "./NodeErrorStrip";

afterEach(cleanup);

describe("NodeErrorStrip", () => {
  it("renders the error with a title tooltip when failed", () => {
    render(<NodeErrorStrip state="failed" error="Boom" />);
    const strip = screen.getByText("Boom");
    expect(strip).toHaveAttribute("title", "Boom");
  });

  it.each<ChainNodeState>(["passed", "running", "skipped", "aborted"])(
    "renders nothing in the %s state",
    (state) => {
      const { container } = render(
        <NodeErrorStrip state={state} error="Boom" />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("renders nothing when failed without an error message", () => {
    const { container } = render(<NodeErrorStrip state="failed" error="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses inline spacing by default and absolute pinning for the absolute variant", () => {
    const { rerender } = render(<NodeErrorStrip state="failed" error="E" />);
    expect(screen.getByText("E")).toHaveClass("mt-1");

    rerender(<NodeErrorStrip state="failed" error="E" variant="absolute" />);
    expect(screen.getByText("E")).toHaveClass("absolute", "truncate");
  });

  it("merges a custom className", () => {
    render(<NodeErrorStrip state="failed" error="E" className="custom" />);
    expect(screen.getByText("E")).toHaveClass("custom");
  });
});
