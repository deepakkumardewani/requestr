/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUP_SIZE_WARN_BYTES } from "@/lib/backup/constants";
import type { BackupOptions, PreparedBackup } from "@/lib/backup/exporter";
import { ExportBackupDialog } from "./ExportBackupDialog";

const mocks = vi.hoisted(() => ({
  collectBackupData: vi.fn(),
  prepareBackup: vi.fn(),
  toBackupBlob: vi.fn(),
}));

vi.mock("@/lib/backup/exporter", () => mocks);

type PrepareOverrides = Partial<{
  bytes: number;
  danglingCount: number;
}>;

function preparedFor(
  options: BackupOptions,
  overrides: PrepareOverrides = {},
): PreparedBackup {
  return {
    envelope: {
      app: "requestr-backup",
      schemaVersion: 1,
      idbVersion: 1,
      exportedAt: "2026-03-04T10:00:00.000Z",
      appVersion: "1.0.0",
      includesSecrets: options.includeSecrets,
      sections: [],
    },
    data: {},
    estimate: {
      bytes: overrides.bytes ?? 2048,
      counts: { collections: 2, environments: 1, relayThreads: 4 },
    },
    danglingCount: overrides.danglingCount ?? 0,
  } as PreparedBackup;
}

function setup(overrides: PrepareOverrides = {}) {
  mocks.prepareBackup.mockImplementation(async (options: BackupOptions) =>
    preparedFor(options, overrides),
  );
}

const lastOptions = (): BackupOptions =>
  mocks.prepareBackup.mock.calls.at(-1)?.[0];

const ready = () =>
  waitFor(() => expect(screen.getByTestId("backup-download-btn")).toBeEnabled());

beforeEach(() => {
  mocks.collectBackupData.mockResolvedValue({
    collections: [
      { id: "c1", name: "Payments" },
      { id: "c2", name: "" },
    ],
    environments: [{ id: "e1", name: "Staging" }],
    chains: [],
  });
  mocks.toBackupBlob.mockReturnValue(new Blob(["{}"]));
  setup();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ExportBackupDialog", () => {
  it("renders nothing while closed", () => {
    render(<ExportBackupDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId("backup-export-dialog")).toBeNull();
  });

  it("starts in Everything mode with secrets off and the warning always visible", async () => {
    render(<ExportBackupDialog open onClose={vi.fn()} />);
    await ready();

    expect(screen.getByTestId("backup-mode-everything")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByText(
        "Conversations may contain values you shared with Relay.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("backup-secrets-toggle")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByTestId("backup-secrets-warning")).toHaveTextContent(
      "Anyone with this file can read your secrets.",
    );
    expect(screen.getByTestId("backup-secrets-warning")).not.toHaveTextContent(
      "Saved responses in history",
    );
    expect(lastOptions().includeSecrets).toBe(false);
  });

  it("turning secrets on keeps the warning, adds the responses note and exports secrets", async () => {
    render(<ExportBackupDialog open onClose={vi.fn()} />);
    await ready();

    fireEvent.click(screen.getByTestId("backup-secrets-toggle"));

    const warning = screen.getByTestId("backup-secrets-warning");
    expect(warning).toHaveTextContent("Anyone with this file");
    expect(warning).toHaveTextContent("Saved responses in history");
    await waitFor(() => expect(lastOptions().includeSecrets).toBe(true));
  });

  it("shows the estimated size", async () => {
    render(<ExportBackupDialog open onClose={vi.fn()} />);
    await ready();
    expect(screen.getByTestId("backup-estimated-size")).toHaveTextContent(
      "Estimated size: 2.0 KB",
    );
  });

  it("formats sub-kilobyte sizes in bytes", async () => {
    setup({ bytes: 512 });
    render(<ExportBackupDialog open onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId("backup-estimated-size")).toHaveTextContent(
        "512 B",
      ),
    );
  });

  it("reports dangling references only when there are some", async () => {
    setup({ danglingCount: 3 });
    render(<ExportBackupDialog open onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId("backup-dangling")).toHaveTextContent(
        "3 links point to items that are not in this backup.",
      ),
    );
  });

  it("hides the dangling note when there are none", async () => {
    render(<ExportBackupDialog open onClose={vi.fn()} />);
    await ready();
    expect(screen.queryByTestId("backup-dangling")).toBeNull();
  });

  it("warns about a large backup", async () => {
    setup({ bytes: BACKUP_SIZE_WARN_BYTES + 1 });
    render(<ExportBackupDialog open onClose={vi.fn()} />);
    expect(
      await screen.findByText("Large backup, restore may take a while."),
    ).toBeInTheDocument();
  });

  it("does not warn about size below the threshold", async () => {
    render(<ExportBackupDialog open onClose={vi.fn()} />);
    await ready();
    expect(screen.queryByText(/Large backup/)).toBeNull();
  });

  it("Choose mode lists sections with Relay threads unticked and the conversations note", async () => {
    render(<ExportBackupDialog open onClose={vi.fn()} />);
    await ready();

    fireEvent.click(screen.getByTestId("backup-mode-choose"));

    expect(screen.getByTestId("backup-mode-choose")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("backup-section-collections")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("backup-section-relayThreads")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(
      screen.getByText(
        "Conversations may contain values you shared with Relay.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("backup-count-relayThreads")).toBeNull();
  });

  it("Choose mode renders before the estimate arrives, without counts", async () => {
    mocks.prepareBackup.mockReturnValue(new Promise(() => {}));
    render(<ExportBackupDialog open onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId("backup-mode-choose"));

    expect(screen.getByTestId("backup-section-picker")).toBeInTheDocument();
    expect(screen.queryByTestId("backup-count-collections")).toBeNull();
    expect(screen.getByTestId("backup-download-btn")).toBeDisabled();
  });

  it("Choose mode exports only the ticked collection", async () => {
    render(<ExportBackupDialog open onClose={vi.fn()} />);
    await ready();
    fireEvent.click(screen.getByTestId("backup-mode-choose"));
    await screen.findByTestId("backup-item-collections-c1");

    await userEvent.click(screen.getByTestId("backup-item-collections-c2"));

    await waitFor(() =>
      expect(lastOptions().selection?.collectionIds).toEqual(["c1"]),
    );
    expect(lastOptions().sections).not.toContain("relayThreads");
  });

  it("lists an unnamed record by its id and filters items by search", async () => {
    render(<ExportBackupDialog open onClose={vi.fn()} />);
    await ready();
    fireEvent.click(screen.getByTestId("backup-mode-choose"));
    expect(await screen.findByText("c2")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("backup-item-search"), {
      target: { value: "pay" },
    });
    expect(screen.getByText("Payments")).toBeInTheDocument();
    expect(screen.queryByText("c2")).toBeNull();

    fireEvent.change(screen.getByTestId("backup-item-search"), {
      target: { value: "zzz" },
    });
    expect(
      screen.getAllByText("Nothing matches your search.").length,
    ).toBeGreaterThan(0);
  });

  it("disables download when every section is unticked", async () => {
    render(<ExportBackupDialog open onClose={vi.fn()} />);
    await ready();
    fireEvent.click(screen.getByTestId("backup-mode-choose"));

    for (const id of [
      "collections",
      "environments",
      "chains",
      "history",
      "settings",
    ]) {
      await userEvent.click(screen.getByTestId(`backup-section-${id}`));
    }

    await waitFor(() =>
      expect(screen.getByTestId("backup-download-btn")).toBeDisabled(),
    );
  });

  it("disables download when preparing the backup fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.prepareBackup.mockRejectedValue(new Error("idb down"));
    render(<ExportBackupDialog open onClose={vi.fn()} />);

    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.getByTestId("backup-download-btn")).toBeDisabled();
    error.mockRestore();
  });

  it("disables download when listing items fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.collectBackupData.mockRejectedValue(new Error("idb down"));
    render(<ExportBackupDialog open onClose={vi.fn()} />);

    await waitFor(() => expect(error).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId("backup-download-btn")).toBeDisabled(),
    );
    error.mockRestore();
  });

  it("downloads a file named after the export date", async () => {
    const created = vi.fn(() => "blob:fake");
    const revoked = vi.fn();
    URL.createObjectURL = created;
    URL.revokeObjectURL = revoked;
    const names: string[] = [];
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        names.push(this.download);
      });
    render(<ExportBackupDialog open onClose={vi.fn()} />);
    await ready();

    fireEvent.click(screen.getByTestId("backup-download-btn"));

    expect(names).toEqual(["requestr-backup-2026-03-04.json"]);
    expect(created).toHaveBeenCalledTimes(1);
    expect(revoked).toHaveBeenCalledWith("blob:fake");
    click.mockRestore();
  });

  it("calls onClose from Cancel", async () => {
    const onClose = vi.fn();
    render(<ExportBackupDialog open onClose={onClose} />);
    await ready();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when dismissed with Escape", async () => {
    const onClose = vi.fn();
    render(<ExportBackupDialog open onClose={onClose} />);
    await ready();

    fireEvent.keyDown(screen.getByTestId("backup-export-dialog"), {
      key: "Escape",
    });

    expect(onClose).toHaveBeenCalled();
  });
});
