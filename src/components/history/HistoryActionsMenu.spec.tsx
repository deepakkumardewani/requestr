/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import type { HistoryEntry, HttpTab } from "@/types";
import { HistoryActionsMenu } from "./HistoryActionsMenu";

const { exportHistory, downloadFile } = vi.hoisted(() => ({
  exportHistory: vi.fn(),
  downloadFile: vi.fn(),
}));

vi.mock("@/lib/history/exportHistory", () => ({ exportHistory }));
vi.mock("@/lib/historyExport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/historyExport")>()),
  downloadFile,
}));

function makeEntry(id: string): HistoryEntry {
  const tab: HttpTab = {
    tabId: "t0",
    requestId: null,
    name: "r",
    isDirty: false,
    type: "http",
    url: "https://api.example.com",
    method: "GET",
    headers: [],
    params: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
  };
  return {
    id,
    method: "GET",
    url: tab.url,
    status: 200,
    duration: 1,
    size: 1,
    timestamp: 1,
    request: tab,
    response: {
      status: 200,
      statusText: "OK",
      headers: {},
      body: "",
      duration: 1,
      size: 1,
      url: tab.url,
      method: "GET",
      timestamp: 1,
    },
  };
}

beforeEach(() => {
  exportHistory.mockReset();
  exportHistory.mockReturnValue({ count: 0, excludedCount: 0 });
  downloadFile.mockReset();
  useHistoryStore.setState({ entries: [makeEntry("1"), makeEntry("2")] });
});

afterEach(() => {
  cleanup();
  useHistoryStore.setState({ entries: [] });
});

async function openExportSubmenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("history-actions-btn"));
  const trigger = await screen.findByTestId("history-export-trigger");
  trigger.focus();
  await user.keyboard("{ArrowRight}");
}

async function activate(
  user: ReturnType<typeof userEvent.setup>,
  testId: string
) {
  const item = await screen.findByTestId(testId);
  item.focus();
  await user.keyboard("{Enter}");
}

describe("HistoryActionsMenu", () => {
  it("has an accessible trigger and hides the excluded note initially", () => {
    render(<HistoryActionsMenu />);
    expect(
      screen.getByRole("button", { name: "History actions" })
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("history-excluded-note")
    ).not.toBeInTheDocument();
  });

  it("lists Export and a destructive Clear all item", async () => {
    const user = userEvent.setup();
    render(<HistoryActionsMenu />);
    await user.click(screen.getByTestId("history-actions-btn"));

    expect(
      await screen.findByTestId("history-export-trigger")
    ).toHaveTextContent("Export history");
    const clear = screen.getByTestId("history-clear-all");
    expect(clear).toHaveTextContent("Clear all history");
    expect(clear).toHaveAttribute("data-variant", "destructive");
  });

  it("lists JSON, HAR and CSV with the not-redacted warning", async () => {
    const user = userEvent.setup();
    render(<HistoryActionsMenu />);
    await openExportSubmenu(user);

    expect(await screen.findByTestId("history-export-json")).toHaveTextContent(
      "JSON"
    );
    expect(screen.getByTestId("history-export-har")).toHaveTextContent("HAR");
    expect(screen.getByTestId("history-export-csv")).toHaveTextContent("CSV");
    expect(screen.getByTestId("history-export-note")).toHaveTextContent(
      "Exports are not redacted"
    );
    const separator = screen.getByTestId("history-export-separator");
    expect(
      separator.compareDocumentPosition(
        screen.getByTestId("history-export-note")
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("uses a trigger button of at least 28x28", () => {
    render(<HistoryActionsMenu />);
    expect(screen.getByTestId("history-actions-btn").className).toMatch(
      /\bsize-8\b/
    );
  });

  it("exports JSON and HAR through exportHistory", async () => {
    const user = userEvent.setup();
    render(<HistoryActionsMenu />);

    await openExportSubmenu(user);
    await activate(user, "history-export-json");
    expect(exportHistory).toHaveBeenLastCalledWith("json");

    await openExportSubmenu(user);
    await activate(user, "history-export-har");
    expect(exportHistory).toHaveBeenLastCalledWith("har");
    expect(exportHistory).toHaveBeenCalledTimes(2);
  });

  it("exports CSV as a .csv download of the full history", async () => {
    const user = userEvent.setup();
    render(<HistoryActionsMenu />);
    await openExportSubmenu(user);
    await activate(user, "history-export-csv");

    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [content, filename, mime] = downloadFile.mock.calls[0];
    expect(content).toContain("https://api.example.com");
    expect(filename).toMatch(/\.csv$/);
    expect(mime).toBe("text/csv;charset=utf-8");
  });

  it("shows the exact excluded count after an export that skipped entries", async () => {
    exportHistory.mockReturnValue({ count: 1, excludedCount: 3 });
    const user = userEvent.setup();
    render(<HistoryActionsMenu />);
    await openExportSubmenu(user);
    await activate(user, "history-export-har");

    expect(
      await screen.findByTestId("history-excluded-note")
    ).toHaveTextContent("3 WebSocket/Socket.IO entries were not included");
  });

  it("hides the excluded note when a later export excludes nothing, and after CSV", async () => {
    exportHistory.mockReturnValueOnce({ count: 1, excludedCount: 2 });
    const user = userEvent.setup();
    render(<HistoryActionsMenu />);

    await openExportSubmenu(user);
    await activate(user, "history-export-har");
    expect(
      await screen.findByTestId("history-excluded-note")
    ).toBeInTheDocument();

    await openExportSubmenu(user);
    await activate(user, "history-export-json");
    expect(
      screen.queryByTestId("history-excluded-note")
    ).not.toBeInTheDocument();

    exportHistory.mockReturnValueOnce({ count: 1, excludedCount: 2 });
    await openExportSubmenu(user);
    await activate(user, "history-export-har");
    expect(
      await screen.findByTestId("history-excluded-note")
    ).toBeInTheDocument();

    await openExportSubmenu(user);
    await activate(user, "history-export-csv");
    expect(
      screen.queryByTestId("history-excluded-note")
    ).not.toBeInTheDocument();
  });

  it("Clear all opens the dialog with the entry count and Cancel keeps entries", async () => {
    const user = userEvent.setup();
    render(<HistoryActionsMenu />);
    await user.click(screen.getByTestId("history-actions-btn"));
    await user.click(await screen.findByTestId("history-clear-all"));

    expect(await screen.findByTestId("clear-history-body")).toHaveTextContent(
      "2 history entries"
    );
    await user.click(screen.getByTestId("clear-history-cancel"));
    expect(useHistoryStore.getState().entries).toHaveLength(2);
  });

  it("confirming clears the history and closes the dialog", async () => {
    const user = userEvent.setup();
    render(<HistoryActionsMenu />);
    await user.click(screen.getByTestId("history-actions-btn"));
    await user.click(await screen.findByTestId("history-clear-all"));
    await user.click(await screen.findByTestId("clear-history-confirm"));

    expect(useHistoryStore.getState().entries).toHaveLength(0);
    expect(
      screen.queryByTestId("clear-history-dialog")
    ).not.toBeInTheDocument();
  });

  it("opens by keyboard and activates Clear all with Enter", async () => {
    const user = userEvent.setup();
    render(<HistoryActionsMenu />);
    screen.getByTestId("history-actions-btn").focus();
    await user.keyboard("{Enter}");
    const clear = await screen.findByTestId("history-clear-all");
    clear.focus();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByTestId("clear-history-dialog")
    ).toBeInTheDocument();
  });
});
