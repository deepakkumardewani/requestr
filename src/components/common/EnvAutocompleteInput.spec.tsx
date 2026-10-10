/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnvAutocompleteInput } from "./EnvAutocompleteInput";

vi.mock("@/hooks/useEnvVariableKeys", () => ({
  useEnvVariableKeys: () => ["API_KEY", "API_URL", "OTHER"],
}));

function ControlledEnvInput() {
  const [value, setValue] = useState("");
  return (
    <EnvAutocompleteInput
      value={value}
      onChange={(e) => setValue(e.target.value)}
      aria-label="env"
    />
  );
}

afterEach(() => {
  cleanup();
});

describe("EnvAutocompleteInput", () => {
  it("shows suggestions when typing after {{", () => {
    const onChange = vi.fn();
    render(
      <EnvAutocompleteInput value="" onChange={onChange} aria-label="env" />,
    );

    const input = screen.getByLabelText("env");
    fireEvent.change(input, { target: { value: "prefix {{API" } });

    expect(screen.getByText("API_KEY")).toBeInTheDocument();
    expect(screen.getByText("API_URL")).toBeInTheDocument();
  });

  it("completes first matching variable on Enter after typing", async () => {
    const user = userEvent.setup();

    render(<ControlledEnvInput />);

    const input = screen.getByLabelText("env");
    await user.type(input, "x {{{{API");

    expect(await screen.findByText("API_KEY")).toBeInTheDocument();

    await user.keyboard("{Enter}");

    expect(input).toHaveValue("x {{API_KEY}}");
  });
});

describe("EnvAutocompleteInput variable highlighting", () => {
  const OVERLAY_ID = "variable-highlight-overlay";

  it("renders no overlay unless highlightVariables is set", () => {
    render(<EnvAutocompleteInput value="{{a}}" onChange={vi.fn()} aria-label="env" />);
    expect(screen.queryByTestId(OVERLAY_ID)).toBeNull();
  });

  it("scrolls the overlay text with the input", () => {
    render(
      <EnvAutocompleteInput
        highlightVariables
        value="{{a}}"
        onChange={vi.fn()}
        aria-label="env"
      />,
    );
    const input = screen.getByLabelText("env");
    input.scrollLeft = 42;
    fireEvent.scroll(input);
    const inner = screen.getByTestId(OVERLAY_ID).firstElementChild as HTMLElement;
    expect(inner.style.transform).toBe("translateX(-42px)");
  });

  it("uses identical font-size classes on input and overlay at every breakpoint", () => {
    render(
      <EnvAutocompleteInput
        highlightVariables
        value=""
        onChange={vi.fn()}
        aria-label="env"
      />,
    );
    const sizeClasses = (el: Element) =>
      Array.from(el.classList).filter((c) => /^(md:)?text-(xs|sm|base)$/.test(c));
    const input = screen.getByLabelText("env");
    const overlay = screen.getByTestId(OVERLAY_ID);
    expect(sizeClasses(input).sort()).toEqual(["md:text-xs", "text-xs"]);
    expect(sizeClasses(overlay).sort()).toEqual(sizeClasses(input).sort());
  });

  it("dims the overlay when the input is disabled", () => {
    render(
      <EnvAutocompleteInput
        highlightVariables
        disabled
        value=""
        onChange={vi.fn()}
        aria-label="env"
      />,
    );
    expect(screen.getByTestId(OVERLAY_ID)).toHaveClass("opacity-50");
  });
});
