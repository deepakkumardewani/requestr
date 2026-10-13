/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_UNDO_TOAST_MS,
  RELAY_VIRTUALIZE_THRESHOLD,
  RELAY_WORKSPACE_ID,
} from "@/lib/relay/constants";
import {
  clearAll,
  createThread,
  flushThreadWrites,
  getThread,
  listThreads,
  scheduleThreadSave,
} from "@/lib/relay/threadDb";
import { useRelayStore } from "@/stores/useRelayStore";
import { groupThreads, ThreadList } from "./ThreadList";

// No browser storage in these tests: threads live in the in-memory fallback.
vi.mock("@/lib/idb", () => ({ getDB: () => null }));

// happy-dom has no layout, so the real virtualizer would render no rows.
const WINDOW_SIZE = 12;
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    estimateSize,
    getItemKey,
  }: {
    count: number;
    estimateSize: (index: number) => number;
    getItemKey: (index: number) => string;
  }) => ({
    getVirtualItems: () =>
      Array.from({ length: Math.min(count, WINDOW_SIZE) }, (_, index) => ({
        index,
        key: getItemKey(index),
        start: index * estimateSize(index),
      })),
    getTotalSize: () => count * estimateSize(0),
    measureElement: () => undefined,
  }),
}));

// Storage prunes at the thread cap, so an over-threshold list is injected.
const searchOverride = vi.hoisted(() => ({ rows: null as unknown[] | null }));
vi.mock("@/lib/relay/threadDb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/relay/threadDb")>();
  return {
    ...actual,
    searchThreads: (...args: Parameters<typeof actual.searchThreads>) =>
      searchOverride.rows
        ? Promise.resolve(searchOverride.rows as never)
        : actual.searchThreads(...args),
  };
});

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: toastMock }));

const NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

function ask(text: string): UIMessage[] {
  return [{ id: `u-${text}`, role: "user", parts: [{ type: "text", text }] }];
}

async function seedThread(id: string, title: string, updatedAt: number) {
  vi.spyOn(Date, "now").mockReturnValue(updatedAt);
  await createThread({ workspaceId: RELAY_WORKSPACE_ID, id, title });
}

const onSelected = vi.fn();

function renderList() {
  return render(<ThreadList onSelected={onSelected} />);
}

beforeEach(() => {
  searchOverride.rows = null;
  localStorage.clear();
  onSelected.mockReset();
  toastMock.mockReset();
  useRelayStore.setState({ activeThreadId: null, prunedNotice: false });
});

afterEach(async () => {
  cleanup();
  await flushThreadWrites();
  await clearAll(RELAY_WORKSPACE_ID);
  vi.restoreAllMocks();
});

describe("groupThreads", () => {
  const at = (id: string, updatedAt: number) =>
    ({ id, updatedAt }) as Parameters<typeof groupThreads>[0][number];

  it("buckets by local calendar day and drops empty groups", () => {
    const groups = groupThreads(
      [
        at("a", NOW - HOUR_MS),
        at("b", NOW - DAY_MS),
        at("c", NOW - 5 * DAY_MS),
      ],
      NOW,
    );
    expect(groups.map((g) => [g.key, g.threads.map((x) => x.id)])).toEqual([
      ["groupToday", ["a"]],
      ["groupYesterday", ["b"]],
      ["groupEarlier", ["c"]],
    ]);
  });

  it("returns no groups for no threads", () => {
    expect(groupThreads([], NOW)).toEqual([]);
  });

  it("omits groups that are empty", () => {
    const groups = groupThreads([at("old", NOW - 9 * DAY_MS)], NOW);
    expect(groups.map((g) => g.key)).toEqual(["groupEarlier"]);
  });
});

describe("ThreadList", () => {
  it("shows a skeleton while loading, then the empty state", async () => {
    renderList();
    expect(screen.getByTestId("relay-threads-loading")).toBeInTheDocument();

    expect(await screen.findByTestId("relay-threads-empty")).toHaveTextContent(
      "threads.empty",
    );
    expect(screen.queryByTestId("relay-threads-loading")).toBeNull();
  });

  it("lists threads under their day groups, newest first", async () => {
    const today = Date.now();
    await seedThread("t-old", "Old one", today - 10 * DAY_MS);
    await seedThread("t-new", "New one", today);
    renderList();

    const items = await screen.findAllByTestId("relay-thread-item");
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("New one"),
      expect.stringContaining("Old one"),
    ]);
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(["threads.groupToday", "threads.groupEarlier"]);
  });

  it("falls back to a placeholder for an untitled thread", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t-blank" });
    renderList();

    expect(await screen.findByTestId("relay-thread-select")).toHaveTextContent(
      "threads.untitled",
    );
  });

  it("filters by search and explains an empty result", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t2", title: "Beta" });
    renderList();
    await screen.findAllByTestId("relay-thread-item");

    fireEvent.change(screen.getByTestId("relay-thread-search"), {
      target: { value: "alp" },
    });
    await waitFor(() =>
      expect(screen.getAllByTestId("relay-thread-item")).toHaveLength(1),
    );
    expect(screen.getByTestId("relay-thread-select")).toHaveTextContent("Alpha");

    fireEvent.change(screen.getByTestId("relay-thread-search"), {
      target: { value: "zzz" },
    });
    expect(await screen.findByTestId("relay-threads-empty")).toHaveTextContent(
      "threads.noResults",
    );
  });

  it("selecting a thread activates it and reports the choice", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    renderList();

    fireEvent.click(await screen.findByTestId("relay-thread-select"));

    expect(useRelayStore.getState().activeThreadId).toBe("t1");
    expect(onSelected).toHaveBeenCalledTimes(1);
  });

  it("marks the active thread", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    useRelayStore.setState({ activeThreadId: "t1" });
    renderList();

    expect(await screen.findByTestId("relay-thread-select")).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  describe("rename", () => {
    async function startRename() {
      await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
      renderList();
      fireEvent.click(await screen.findByTestId("relay-thread-rename"));
      return screen.getByTestId("relay-thread-rename-input");
    }

    it("commits on Enter", async () => {
      const input = await startRename();

      fireEvent.change(input, { target: { value: "  Gamma  " } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(async () => expect((await getThread("t1"))?.title).toBe("Gamma"));
      expect(await screen.findByTestId("relay-thread-select")).toHaveTextContent("Gamma");
    });

    it("cancels on Escape without saving", async () => {
      const input = await startRename();

      fireEvent.change(input, { target: { value: "Changed" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(screen.queryByTestId("relay-thread-rename-input")).toBeNull();
      expect((await getThread("t1"))?.title).toBe("Alpha");
    });

    it("commits on blur", async () => {
      const input = await startRename();

      fireEvent.change(input, { target: { value: "Blurred" } });
      fireEvent.blur(input);

      await waitFor(async () => expect((await getThread("t1"))?.title).toBe("Blurred"));
    });

    it("keeps the old title when the new one is blank", async () => {
      const input = await startRename();

      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() =>
        expect(screen.queryByTestId("relay-thread-rename-input")).toBeNull(),
      );
      expect((await getThread("t1"))?.title).toBe("Alpha");
    });

    it("logs and carries on when saving the name fails", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const input = await startRename();
      const db = await import("@/lib/relay/threadDb");
      vi.spyOn(db, "renameThread").mockRejectedValueOnce(new Error("quota"));

      fireEvent.change(input, { target: { value: "Gamma" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() =>
        expect(error).toHaveBeenCalledWith(
          "[relay] renaming the thread failed",
          expect.objectContaining({ threadId: "t1" }),
        ),
      );
    });
  });

  describe("delete", () => {
    async function openDeleteDialog(title = "Alpha") {
      await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title });
      scheduleThreadSave("t1", { messages: ask("hi"), interruptedMessageId: null });
      await flushThreadWrites();
      renderList();
      fireEvent.click(await screen.findByTestId("relay-thread-delete"));
      return screen.findByTestId("relay-thread-delete-dialog");
    }

    it("asks for confirmation naming the thread, and cancel keeps it", async () => {
      const dialog = await openDeleteDialog();
      expect(dialog).toHaveTextContent("threads.deleteTitle");

      fireEvent.click(within(dialog).getByText("threads.deleteCancel"));

      await waitFor(() =>
        expect(screen.queryByTestId("relay-thread-delete-dialog")).toBeNull(),
      );
      expect(await getThread("t1")).not.toBeNull();
      expect(toastMock).not.toHaveBeenCalled();
    });

    it("deletes on confirm and offers undo for the undo window", async () => {
      await openDeleteDialog();

      fireEvent.click(screen.getByTestId("relay-thread-delete-confirm"));

      await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1));
      expect(await getThread("t1")).toBeNull();
      const [message, options] = toastMock.mock.calls[0];
      expect(message).toBe("threads.deletedToast");
      expect(options.duration).toBe(RELAY_UNDO_TOAST_MS);
      expect(options.action.label).toBe("threads.undo");
      expect(await screen.findByTestId("relay-threads-empty")).toBeInTheDocument();
    });

    it("undo restores the thread and its messages", async () => {
      await openDeleteDialog();
      fireEvent.click(screen.getByTestId("relay-thread-delete-confirm"));
      await waitFor(() => expect(toastMock).toHaveBeenCalled());

      await act(async () => {
        toastMock.mock.calls[0][1].action.onClick();
      });

      await waitFor(async () =>
        expect((await getThread("t1"))?.messages).toHaveLength(1),
      );
      expect(await screen.findByTestId("relay-thread-select")).toHaveTextContent("Alpha");
      expect(useRelayStore.getState().activeThreadId).toBeNull();
    });

    it("clears the active thread when it is deleted and re-activates it on undo", async () => {
      useRelayStore.setState({ activeThreadId: "t1" });
      await openDeleteDialog();

      fireEvent.click(screen.getByTestId("relay-thread-delete-confirm"));
      await waitFor(() => expect(toastMock).toHaveBeenCalled());
      expect(useRelayStore.getState().activeThreadId).toBeNull();

      await act(async () => {
        toastMock.mock.calls[0][1].action.onClick();
      });

      await waitFor(() => expect(useRelayStore.getState().activeThreadId).toBe("t1"));
      expect(await listThreads(RELAY_WORKSPACE_ID)).toHaveLength(1);
    });

    it("logs and shows no undo when deleting fails", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      await openDeleteDialog();
      const db = await import("@/lib/relay/threadDb");
      vi.spyOn(db, "deleteThread").mockRejectedValueOnce(new Error("locked"));

      fireEvent.click(screen.getByTestId("relay-thread-delete-confirm"));

      await waitFor(() =>
        expect(error).toHaveBeenCalledWith(
          "[relay] deleting the thread failed",
          expect.objectContaining({ threadId: "t1" }),
        ),
      );
      expect(toastMock).not.toHaveBeenCalled();
    });

    it("does nothing when the thread was already removed elsewhere", async () => {
      await openDeleteDialog();
      const db = await import("@/lib/relay/threadDb");
      vi.spyOn(db, "deleteThread").mockResolvedValueOnce(null);

      fireEvent.click(screen.getByTestId("relay-thread-delete-confirm"));

      await waitFor(() =>
        expect(screen.queryByTestId("relay-thread-delete-dialog")).toBeNull(),
      );
      expect(toastMock).not.toHaveBeenCalled();
    });
  });

  it("labels every control and keeps them reachable by keyboard", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    renderList();
    await screen.findByTestId("relay-thread-item");

    expect(screen.getByLabelText("threads.searchLabel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "threads.rename" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "threads.delete" })).toBeInTheDocument();
    for (const button of screen.getAllByRole("button")) {
      expect(button).not.toHaveAttribute("tabindex", "-1");
    }
  });

  it("applies touch-sized controls when asked", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    render(<ThreadList onSelected={onSelected} touchTargets />);

    expect(await screen.findByTestId("relay-thread-delete")).toHaveStyle({
      minHeight: "44px",
    });
  });

  it("refreshes when threads change elsewhere", async () => {
    renderList();
    await screen.findByTestId("relay-threads-empty");

    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t9", title: "Late" });

    expect(await screen.findByTestId("relay-thread-select")).toHaveTextContent("Late");
  });

  it("shows the empty state and logs when listing fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = await import("@/lib/relay/threadDb");
    vi.spyOn(db, "searchThreads").mockRejectedValueOnce(new Error("boom"));

    renderList();

    expect(await screen.findByTestId("relay-threads-empty")).toBeInTheDocument();
    expect(error).toHaveBeenCalledWith(
      "[relay] listing threads failed",
      expect.any(Object),
    );
  });
});

describe("ThreadList virtualization", () => {
  const manyThreads = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `t-${index}`,
      workspaceId: RELAY_WORKSPACE_ID,
      title: `Thread ${index}`,
      updatedAt: NOW - index * 1000,
    }));

  it("renders every row of a short list without a virtual container", async () => {
    searchOverride.rows = manyThreads(RELAY_VIRTUALIZE_THRESHOLD);
    renderList();
    expect(await screen.findAllByTestId("relay-thread-item")).toHaveLength(
      RELAY_VIRTUALIZE_THRESHOLD,
    );
    expect(screen.queryByTestId("relay-threads-virtual")).toBeNull();
  });

  it("windows the rows once the list passes the threshold", async () => {
    searchOverride.rows = manyThreads(RELAY_VIRTUALIZE_THRESHOLD + 1);
    renderList();
    await screen.findByTestId("relay-threads-virtual");
    const rendered = screen.getAllByTestId("relay-thread-item");
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThanOrEqual(WINDOW_SIZE);
  });
});
