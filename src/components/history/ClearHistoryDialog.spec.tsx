/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClearHistoryDialog } from "./ClearHistoryDialog";

afterEach(cleanup);

function setup(count = 3, open = true) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  render(
    <ClearHistoryDialog
      open={open}
      onOpenChange={onOpenChange}
      count={count}
      onConfirm={onConfirm}
    />
  );
  return { onOpenChange, onConfirm, user: userEvent.setup() };
}

describe("ClearHistoryDialog", () => {
  it("renders nothing when closed", () => {
    setup(3, false);
    expect(
      screen.queryByTestId("clear-history-dialog")
    ).not.toBeInTheDocument();
  });

  it("states the count and that it cannot be undone", () => {
    setup(7);
    expect(screen.getByTestId("clear-history-body")).toHaveTextContent(
      "This removes 7 history entries. This cannot be undone."
    );
  });

  it("exposes an accessible dialog name and named buttons", () => {
    setup();
    expect(
      screen.getByRole("alertdialog", { name: "Clear all history?" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear history" })
    ).toBeInTheDocument();
  });

  it("calls onConfirm when confirmed", async () => {
    const { user, onConfirm } = setup();
    await user.click(screen.getByTestId("clear-history-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancel closes without confirming", async () => {
    const { user, onConfirm, onOpenChange } = setup();
    await user.click(screen.getByTestId("clear-history-cancel"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("is keyboard operable: Escape cancels, Enter on focused confirm confirms", async () => {
    const { user, onConfirm, onOpenChange } = setup();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    expect(onConfirm).not.toHaveBeenCalled();

    screen.getByTestId("clear-history-confirm").focus();
    await user.keyboard("{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
