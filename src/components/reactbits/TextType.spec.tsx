/** @vitest-environment happy-dom */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextType } from "./TextType";

function mockReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

describe("TextType", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the first phrase as an accessible label (SSR-safe text)", () => {
    mockReducedMotion(false);
    render(<TextType text="Hello world" />);
    expect(screen.getByLabelText("Hello world")).toBeInTheDocument();
  });

  it("renders static text with no cursor when reduced motion is set", () => {
    mockReducedMotion(true);
    const { container } = render(<TextType text="Static" cursorChar="|" />);
    expect(screen.getByLabelText("Static")).toHaveTextContent("Static");
    expect(container.textContent).not.toContain("|");
  });

  it("accepts an array of phrases without crashing", () => {
    mockReducedMotion(true);
    render(<TextType text={["One", "Two"]} />);
    expect(screen.getByLabelText("One")).toBeInTheDocument();
  });
});
