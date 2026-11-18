/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ValidateBlock } from "@/types/chain";

vi.mock("@/components/request/CodeEditor", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange?: (v: string) => void;
  }) => (
    <textarea
      data-testid="code-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

import { ValidateConfigPanel } from "./ValidateConfigPanel";

function buildNode(overrides: Partial<ValidateBlock> = {}): ValidateBlock {
  return {
    id: "validate-1",
    type: "validate",
    schema: '{"type":"object"}',
    sourceJsonPath: "$.data",
    ...overrides,
  };
}

describe("ValidateConfigPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when node is null", () => {
    const { container } = render(
      <ValidateConfigPanel
        open={false}
        node={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("saves the edited schema and source path", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <ValidateConfigPanel
        open
        node={buildNode()}
        onClose={onClose}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    const pathInput = screen.getByPlaceholderText(
      "$.data.token (blank validates the whole response)",
    );
    await user.clear(pathInput);
    await user.type(pathInput, "$.data.id");

    const editor = screen.getByTestId("code-editor");
    await user.clear(editor);
    await user.type(editor, "{{}");

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ sourceJsonPath: "$.data.id" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    ["empty", ""],
    ["malformed JSON", "{not json"],
    ["a non-schema JSON value", "42"],
  ])("disables Save when the schema is %s", async (_label, value) => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ValidateConfigPanel
        open
        node={buildNode({ schema: value })}
        onClose={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await user.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["a non-schema JSON value", "42"],
  ])("shows an inline error when the schema is %s", (_label, value) => {
    render(
      <ValidateConfigPanel
        open
        node={buildNode({ schema: value })}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Schema must be valid JSON (an object).",
    );
  });

  it.each([
    ["empty", ""],
    ["valid", '{"type":"object"}'],
  ])("shows no inline error when the schema is %s", (_label, value) => {
    render(
      <ValidateConfigPanel
        open
        node={buildNode({ schema: value })}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("deletes the node", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onClose = vi.fn();

    render(
      <ValidateConfigPanel
        open
        node={buildNode()}
        onClose={onClose}
        onSave={vi.fn()}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole("button", { name: /delete node/i }));

    expect(onDelete).toHaveBeenCalledWith("validate-1");
    expect(onClose).toHaveBeenCalled();
  });

  it("cancels without saving", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <ValidateConfigPanel
        open
        node={buildNode()}
        onClose={onClose}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
