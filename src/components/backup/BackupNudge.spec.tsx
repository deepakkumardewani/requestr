/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import enCommon from "../../../messages/en/common.json";
import { usePromptStore } from "@/stores/usePromptStore";
import { BackupNudge } from "./BackupNudge";

const mocks = vi.hoisted(() => ({
  gateOpen: true,
  tracking: true,
  eligible: true,
  track: vi.fn(),
  shouldShow: vi.fn(),
  markShown: vi.fn(),
  snooze: vi.fn(),
}));

// The global next-intl stub only knows top-level namespaces; resolve the nested one from the real catalog.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    (enCommon.backupNudge as Record<string, string>)[key] ?? key,
}));
vi.mock("@/lib/prompts/useAutoPromptGate", () => ({
  useAutoPromptGate: () => mocks.gateOpen,
}));
vi.mock("@/lib/analytics/adapter", () => ({
  isTrackingActive: () => mocks.tracking,
  track: mocks.track,
}));
vi.mock("@/lib/backup/backupNudgeState", () => ({
  shouldShowBackupNudge: () => mocks.shouldShow(),
  markBackupNudgeShown: () => mocks.markShown(),
  snoozeBackupNudge: () => mocks.snooze(),
}));
vi.mock("@/components/settings/backup/ExportBackupDialog", () => ({
  ExportBackupDialog: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog" data-testid="export-dialog">
      <button type="button" data-testid="export-close" onClick={onClose} />
    </div>
  ),
}));

const active = () => usePromptStore.getState().active;

async function mount() {
  const view = render(<BackupNudge />);
  await act(async () => {});
  return view;
}

beforeEach(() => {
  mocks.gateOpen = true;
  mocks.tracking = true;
  mocks.eligible = true;
  mocks.track.mockClear();
  mocks.markShown.mockClear();
  mocks.snooze.mockClear();
  mocks.shouldShow.mockReset();
  mocks.shouldShow.mockImplementation(async () => mocks.eligible);
});

afterEach(() => {
  cleanup();
  usePromptStore.setState({ active: null, current: null, queue: [] });
});

describe("BackupNudge visibility", () => {
  it("shows the reminder when eligible and the gate is open", async () => {
    await mount();
    expect(screen.getByTestId("backup-nudge")).toBeTruthy();
    expect(screen.getByText(enCommon.backupNudge.title)).toBeTruthy();
    expect(active()).toBe("backup-nudge");
    expect(mocks.markShown).toHaveBeenCalledTimes(1);
    expect(mocks.track).toHaveBeenCalledWith("backup_nudge_shown", {});
  });

  it("stays hidden when not eligible", async () => {
    mocks.eligible = false;
    await mount();
    expect(screen.queryByTestId("backup-nudge")).toBeNull();
    expect(active()).toBeNull();
    expect(mocks.markShown).not.toHaveBeenCalled();
  });

  it("does not even check eligibility while the gate is closed", async () => {
    mocks.gateOpen = false;
    await mount();
    expect(mocks.shouldShow).not.toHaveBeenCalled();
    expect(screen.queryByTestId("backup-nudge")).toBeNull();
  });

  it("stays hidden while another prompt holds the slot", async () => {
    usePromptStore.getState().request("feedback", { auto: true });
    await act(async () => {});
    await mount();
    expect(screen.queryByTestId("backup-nudge")).toBeNull();
    expect(active()).toBe("feedback");
  });

  it("withdraws an unanswered request when the gate closes", async () => {
    usePromptStore.getState().request("feedback", { auto: true });
    await act(async () => {});
    const view = await mount();
    expect(usePromptStore.getState().queue.map((e) => e.id)).toContain(
      "backup-nudge",
    );
    mocks.gateOpen = false;
    view.rerender(<BackupNudge />);
    await act(async () => {});
    expect(usePromptStore.getState().queue.map((e) => e.id)).not.toContain(
      "backup-nudge",
    );
  });

  it("keeps a granted nudge visible when the gate closes", async () => {
    const view = await mount();
    mocks.gateOpen = false;
    view.rerender(<BackupNudge />);
    await act(async () => {});
    expect(screen.getByTestId("backup-nudge")).toBeTruthy();
    expect(active()).toBe("backup-nudge");
  });

  it("ignores an eligibility answer that arrives after unmount", async () => {
    let resolve: (value: boolean) => void = () => {};
    mocks.shouldShow.mockImplementation(
      () => new Promise<boolean>((r) => (resolve = r)),
    );
    const view = render(<BackupNudge />);
    view.unmount();
    await act(async () => resolve(true));
    expect(active()).toBeNull();
  });

  it("releases the slot when unmounted while shown", async () => {
    const view = await mount();
    view.unmount();
    expect(active()).toBeNull();
  });
});

describe("BackupNudge actions", () => {
  it("the action opens the export dialog and releases the slot", async () => {
    await mount();
    expect(screen.queryByTestId("export-dialog")).toBeNull();
    fireEvent.click(screen.getByTestId("backup-nudge-action"));
    expect(screen.getByTestId("export-dialog")).toBeTruthy();
    expect(screen.queryByTestId("backup-nudge")).toBeNull();
    expect(active()).toBeNull();
    expect(mocks.track).toHaveBeenCalledWith("backup_nudge_accepted", {});
    expect(mocks.snooze).not.toHaveBeenCalled();
  });

  it("closing the export dialog removes it", async () => {
    await mount();
    fireEvent.click(screen.getByTestId("backup-nudge-action"));
    fireEvent.click(screen.getByTestId("export-close"));
    expect(screen.queryByTestId("export-dialog")).toBeNull();
  });

  it("dismiss snoozes, hides the nudge and frees the slot", async () => {
    await mount();
    fireEvent.click(screen.getByTestId("backup-nudge-dismiss"));
    expect(mocks.snooze).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("backup-nudge")).toBeNull();
    expect(active()).toBeNull();
    expect(mocks.track).toHaveBeenCalledWith("backup_nudge_dismissed", {});
  });

  it("sends no analytics when tracking is inactive", async () => {
    mocks.tracking = false;
    await mount();
    fireEvent.click(screen.getByTestId("backup-nudge-dismiss"));
    expect(mocks.track).not.toHaveBeenCalled();
  });
});
