/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserMessageActions } from "./UserMessageActions";

afterEach(cleanup);

function openEditor(text = "original") {
  const onResend = vi.fn();
  render(<UserMessageActions text={text} onResend={onResend} />);
  fireEvent.click(screen.getByTestId("relay-edit-message"));
  return { onResend, input: screen.getByTestId("relay-edit-input") as HTMLTextAreaElement };
}

describe("UserMessageActions", () => {
  it("starts as a single labelled edit button", () => {
    render(<UserMessageActions text="hi" onResend={vi.fn()} />);
    expect(screen.getByTestId("relay-edit-message")).toHaveAttribute("aria-label", "actions.editResend");
    expect(screen.queryByTestId("relay-edit-form")).toBeNull();
  });

  it("opens an editor prefilled with the message", () => {
    const { input } = openEditor("original");
    expect(input.value).toBe("original");
    expect(screen.queryByTestId("relay-edit-message")).toBeNull();
  });

  it("resends the trimmed edit and closes the editor", () => {
    const { onResend, input } = openEditor();
    fireEvent.change(input, { target: { value: "  edited text  " } });
    fireEvent.click(screen.getByTestId("relay-edit-resend"));
    expect(onResend).toHaveBeenCalledWith("edited text");
    expect(screen.queryByTestId("relay-edit-form")).toBeNull();
  });

  it("disables Resend and ignores Enter when the draft is blank", () => {
    const { onResend, input } = openEditor();
    fireEvent.change(input, { target: { value: "   " } });
    expect(screen.getByTestId("relay-edit-resend")).toBeDisabled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onResend).not.toHaveBeenCalled();
    expect(screen.getByTestId("relay-edit-form")).toBeTruthy();
  });

  it("resends on Enter but not on Shift+Enter", () => {
    const { onResend, input } = openEditor();
    fireEvent.change(input, { target: { value: "go" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onResend).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onResend).toHaveBeenCalledWith("go");
  });

  it("Cancel closes without resending and returns focus to the edit button", () => {
    const { onResend, input } = openEditor();
    fireEvent.change(input, { target: { value: "changed" } });
    fireEvent.click(screen.getByTestId("relay-edit-cancel"));
    expect(onResend).not.toHaveBeenCalled();
    expect(screen.queryByTestId("relay-edit-form")).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId("relay-edit-message"));
  });

  it("Escape closes the editor and does not bubble to the dock", () => {
    const outer = vi.fn();
    const onResend = vi.fn();
    render(
      <div onKeyDown={outer}>
        <UserMessageActions text="t" onResend={onResend} />
      </div>,
    );
    fireEvent.click(screen.getByTestId("relay-edit-message"));
    fireEvent.keyDown(screen.getByTestId("relay-edit-input"), { key: "Escape" });
    expect(screen.queryByTestId("relay-edit-form")).toBeNull();
    expect(outer).not.toHaveBeenCalled();
    expect(onResend).not.toHaveBeenCalled();
  });

  it("ignores other keys", () => {
    const { onResend, input } = openEditor();
    fireEvent.keyDown(input, { key: "a" });
    expect(onResend).not.toHaveBeenCalled();
    expect(screen.getByTestId("relay-edit-form")).toBeTruthy();
  });
});
