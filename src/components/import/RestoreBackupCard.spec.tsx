/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RestoreBackupCard } from "./RestoreBackupCard";

vi.mock("@/components/settings/backup/ImportBackupDialog", () => ({
  ImportBackupDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="backup-import-dialog" /> : null,
}));

afterEach(cleanup);

describe("RestoreBackupCard", () => {
  it("shows the restore card", () => {
    render(<RestoreBackupCard />);

    expect(screen.getByTestId("restore-backup-card")).toHaveTextContent(
      "Restore a Requestr backup",
    );
  });

  it("opens the import dialog from the button", () => {
    render(<RestoreBackupCard />);
    expect(screen.queryByTestId("backup-import-dialog")).toBeNull();

    fireEvent.click(screen.getByTestId("restore-backup-btn"));

    expect(screen.getByTestId("backup-import-dialog")).toBeTruthy();
  });
});
