/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ImportSection } from "./ImportSection";

describe("ImportSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the section with the correct id for nav scroll-spy", () => {
    const { container } = render(<ImportSection />);
    expect(container.querySelector("#import")).toBeInTheDocument();
  });

  it("renders the heading and format chips", () => {
    render(<ImportSection />);
    expect(screen.getByText("cURL")).toBeInTheDocument();
    expect(screen.getByText("Postman v2.1")).toBeInTheDocument();
    expect(screen.getByText("OpenAPI 3")).toBeInTheDocument();
    expect(screen.getByText("Swagger 2")).toBeInTheDocument();
  });

  it("does not render a dead 'see import formats' link", () => {
    render(<ImportSection />);
    expect(
      screen.queryByRole("link", { name: /see import formats/i }),
    ).not.toBeInTheDocument();
  });
});
