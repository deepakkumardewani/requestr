/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfirmPreview } from "@/lib/relay/tools/registry";
import type { RelayToolInput } from "@/lib/relay/tools/schemas";
import { ExportBackupConfirm } from "./ExportBackupConfirm";

const mocks = vi.hoisted(() => ({ prepareBackup: vi.fn() }));

vi.mock("@/lib/backup/exporter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/backup/exporter")>()),
  prepareBackup: mocks.prepareBackup,
}));
// Keys echo back with their values so the assertions read the contract, not the copy.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values && "count" in values ? `${key}:${String(values.count)}` : key,
}));

const preview: ConfirmPreview = {
  action: "change",
  severity: "caution",
  targets: [],
  count: 0,
  stepLabel: { key: "activity.tools.export_backup", params: {} },
};

type ExportInput = RelayToolInput<"export_backup">;

function renderCard(input: Partial<ExportInput> = {}) {
  const onApprove = vi.fn();
  const onDecline = vi.fn();
  const view = render(
    <ExportBackupConfirm
      preview={preview}
      input={{ sections: ["collections", "environments"], ...input } as ExportInput}
      onApprove={onApprove}
      onDecline={onDecline}
    />,
  );
  return { onApprove, onDecline, ...view };
}

const counts = { collections: 4, environments: 0 };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ExportBackupConfirm", () => {
  it("lists only the requested sections with their counts, in canonical order", async () => {
    mocks.prepareBackup.mockResolvedValue({ estimate: { counts } });
    renderCard({ sections: ["environments", "collections"] } as Partial<ExportInput>);
    expect(await screen.findByText("backup.export.count:4")).toBeInTheDocument();
    const rows = screen.getByTestId("relay-export-backup").querySelectorAll("li");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("backup.sections.collections");
    expect(rows[0]).toHaveTextContent("backup.export.count:4");
    expect(rows[1]).toHaveTextContent("backup.export.count:0");
    expect(screen.queryByTestId("relay-export-backup-chains")).toBeNull();
  });

  it("shows no counts until they are read, and counts a missing section as zero", async () => {
    mocks.prepareBackup.mockResolvedValue({ estimate: { counts: {} } });
    renderCard();
    expect(screen.getByTestId("relay-export-backup-collections")).not.toHaveTextContent(
      "backup.export.count",
    );
    expect(await screen.findAllByText("backup.export.count:0")).toHaveLength(2);
  });

  it("shows the secrets warning only when secrets are on", async () => {
    mocks.prepareBackup.mockResolvedValue({ estimate: { counts } });
    const { unmount } = renderCard({ includeSecrets: true });
    expect(screen.getByTestId("relay-export-backup-secrets")).toHaveTextContent(
      "backup.export.secretsWarning",
    );
    unmount();
    renderCard({ includeSecrets: false });
    expect(screen.queryByTestId("relay-export-backup-secrets")).toBeNull();
    await screen.findByText("backup.export.count:4");
  });

  it("asks the exporter for the same options the tool will use", async () => {
    mocks.prepareBackup.mockResolvedValue({ estimate: { counts } });
    renderCard({ includeSecrets: true, collectionIds: ["c1"] });
    await waitFor(() => expect(mocks.prepareBackup).toHaveBeenCalledTimes(1));
    expect(mocks.prepareBackup).toHaveBeenCalledWith({
      sections: ["collections", "environments"],
      includeSecrets: true,
      selection: { collectionIds: ["c1"] },
    });
  });

  it("does not re-read the counts when the parent re-renders with equal input", async () => {
    mocks.prepareBackup.mockResolvedValue({ estimate: { counts } });
    const { rerender, onApprove, onDecline } = renderCard();
    await screen.findByText("backup.export.count:4");
    rerender(
      <ExportBackupConfirm
        preview={preview}
        input={{ sections: ["collections", "environments"] } as ExportInput}
        onApprove={onApprove}
        onDecline={onDecline}
      />,
    );
    expect(mocks.prepareBackup).toHaveBeenCalledTimes(1);
  });

  it("ignores a count that arrives after the card unmounted", async () => {
    let resolve: (value: unknown) => void = () => {};
    mocks.prepareBackup.mockReturnValue(new Promise((r) => (resolve = r)));
    const { unmount } = renderCard();
    unmount();
    resolve({ estimate: { counts } });
    await Promise.resolve();
    expect(screen.queryByText("backup.export.count:4")).toBeNull();
  });

  it("keeps the card usable and logs when counting fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.prepareBackup.mockRejectedValue(new Error("idb down"));
    renderCard();
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(screen.getByTestId("relay-export-backup-collections")).not.toHaveTextContent(
      "backup.export.count",
    );
    expect(screen.getByTestId("relay-confirm-approve")).toBeEnabled();
    warn.mockRestore();
  });

  it("forwards approve and decline", async () => {
    mocks.prepareBackup.mockResolvedValue({ estimate: { counts } });
    const { onApprove, onDecline } = renderCard();
    fireEvent.click(screen.getByTestId("relay-confirm-approve"));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDecline).not.toHaveBeenCalled();
    await screen.findByText("backup.export.count:4");
  });

  it("forwards decline", async () => {
    mocks.prepareBackup.mockResolvedValue({ estimate: { counts } });
    const { onApprove, onDecline } = renderCard();
    fireEvent.click(screen.getByTestId("relay-confirm-decline"));
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onApprove).not.toHaveBeenCalled();
    await screen.findByText("backup.export.count:4");
  });
});
