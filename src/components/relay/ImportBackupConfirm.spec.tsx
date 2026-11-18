/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfirmPreview } from "@/lib/relay/tools/registry";
import { ImportBackupConfirm } from "./ImportBackupConfirm";

const mocks = vi.hoisted(() => ({ stage: vi.fn(), unstage: vi.fn() }));

vi.mock("@/lib/relay/tools/backupTools", () => ({
  stageImportFile: mocks.stage,
  unstageImportFile: mocks.unstage,
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values && "count" in values ? `${key}:${String(values.count)}` : key,
}));

const preview: ConfirmPreview = {
  action: "change",
  severity: "caution",
  targets: [],
  count: 0,
  stepLabel: { key: "activity.tools.import_backup", params: {} },
};

const CALL_ID = "call-1";

function backupText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    app: "requestr-backup",
    schemaVersion: 1,
    idbVersion: 1,
    exportedAt: "2026-03-04T10:00:00.000Z",
    appVersion: "1.0.0",
    includesSecrets: false,
    sections: ["collections"],
    data: { collections: [{ id: "c1" }, { id: "c2" }], folders: [], requests: [], chainConfigs: [] },
    ...overrides,
  });
}

function renderCard() {
  const onApprove = vi.fn();
  const onDecline = vi.fn();
  render(
    <ImportBackupConfirm
      preview={preview}
      toolCallId={CALL_ID}
      onApprove={onApprove}
      onDecline={onDecline}
    />,
  );
  return { onApprove, onDecline };
}

function pick(text: string, name = "backup.json") {
  const file = new File([text], name, { type: "application/json" });
  fireEvent.change(screen.getByTestId("relay-import-backup-input"), {
    target: { files: [file] },
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ImportBackupConfirm", () => {
  it("holds Approve back and shows no preview until a file is chosen", () => {
    renderCard();
    expect(screen.getByTestId("relay-confirm-approve")).toBeDisabled();
    expect(screen.queryByTestId("backup-preview")).toBeNull();
    expect(screen.queryByTestId("relay-import-backup-error")).toBeNull();
    expect(screen.getByTestId("relay-import-backup-choose")).toHaveTextContent(
      "backup.import.chooseFile",
    );
  });

  it("opens the file picker from Choose file", () => {
    renderCard();
    const input = screen.getByTestId("relay-import-backup-input") as HTMLInputElement;
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByTestId("relay-import-backup-choose"));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("previews a valid file, stages it, offers Merge only and enables Approve", async () => {
    const { onApprove } = renderCard();
    pick(backupText(), "mine.json");
    expect(await screen.findByTestId("backup-preview")).toBeInTheDocument();
    expect(screen.getByText("mine.json")).toBeInTheDocument();
    expect(screen.getByTestId("backup-preview-collections")).toHaveTextContent("2");
    expect(screen.getByTestId("relay-import-backup-merge")).toHaveTextContent("backup.import.merge");
    expect(screen.queryByText("backup.import.replace")).toBeNull();
    expect(mocks.stage).toHaveBeenCalledWith(
      CALL_ID,
      expect.objectContaining({ app: "requestr-backup", sections: ["collections"] }),
    );
    const approve = screen.getByTestId("relay-confirm-approve");
    expect(approve).toBeEnabled();
    fireEvent.click(approve);
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("shows the reason for an invalid file, unstages it and keeps Approve disabled", async () => {
    renderCard();
    pick("not json{");
    expect(await screen.findByTestId("relay-import-backup-error")).toHaveTextContent(
      "backup.errors.invalidJson",
    );
    expect(mocks.unstage).toHaveBeenCalledWith(CALL_ID);
    expect(mocks.stage).not.toHaveBeenCalled();
    expect(screen.queryByTestId("backup-preview")).toBeNull();
    expect(screen.getByTestId("relay-confirm-approve")).toBeDisabled();
  });

  it("names the damaged section in a section error", async () => {
    renderCard();
    pick(backupText({ data: { collections: "oops" } }));
    expect(await screen.findByTestId("relay-import-backup-error")).toBeInTheDocument();
    expect(mocks.stage).not.toHaveBeenCalled();
  });

  it("does nothing when the picker is dismissed with no file", () => {
    renderCard();
    fireEvent.change(screen.getByTestId("relay-import-backup-input"), { target: { files: [] } });
    expect(mocks.stage).not.toHaveBeenCalled();
    expect(mocks.unstage).not.toHaveBeenCalled();
    expect(screen.getByTestId("relay-confirm-approve")).toBeDisabled();
  });

  it("unstages the file and reports when declined", async () => {
    const { onDecline, onApprove } = renderCard();
    pick(backupText());
    await screen.findByTestId("backup-preview");
    fireEvent.click(screen.getByTestId("relay-confirm-decline"));
    expect(mocks.unstage).toHaveBeenCalledWith(CALL_ID);
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onApprove).not.toHaveBeenCalled();
  });
});
