/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BeyondSend } from "./BeyondSend";

describe("BeyondSend", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the section with the correct id for nav scroll-spy", () => {
    const { container } = render(<BeyondSend />);
    expect(container.querySelector("#beyond-send")).toBeInTheDocument();
  });

  it("renders the chains row", () => {
    render(<BeyondSend />);
    expect(screen.getByText("Visual request chains.")).toBeInTheDocument();
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Get user")).toBeInTheDocument();
    expect(screen.getByText("Delete session")).toBeInTheDocument();
  });

  it("renders the AI row", () => {
    render(<BeyondSend />);
    expect(screen.getByText("AI where you already work.")).toBeInTheDocument();
    expect(
      screen.getByText("generate body for POST /orders"),
    ).toBeInTheDocument();
  });
});
