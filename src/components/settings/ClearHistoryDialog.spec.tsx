/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import enSettings from "../../../messages/en/settings.json";
import { ClearHistoryDialog } from "./ClearHistoryDialog";

afterEach(cleanup);

function renderDialog(open = true) {
  const props = { open, onOpenChange: vi.fn(), onConfirm: vi.fn() };
  render(<ClearHistoryDialog {...props} />);
  return props;
}

describe("ClearHistoryDialog", () => {
  it("renders nothing when closed", () => {
    renderDialog(false);

    expect(screen.queryByTestId("confirm-clear-history-btn")).toBeNull();
  });

  it("shows the title, description and a localized confirm label when open", () => {
    renderDialog();

    expect(screen.getByTestId("confirm-clear-history-btn")).toHaveTextContent(
      enSettings.clearHistory.title,
    );
    expect(screen.getByText(enSettings.clearHistory.description)).toBeTruthy();
  });

  it("calls onOpenChange(false) and not onConfirm when Cancel is clicked", () => {
    const { onOpenChange, onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onOpenChange(false) and not onConfirm when Escape is pressed", () => {
    const { onOpenChange, onConfirm } = renderDialog();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm once when the confirm button is clicked", () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByTestId("confirm-clear-history-btn"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
