/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUP_SIZE_WARN_BYTES } from "@/lib/backup/constants";
import type { RestoreSummary } from "@/lib/backup/importer";
import { ImportBackupDialog } from "./ImportBackupDialog";

const mocks = vi.hoisted(() => ({
  restoreBackup: vi.fn(),
  countReplaceDeletes: vi.fn(),
  reloadWorkspace: vi.fn(),
}));

vi.mock("@/lib/backup/importer", () => ({ restoreBackup: mocks.restoreBackup }));
vi.mock("@/lib/backup/replace", () => ({
  countReplaceDeletes: mocks.countReplaceDeletes,
}));
vi.mock("@/lib/backup/broadcast", () => ({
  reloadWorkspace: mocks.reloadWorkspace,
}));

const SUMMARY: RestoreSummary = {
  mode: "merge",
  added: 5,
  skipped: 2,
  kept: 1,
  closedTabs: 0,
  danglingCount: 3,
};

function backupText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    app: "requestr-backup",
    schemaVersion: 1,
    idbVersion: 1,
    exportedAt: "2026-03-04T10:00:00.000Z",
    appVersion: "1.0.0",
    includesSecrets: false,
    sections: ["collections", "environments"],
    data: {
      collections: [{ id: "c1" }, { id: "c2" }],
      folders: [],
      requests: [],
      chainConfigs: [],
      environments: [{ id: "e1" }],
    },
    ...overrides,
  });
}

function pick(text: string, name = "backup.json", size?: number) {
  const file = new File([text], name, { type: "application/json" });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  fireEvent.change(screen.getByTestId("backup-file-input"), {
    target: { files: [file] },
  });
}

async function reachPreview(text = backupText()) {
  render(<ImportBackupDialog open onClose={vi.fn()} />);
  pick(text);
  await screen.findByTestId("backup-preview");
}

beforeEach(() => {
  mocks.restoreBackup.mockResolvedValue(SUMMARY);
  mocks.countReplaceDeletes.mockResolvedValue({ collections: 7, chains: 1 });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("ImportBackupDialog", () => {
  it("renders nothing while closed", () => {
    render(<ImportBackupDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId("backup-import-dialog")).toBeNull();
  });

  it("starts at the file picker with no error", () => {
    render(<ImportBackupDialog open onClose={vi.fn()} />);

    expect(screen.getByTestId("backup-drop-zone")).toBeInTheDocument();
    expect(screen.queryByTestId("backup-import-error")).toBeNull();
    expect(screen.queryByTestId("backup-restore-btn")).toBeNull();
  });

  it("opens the file chooser from the Choose file button", () => {
    render(<ImportBackupDialog open onClose={vi.fn()} />);
    const click = vi.spyOn(
      screen.getByTestId("backup-file-input") as HTMLInputElement,
      "click",
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose file" }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  describe("error messages", () => {
    it.each([
      ["invalidJson", "not json at all", "This file is not valid JSON."],
      [
        "invalidFile",
        JSON.stringify({ app: "requestr-backup" }),
        "This file is not a valid Requestr backup.",
      ],
      [
        "newerVersion",
        backupText({ schemaVersion: 9 }),
        "This backup was made by a newer version of Requestr (v9). Update the app to restore it.",
      ],
      [
        "unsupportedVersion",
        backupText({ schemaVersion: 0 }),
        "This backup version is no longer supported.",
      ],
      [
        "damagedSection",
        backupText({
          data: { collections: [{ nope: true }], folders: [], requests: [], chainConfigs: [] },
          sections: ["collections"],
        }),
        "The backup is damaged: Collections is invalid.",
      ],
    ])("shows the %s message and stays on the picker", async (_code, text, message) => {
      render(<ImportBackupDialog open onClose={vi.fn()} />);

      pick(text);

      expect(await screen.findByTestId("backup-import-error")).toHaveTextContent(
        message,
      );
      expect(screen.getByTestId("backup-drop-zone")).toBeInTheDocument();
      expect(screen.queryByTestId("backup-import-link")).toBeNull();
      expect(mocks.restoreBackup).not.toHaveBeenCalled();
    });

    it("shows the foreign-file message with a link to /import", async () => {
      render(<ImportBackupDialog open onClose={vi.fn()} />);

      pick(JSON.stringify({ info: { name: "Postman" }, item: [] }));

      expect(await screen.findByTestId("backup-import-error")).toHaveTextContent(
        "This is not a Requestr backup. Use Import for Postman, Insomnia or OpenAPI files.",
      );
      expect(screen.getByTestId("backup-import-link")).toHaveAttribute(
        "href",
        "/import",
      );
    });
  });

  describe("preview", () => {
    it("shows counts, export date and secrets status with Merge selected", async () => {
      await reachPreview();

      expect(screen.getByText("backup.json")).toBeInTheDocument();
      expect(screen.getByTestId("backup-preview-collections")).toHaveTextContent(
        "Collections2 items",
      );
      expect(
        screen.getByTestId("backup-preview-environments"),
      ).toHaveTextContent("Environments1 item");
      expect(screen.getByTestId("backup-preview-secrets")).toHaveTextContent(
        "Secret values were left out",
      );
      expect(screen.getByTestId("backup-mode-merge")).toBeChecked();
      expect(screen.getByTestId("backup-mode-replace")).not.toBeChecked();
      expect(screen.queryByText(/Large backup/)).toBeNull();
    });

    it("says when the backup includes secrets", async () => {
      await reachPreview(backupText({ includesSecrets: true }));
      expect(screen.getByTestId("backup-preview-secrets")).toHaveTextContent(
        "Includes secret values",
      );
    });

    it("warns about a large file", async () => {
      render(<ImportBackupDialog open onClose={vi.fn()} />);

      pick(backupText(), "big.json", BACKUP_SIZE_WARN_BYTES + 1);

      expect(
        await screen.findByText("Large backup, restore may take a while."),
      ).toBeInTheDocument();
    });

    it("lets the user pick a file by dropping it", async () => {
      render(<ImportBackupDialog open onClose={vi.fn()} />);
      const zone = screen.getByTestId("backup-drop-zone");
      const file = new File([backupText()], "dropped.json");

      fireEvent.dragOver(zone);
      expect(zone.className).toContain("border-primary");
      fireEvent.dragLeave(zone);
      expect(zone.className).not.toContain("border-primary");
      fireEvent.drop(zone, { dataTransfer: { files: [file] } });

      expect(await screen.findByText("dropped.json")).toBeInTheDocument();
    });

    it("ignores a drop that carries no file", () => {
      render(<ImportBackupDialog open onClose={vi.fn()} />);

      fireEvent.drop(screen.getByTestId("backup-drop-zone"), {
        dataTransfer: { files: [] },
      });

      expect(screen.getByTestId("backup-drop-zone")).toBeInTheDocument();
    });

    it("ignores a file input change that carries no file", () => {
      render(<ImportBackupDialog open onClose={vi.fn()} />);

      fireEvent.change(screen.getByTestId("backup-file-input"), {
        target: { files: [] },
      });

      expect(screen.getByTestId("backup-drop-zone")).toBeInTheDocument();
    });
  });

  describe("merge restore", () => {
    it("restores in merge mode without asking for confirmation", async () => {
      await reachPreview();

      fireEvent.click(screen.getByTestId("backup-restore-btn"));

      expect(await screen.findByTestId("backup-summary")).toBeInTheDocument();
      expect(mocks.restoreBackup).toHaveBeenCalledWith(
        expect.objectContaining({ app: "requestr-backup" }),
        "merge",
      );
      expect(screen.queryByTestId("backup-replace-confirm")).toBeNull();
      expect(mocks.countReplaceDeletes).not.toHaveBeenCalled();
    });

    it("summarises what was added, skipped, kept and dangling", async () => {
      await reachPreview();

      fireEvent.click(screen.getByTestId("backup-restore-btn"));

      const summary = await screen.findByTestId("backup-summary");
      expect(summary).toHaveTextContent("5 items added");
      expect(summary).toHaveTextContent("2 identical items skipped");
      expect(summary).toHaveTextContent(
        "1 item kept alongside your existing one",
      );
      expect(screen.getByTestId("backup-summary-dangling")).toHaveTextContent(
        "3 links point to items that are missing.",
      );
      expect(screen.getByText("Backup restored")).toBeInTheDocument();
      expect(screen.queryByTestId("backup-restore-btn")).toBeNull();
    });

    it("omits zero-valued summary lines", async () => {
      mocks.restoreBackup.mockResolvedValue({
        ...SUMMARY,
        skipped: 0,
        kept: 0,
        danglingCount: 0,
      });
      await reachPreview();

      fireEvent.click(screen.getByTestId("backup-restore-btn"));

      const summary = await screen.findByTestId("backup-summary");
      expect(summary).not.toHaveTextContent("skipped");
      expect(summary).not.toHaveTextContent("kept");
      expect(screen.queryByTestId("backup-summary-dangling")).toBeNull();
    });

    it("reloads the workspace after the summary has been readable for 3 seconds", async () => {
      await reachPreview();
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

      fireEvent.click(screen.getByTestId("backup-restore-btn"));
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(screen.getByTestId("backup-summary")).toBeInTheDocument();
      await act(() => vi.advanceTimersByTimeAsync(2999));
      expect(mocks.reloadWorkspace).not.toHaveBeenCalled();
      await act(() => vi.advanceTimersByTimeAsync(1));

      expect(mocks.reloadWorkspace).toHaveBeenCalledTimes(1);
    });

    it("shows a failure notice and stays on the preview when the restore throws", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.restoreBackup.mockRejectedValue(new Error("quota"));
      await reachPreview();

      fireEvent.click(screen.getByTestId("backup-restore-btn"));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Could not restore this backup. Nothing was changed.",
      );
      expect(screen.getByTestId("backup-restore-btn")).toBeEnabled();
      expect(screen.queryByTestId("backup-summary")).toBeNull();
      error.mockRestore();
    });
  });

  describe("replace restore", () => {
    async function chooseReplaceAndRestore() {
      await reachPreview();
      fireEvent.click(screen.getByTestId("backup-mode-replace"));
      fireEvent.click(screen.getByTestId("backup-restore-btn"));
      await screen.findByTestId("backup-replace-confirm");
    }

    it("cannot be bypassed: it lists counts and writes nothing until confirmed", async () => {
      await chooseReplaceAndRestore();

      expect(
        screen.getByTestId("backup-replace-count-collections"),
      ).toHaveTextContent("Collections: 7 items will be deleted");
      expect(screen.getByTestId("backup-replace-count-chains")).toHaveTextContent(
        "Chains: 1 item will be deleted",
      );
      expect(mocks.restoreBackup).not.toHaveBeenCalled();
    });

    it("Cancel closes the confirmation and changes nothing", async () => {
      await chooseReplaceAndRestore();

      fireEvent.click(
        screen.getByRole("button", { name: "Cancel", description: "" }),
      );

      await waitFor(() =>
        expect(screen.queryByTestId("backup-replace-confirm")).toBeNull(),
      );
      expect(mocks.restoreBackup).not.toHaveBeenCalled();
      expect(screen.getByTestId("backup-restore-btn")).toBeInTheDocument();
    });

    it("confirming restores in replace mode", async () => {
      await chooseReplaceAndRestore();

      fireEvent.click(screen.getByTestId("backup-replace-confirm-btn"));

      expect(await screen.findByTestId("backup-summary")).toBeInTheDocument();
      expect(mocks.restoreBackup).toHaveBeenCalledWith(
        expect.objectContaining({ app: "requestr-backup" }),
        "replace",
      );
      await waitFor(() =>
        expect(screen.queryByTestId("backup-replace-confirm")).toBeNull(),
      );
    });

    it("closes the confirmation and reports failure when the replace throws", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.restoreBackup.mockRejectedValue(new Error("boom"));
      await chooseReplaceAndRestore();

      fireEvent.click(screen.getByTestId("backup-replace-confirm-btn"));

      await waitFor(() =>
        expect(screen.queryByTestId("backup-replace-confirm")).toBeNull(),
      );
      expect(screen.getByText(/Could not restore this backup/)).toBeInTheDocument();
      error.mockRestore();
    });
  });

  it("calls onClose from Cancel on the picker", () => {
    const onClose = vi.fn();
    render(<ImportBackupDialog open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when dismissed with Escape", () => {
    const onClose = vi.fn();
    render(<ImportBackupDialog open onClose={onClose} />);

    fireEvent.keyDown(screen.getByTestId("backup-import-dialog"), {
      key: "Escape",
    });

    expect(onClose).toHaveBeenCalled();
  });
});
