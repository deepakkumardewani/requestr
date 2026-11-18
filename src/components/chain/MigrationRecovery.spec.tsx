/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import chainMessages from "../../../messages/en/chain.json";
import { MigrationError } from "@/lib/chainMigration";
import { MigrationRecovery } from "./MigrationRecovery";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: keyof typeof chainMessages) => chainMessages[key],
}));

function renderWithIntl(ui: React.ReactElement) {
  return render(ui);
}

afterEach(cleanup);

describe("MigrationRecovery", () => {
  it("renders the error message and both action buttons", () => {
    const error = new MigrationError("id collision", { id: "col-1" });
    renderWithIntl(
      <MigrationRecovery error={error} onRetry={vi.fn()} onOpenReadOnly={vi.fn()} />,
    );

    expect(screen.getByText("Chain migration failed")).toBeInTheDocument();
    expect(screen.getByText("id collision")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open in read-only mode" }),
    ).toBeInTheDocument();
  });

  it("calls onRetry when Retry is clicked", () => {
    const onRetry = vi.fn();
    renderWithIntl(
      <MigrationRecovery
        error={new MigrationError("boom")}
        onRetry={onRetry}
        onOpenReadOnly={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenReadOnly when the read-only button is clicked", () => {
    const onOpenReadOnly = vi.fn();
    renderWithIntl(
      <MigrationRecovery
        error={new MigrationError("boom")}
        onRetry={vi.fn()}
        onOpenReadOnly={onOpenReadOnly}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open in read-only mode" }));
    expect(onOpenReadOnly).toHaveBeenCalledTimes(1);
  });
});
