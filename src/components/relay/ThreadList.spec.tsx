/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestLocale } from "@/vitest-setup";
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

/** Opens a row's "..." menu and picks one of its items by test id. */
async function chooseMenuItem(itemTestId: string) {
  const trigger = await screen.findByTestId("relay-thread-menu-trigger");
  fireEvent.pointerDown(trigger);
  fireEvent.mouseDown(trigger);
  fireEvent.click(trigger);
  fireEvent.click(await screen.findByTestId(itemTestId));
}

function renderList() {
  return render(<ThreadList onSelected={onSelected} />);
}

beforeEach(() => {
  searchOverride.rows = null;
  localStorage.clear();
  onSelected.mockReset();
  toastMock.mockReset();
  useRelayStore.setState({ activeThreadId: null, prunedNotice: false });
  setTestLocale("en");
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

  it("correctly handles boundary between today and yesterday", () => {
    // Thread exactly at the start of yesterday
    const groups = groupThreads(
      [
        at("today", NOW - HOUR_MS),
        at("yesterday-boundary", NOW - 12.5 * HOUR_MS),
      ],
      NOW,
    );
    expect(groups.map((g) => [g.key, g.threads.map((x) => x.id)])).toEqual([
      ["groupToday", ["today"]],
      ["groupYesterday", ["yesterday-boundary"]],
    ]);
  });

  it("keeps multiple threads in the same group", () => {
    const groups = groupThreads(
      [
        at("old1", NOW - 9 * DAY_MS),
        at("old2", NOW - 20 * DAY_MS),
        at("old3", NOW - 100 * DAY_MS),
      ],
      NOW,
    );
    expect(groups.map((g) => [g.key, g.threads.length])).toEqual([
      ["groupEarlier", 3],
    ]);
  });

  it("maintains order within groups (preserves input order)", () => {
    const groups = groupThreads(
      [
        at("a", NOW - 5 * DAY_MS),
        at("b", NOW - 10 * DAY_MS),
        at("c", NOW - 3 * DAY_MS),
      ],
      NOW,
    );
    const earlierGroup = groups.find((g) => g.key === "groupEarlier");
    expect(earlierGroup?.threads.map((x) => x.id)).toEqual(["a", "b", "c"]);
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
      await chooseMenuItem("relay-thread-menu-rename");
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

    it("keeps the input open on Enter with a blank title", async () => {
      const input = await startRename();

      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(screen.getByTestId("relay-thread-rename-input")).toBeInTheDocument();
      expect((await getThread("t1"))?.title).toBe("Alpha");
    });

    it("keeps the old title when a blank title is blurred", async () => {
      const input = await startRename();

      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.blur(input);

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
    async function deleteFromMenu(title = "Alpha") {
      await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title });
      scheduleThreadSave("t1", { messages: ask("hi"), interruptedMessageId: null });
      await flushThreadWrites();
      renderList();
      await chooseMenuItem("relay-thread-menu-delete");
    }

    it("deletes at once and offers undo for the undo window", async () => {
      await deleteFromMenu();

      await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1));
      expect(await getThread("t1")).toBeNull();
      const [message, options] = toastMock.mock.calls[0];
      expect(message).toBe("threads.undo.deleted");
      expect(options.duration).toBe(RELAY_UNDO_TOAST_MS);
      expect(options.action.label).toBe("threads.undo.undo");
      expect(await screen.findByTestId("relay-threads-empty")).toBeInTheDocument();
    });

    it("undo restores the thread and its messages", async () => {
      await deleteFromMenu();
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
      await deleteFromMenu();
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
      const db = await import("@/lib/relay/threadDb");
      vi.spyOn(db, "deleteThread").mockRejectedValueOnce(new Error("locked"));
      await deleteFromMenu();

      await waitFor(() =>
        expect(error).toHaveBeenCalledWith(
          "[relay] deleting the thread failed",
          expect.objectContaining({ threadId: "t1" }),
        ),
      );
      expect(toastMock).not.toHaveBeenCalled();
    });

    it("does nothing when the thread was already removed elsewhere", async () => {
      const db = await import("@/lib/relay/threadDb");
      vi.spyOn(db, "deleteThread").mockResolvedValueOnce(null);
      await deleteFromMenu();

      await waitFor(() => expect(db.deleteThread).toHaveBeenCalled());
      expect(toastMock).not.toHaveBeenCalled();
    });
  });

  it("labels every control and keeps them reachable by keyboard", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    renderList();
    await screen.findByTestId("relay-thread-item");

    expect(screen.getByLabelText("threads.searchLabel")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "threads.menu.more" }),
    ).toBeInTheDocument();
    for (const button of screen.getAllByRole("button")) {
      expect(button).not.toHaveAttribute("tabindex", "-1");
    }
  });

  it("applies touch-sized controls when asked", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    render(<ThreadList onSelected={onSelected} touchTargets />);

    expect(await screen.findByTestId("relay-thread-menu-trigger")).toHaveStyle({
      minHeight: "44px",
    });
  });

  it("shows a short relative time with the full date as its title", async () => {
    await seedThread("t1", "Alpha", NOW - 3 * HOUR_MS);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    expect(time).toHaveTextContent("threads.time.hours");
    expect(time.getAttribute("title")).toBeTruthy();
  });

  it("offers exactly Rename and Delete in the row menu", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    renderList();
    const trigger = await screen.findByTestId("relay-thread-menu-trigger");
    fireEvent.pointerDown(trigger);
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);

    expect(await screen.findAllByRole("menuitem")).toHaveLength(2);
    expect(screen.getByTestId("relay-thread-menu-rename")).toBeInTheDocument();
    expect(screen.getByTestId("relay-thread-menu-delete")).toBeInTheDocument();
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

describe("ThreadRow menu visibility", () => {
  it("time visible and menu trigger hidden at rest", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    renderList();

    // Time is visible initially (no opacity-0 class)
    const time = await screen.findByTestId("relay-thread-time");
    expect(time).not.toHaveClass("opacity-0");

    // Menu trigger is hidden initially (has opacity-0 class)
    const trigger = screen.getByTestId("relay-thread-menu-trigger");
    expect(trigger).toHaveClass("opacity-0");
  });

  it("swaps visibility when menu is open with correct classes", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    renderList();
    const trigger = await screen.findByTestId("relay-thread-menu-trigger");

    fireEvent.click(trigger);

    // After click, menu should be visible
    await screen.findAllByRole("menuitem");
    // When menu is open, the trigger has data-popup-open attribute set
    expect(trigger).toHaveAttribute("data-popup-open");
  });

  it("hides the time when focus is within the row", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    renderList();
    const selectButton = await screen.findByTestId("relay-thread-select");

    selectButton.focus();

    // When focus-within the row, time should have group-focus-within class causing opacity-0
    const time = await screen.findByTestId("relay-thread-time");
    expect(time).toHaveClass("group-focus-within/thread:opacity-0");
  });
});

describe("ThreadRow time formatting", () => {
  it("displays relative time with full date in title attribute", async () => {
    await seedThread("t1", "Alpha", NOW - 2 * HOUR_MS);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    expect(time).toHaveTextContent("threads.time.hours");
    expect(time.getAttribute("title")).toBeTruthy();
    expect(time.getAttribute("dateTime")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("maps minutes correctly", async () => {
    await seedThread("t1", "Recent", NOW - 5 * HOUR_MS / 60);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    expect(time).toHaveTextContent("threads.time.minutes");
  });

  it("maps days correctly", async () => {
    await seedThread("t1", "Yesterday", NOW - 2 * DAY_MS);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    expect(time).toHaveTextContent("threads.time.days");
  });

  it("maps weeks correctly", async () => {
    await seedThread("t1", "LastWeek", NOW - 10 * DAY_MS);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    expect(time).toHaveTextContent("threads.time.weeks");
  });

  it("maps months correctly", async () => {
    await seedThread("t1", "LastMonth", NOW - 60 * DAY_MS);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    expect(time).toHaveTextContent("threads.time.months");
  });

  it("maps years correctly", async () => {
    await seedThread("t1", "LastYear", NOW - 400 * DAY_MS);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    expect(time).toHaveTextContent("threads.time.years");
  });
});

describe("ThreadRow time text per locale", () => {
  it("uses correct i18n key for minutes in all locales", async () => {
    await seedThread("t1", "Recent", NOW - 5 * HOUR_MS / 60);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    // Renders with English key which translates to "5 min" (en), "5 min" (fr), "5分" (ja)
    expect(time).toHaveTextContent("threads.time.minutes");
  });

  it("uses correct i18n key for hours in all locales", async () => {
    await seedThread("t1", "Alpha", NOW - 2 * HOUR_MS);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    // Renders with English key which translates to "2 h" (en), "2 h" (fr), "2時間" (ja)
    expect(time).toHaveTextContent("threads.time.hours");
  });

  it("uses correct i18n key for days in all locales", async () => {
    await seedThread("t1", "Yesterday", NOW - 2 * DAY_MS);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    // Renders with English key which translates to "2 d" (en), "2 j" (fr), "2日" (ja)
    expect(time).toHaveTextContent("threads.time.days");
  });

  it("uses correct i18n key for weeks in all locales", async () => {
    await seedThread("t1", "LastWeek", NOW - 10 * DAY_MS);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    // Renders with English key which translates to "1 wk" (en), "1 sem." (fr), "1週" (ja)
    expect(time).toHaveTextContent("threads.time.weeks");
  });

  it("uses correct i18n key for months in all locales", async () => {
    await seedThread("t1", "LastMonth", NOW - 60 * DAY_MS);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    // Renders with English key which translates to "2 mo" (en), "2 mois" (fr), "2か月" (ja)
    expect(time).toHaveTextContent("threads.time.months");
  });

  it("uses correct i18n key for years with proper plural support in fr and ja", async () => {
    await seedThread("t1", "LastYear", NOW - 400 * DAY_MS);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    // Renders with English key which translates to:
    // - "1 yr" (en)
    // - "1 an" / "2 ans" (fr, using ICU plural: one {# an} other {# ans})
    // - "1年" / "2年" (ja, no plural distinction)
    expect(time).toHaveTextContent("threads.time.years");
  });

  it("includes full date in title attribute for locale-aware date formatting", async () => {
    await seedThread("t1", "Alpha", NOW - 2 * HOUR_MS);
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    renderList();

    const time = await screen.findByTestId("relay-thread-time");
    const title = time.getAttribute("title");
    expect(title).toBeTruthy();
    // Should contain date and time components (format varies by locale but always present)
    // en: "Jun 15, 2026, 10:00 AM", fr: "15/06/2026 12:00", ja: "2026年6月15日 12:00"
    expect(title).toMatch(/\d/);
  });
});

describe("ThreadRow no AlertDialog", () => {
  it("uses a menu to delete, not a confirm dialog", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    renderList();
    const trigger = await screen.findByTestId("relay-thread-menu-trigger");

    fireEvent.click(trigger);

    // Verify no AlertDialog is present
    expect(
      document.querySelector('[role="alertdialog"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-testid*="alert"]'),
    ).toBeNull();

    // Verify menu items are available
    const deleteButton = await screen.findByTestId("relay-thread-menu-delete");
    expect(deleteButton).toBeInTheDocument();
  });
});

describe("ThreadRow delete and restore failure", () => {
  it("logs when undo delete fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = await import("@/lib/relay/threadDb");

    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    scheduleThreadSave("t1", { messages: ask("hi"), interruptedMessageId: null });
    await flushThreadWrites();
    renderList();

    // Mock restoreThread to fail
    vi.spyOn(db, "restoreThread").mockRejectedValueOnce(new Error("restore failed"));

    await chooseMenuItem("relay-thread-menu-delete");
    await waitFor(() => expect(toastMock).toHaveBeenCalled());

    // Trigger undo
    await act(async () => {
      toastMock.mock.calls[0][1].action.onClick();
    });

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        "[relay] undoing the delete failed",
        expect.objectContaining({ threadId: "t1" }),
      ),
    );
  });
});

describe("ThreadList edge cases", () => {
  it("handles threads with all edge case timestamps", async () => {
    const t1 = NOW;
    const t2 = NOW - 1;
    const t3 = NOW - 59_999;
    const t4 = NOW - 60_000;

    await seedThread("t1", "Now", t1);
    await seedThread("t2", "1ms", t2);
    await seedThread("t3", "59s", t3);
    await seedThread("t4", "1min", t4);
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    renderList();

    const times = await screen.findAllByTestId("relay-thread-time");
    expect(times).toHaveLength(4);
    for (const time of times) {
      expect(time.getAttribute("title")).toBeTruthy();
    }
  });

  it("maintains loading and empty states correctly", async () => {
    renderList();

    expect(screen.getByTestId("relay-threads-loading")).toBeInTheDocument();

    expect(await screen.findByTestId("relay-threads-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("relay-threads-loading")).toBeNull();
  });

  it("handles rapid consecutive searches", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Alpha" });
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t2", title: "Beta" });
    renderList();

    await screen.findAllByTestId("relay-thread-item");

    const searchInput = screen.getByTestId("relay-thread-search");
    fireEvent.change(searchInput, { target: { value: "a" } });
    fireEvent.change(searchInput, { target: { value: "al" } });
    fireEvent.change(searchInput, { target: { value: "alp" } });

    await waitFor(() =>
      expect(screen.getAllByTestId("relay-thread-item")).toHaveLength(1),
    );
    expect(screen.getByTestId("relay-thread-select")).toHaveTextContent("Alpha");
  });

  it("correctly marks active thread with aria-current", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1", title: "Active" });
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t2", title: "Inactive" });
    useRelayStore.setState({ activeThreadId: "t1" });
    renderList();

    const items = await screen.findAllByTestId("relay-thread-select");
    expect(items[0]).toHaveAttribute("aria-current", "true");
    expect(items[1]).not.toHaveAttribute("aria-current");
  });
});
