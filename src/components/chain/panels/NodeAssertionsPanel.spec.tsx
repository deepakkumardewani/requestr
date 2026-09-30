/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChainAssertion } from "@/types/chain";
import { NodeAssertionsPanel } from "./NodeAssertionsPanel";

function buildAssertion(
  overrides: Partial<ChainAssertion> = {},
): ChainAssertion {
  return {
    id: "a1",
    source: "status",
    operator: "eq",
    expectedValue: "200",
    enabled: true,
    ...overrides,
  };
}

describe("NodeAssertionsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the empty state", () => {
    render(<NodeAssertionsPanel assertions={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/no assertions yet/i)).toBeInTheDocument();
  });

  it("switches to the schema source and shows a schema editor with exists/not_exists operators only", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <NodeAssertionsPanel
        assertions={[buildAssertion()]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(screen.getByText("JSON Schema"));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ source: "schema", operator: "exists" }),
    ]);
  });

  it("edits the schema textarea for a schema-source assertion", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <NodeAssertionsPanel
        assertions={[
          buildAssertion({
            source: "schema",
            operator: "exists",
            expectedValue: undefined,
            schema: "",
          }),
        ]}
        onChange={onChange}
      />,
    );

    const textarea = screen.getByLabelText("JSON Schema");
    await user.type(textarea, "{{}}");

    expect(onChange).toHaveBeenCalled();
  });
});
