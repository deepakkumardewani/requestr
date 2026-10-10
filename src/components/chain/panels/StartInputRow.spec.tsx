/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type DraftInput, StartInputRow } from "./StartInputRow";

afterEach(cleanup);

function makeInput(overrides: Partial<DraftInput> = {}): DraftInput {
  return {
    rowId: "row-1",
    key: "token",
    source: "literal",
    defaultValue: "abc",
    ...overrides,
  } as DraftInput;
}

function setup(
  input: DraftInput = makeInput(),
  props: { isDuplicate?: boolean } = {},
) {
  const onChange = vi.fn();
  const onDelete = vi.fn();
  render(
    <StartInputRow
      input={input}
      isDuplicate={props.isDuplicate ?? false}
      onChange={onChange}
      onDelete={onDelete}
    />,
  );
  return { onChange, onDelete };
}

describe("StartInputRow", () => {
  it("shows the literal default value field when source is literal", () => {
    setup(makeInput({ source: "literal", defaultValue: "hello" }));

    expect(screen.getByTestId("start-config-default-value")).toHaveValue("hello");
    expect(screen.queryByTestId("start-config-env-var")).not.toBeInTheDocument();
  });

  it("shows the env var field when source is env", () => {
    setup(makeInput({ source: "env", envVarKey: "API_KEY" }));

    expect(screen.getByTestId("start-config-env-var")).toHaveValue("API_KEY");
    expect(
      screen.queryByTestId("start-config-default-value"),
    ).not.toBeInTheDocument();
  });

  it("falls back to an empty env var field when envVarKey is undefined", () => {
    setup(makeInput({ source: "env", envVarKey: undefined }));

    expect(screen.getByTestId("start-config-env-var")).toHaveValue("");
  });

  it("reflects the active source through aria-pressed on the toggle buttons", () => {
    setup(makeInput({ source: "env" }));

    expect(screen.getByTestId("start-config-source-env-btn")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByTestId("start-config-source-literal-btn"),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the new key with the row id when the key is edited", () => {
    const { onChange } = setup(makeInput({ key: "" }));

    fireEvent.change(screen.getByTestId("start-config-input-key"), {
      target: { value: "user" },
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith("row-1", { key: "user" });
  });

  it("reports the new default value when the literal field is edited", () => {
    const { onChange } = setup(makeInput({ defaultValue: "" }));

    fireEvent.change(screen.getByTestId("start-config-default-value"), {
      target: { value: "x" },
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith("row-1", {
      defaultValue: "x",
    });
  });

  it("reports the new env var key when the env field is edited", () => {
    const { onChange } = setup(makeInput({ source: "env", envVarKey: "" }));

    fireEvent.change(screen.getByTestId("start-config-env-var"), {
      target: { value: "HOST" },
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith("row-1", {
      envVarKey: "HOST",
    });
  });

  it("switches the source to env when the Env toggle is pressed", async () => {
    const user = userEvent.setup();
    const { onChange } = setup(makeInput({ source: "literal" }));

    await user.click(screen.getByTestId("start-config-source-env-btn"));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("row-1", { source: "env" });
  });

  it("switches the source to literal when the Literal toggle is pressed", async () => {
    const user = userEvent.setup();
    const { onChange } = setup(makeInput({ source: "env" }));

    await user.click(screen.getByTestId("start-config-source-literal-btn"));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("row-1", {
      source: "literal",
    });
  });

  it("deletes the row by id when the delete button is pressed", async () => {
    const user = userEvent.setup();
    const { onDelete } = setup(makeInput({ rowId: "row-9" }));

    await user.click(screen.getByTestId("start-config-delete-input-btn"));

    expect(onDelete).toHaveBeenCalledExactlyOnceWith("row-9");
  });

  it("flags the key invalid and shows the uniqueness message when duplicated", () => {
    setup(makeInput(), { isDuplicate: true });

    expect(screen.getByTestId("start-config-input-key")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Key must be unique")).toBeInTheDocument();
  });

  it("flags a blank key invalid without showing the uniqueness message", () => {
    setup(makeInput({ key: "   " }));

    expect(screen.getByTestId("start-config-input-key")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.queryByText("Key must be unique")).not.toBeInTheDocument();
  });

  it("marks a unique non-blank key as valid", () => {
    setup(makeInput({ key: "ok" }));

    expect(screen.getByTestId("start-config-input-key")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });
});
