/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReplaceConfirmDialog } from "./ReplaceConfirmDialog";

afterEach(cleanup);

function renderDialog(
  props: Partial<React.ComponentProps<typeof ReplaceConfirmDialog>> = {},
) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ReplaceConfirmDialog
      counts={{ collections: 3, environments: 1 }}
      busy={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ReplaceConfirmDialog", () => {
  it("stays closed without counts", () => {
    renderDialog({ counts: null });
    expect(screen.queryByTestId("backup-replace-confirm")).toBeNull();
  });

  it("lists what will be deleted per section with counts", () => {
    renderDialog();

    expect(screen.getByTestId("backup-replace-count-collections")).toHaveTextContent(
      "Collections: 3 items will be deleted",
    );
    expect(
      screen.getByTestId("backup-replace-count-environments"),
    ).toHaveTextContent("Environments: 1 item will be deleted");
  });

  it("lists only sections present in the counts, in section order", () => {
    renderDialog({ counts: { history: 0, collections: 2 } });

    const items = screen.getByTestId("backup-replace-counts").children;
    expect([...items].map((li) => li.textContent)).toEqual([
      "Collections: 2 items will be deleted",
      "History: 0 items will be deleted",
    ]);
  });

  it("states zero for a section whose count is missing", () => {
    renderDialog({ counts: { collections: undefined } });

    expect(
      screen.getByTestId("backup-replace-count-collections"),
    ).toHaveTextContent("Collections: 0 items will be deleted");
  });

  it("warns that it is permanent", () => {
    renderDialog();
    expect(
      screen.getByText(/This permanently deletes the following/),
    ).toBeInTheDocument();
  });

  it("confirms only through the explicit button", () => {
    const { onConfirm, onCancel } = renderDialog();

    fireEvent.click(screen.getByTestId("backup-replace-confirm-btn"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels from the Cancel button", () => {
    const { onConfirm, onCancel } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancels on Escape", () => {
    const { onConfirm, onCancel } = renderDialog();

    fireEvent.keyDown(screen.getByTestId("backup-replace-confirm"), {
      key: "Escape",
    });

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("has no close button besides Cancel", () => {
    renderDialog();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("disables both actions while busy", () => {
    renderDialog({ busy: true });

    expect(screen.getByTestId("backup-replace-confirm-btn")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
