/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSettingsSections } from "@/app/settings/constants";
import { DataSection } from "./DataSection";

vi.mock("@/lib/backup/exporter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/backup/exporter")>()),
  collectBackupData: vi.fn().mockResolvedValue({}),
  prepareBackup: vi.fn().mockResolvedValue({
    envelope: { exportedAt: "2026-03-04T10:00:00.000Z" },
    data: {},
    estimate: { bytes: 10, counts: {} },
    danglingCount: 0,
  }),
  toBackupBlob: vi.fn(),
}));

afterEach(cleanup);

describe("DataSection", () => {
  it("offers Export backup and Import backup", () => {
    render(<DataSection />);

    expect(screen.getByTestId("backup-export-btn")).toHaveTextContent(
      "Export backup",
    );
    expect(screen.getByTestId("backup-import-btn")).toHaveTextContent(
      "Import backup",
    );
  });

  it("marks the chosen action as the open dialog", () => {
    render(<DataSection />);
    const exportBtn = screen.getByTestId("backup-export-btn");
    const importBtn = screen.getByTestId("backup-import-btn");

    fireEvent.click(importBtn);

    expect(importBtn).toHaveAttribute("aria-expanded", "true");
    expect(exportBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the export dialog and closes it again with Cancel", async () => {
    render(<DataSection />);
    const exportBtn = screen.getByTestId("backup-export-btn");

    fireEvent.click(exportBtn);

    expect(await screen.findByTestId("backup-export-dialog")).toBeVisible();
    expect(exportBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByTestId("backup-import-dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByTestId("backup-export-dialog")).toBeNull(),
    );
    expect(exportBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the import dialog and closes it again with Cancel", async () => {
    render(<DataSection />);

    fireEvent.click(screen.getByTestId("backup-import-btn"));

    expect(await screen.findByTestId("backup-import-dialog")).toBeVisible();
    expect(screen.queryByTestId("backup-export-dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByTestId("backup-import-dialog")).toBeNull(),
    );
  });

  it("is listed in the settings navigation before Relay", () => {
    const ids = getSettingsSections().map(([id]) => id);
    expect(ids).toContain("data");
    expect(ids.indexOf("data")).toBeLessThan(ids.indexOf("relay"));
  });
});
