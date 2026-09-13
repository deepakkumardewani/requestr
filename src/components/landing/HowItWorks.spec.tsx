/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HowItWorks } from "./HowItWorks";

describe("HowItWorks", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the section with the correct id for nav scroll-spy", () => {
    const { container } = render(<HowItWorks />);
    expect(container.querySelector("#how-it-works")).toBeInTheDocument();
  });

  it("renders all three steps in order", () => {
    render(<HowItWorks />);
    expect(screen.getByText("Open a tab.")).toBeInTheDocument();
    expect(screen.getByText("Send through the proxy.")).toBeInTheDocument();
    expect(screen.getByText("Everything stays here.")).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });
});
