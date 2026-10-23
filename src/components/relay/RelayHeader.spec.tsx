/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as platform from "@/lib/platform";
import { RELAY_WORKSPACE_ID } from "@/lib/relay/constants";
import {
  clearAll,
  createThread,
  flushThreadWrites,
  type RelayThread,
  renameThread,
} from "@/lib/relay/threadDb";
import { useRelayStore } from "@/stores/useRelayStore";
import { RelayHeader } from "./RelayHeader";

// No browser storage in these tests: threads live in the in-memory fallback.
vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("sonner", () => ({ toast: vi.fn() }));

const onClose = vi.fn();

beforeEach(() => {
  localStorage.clear();
  onClose.mockReset();
  useRelayStore.setState({
    activeThreadId: null,
    prunedNotice: false,
    capabilitiesOpen: false,
    permissionPopoverOpen: false,
  });
});

afterEach(async () => {
  cleanup();
  await flushThreadWrites();
  await clearAll(RELAY_WORKSPACE_ID);
  vi.restoreAllMocks();
});

describe("RelayHeader tooltips", () => {
  async function hover(testId: string) {
    await userEvent.hover(screen.getByTestId(testId));
    return waitFor(
      () => {
        const content = document.querySelector<HTMLElement>(
          '[data-slot="tooltip-content"]',
        );
        expect(content).not.toBeNull();
        return content as HTMLElement;
      },
      { timeout: 2000 },
    );
  }

  it("keeps an aria-label on the icon buttons", () => {
    render(<RelayHeader onClose={onClose} />);

    expect(screen.getByTestId("relay-new-thread")).toHaveAttribute(
      "aria-label",
      "threads.new",
    );
    expect(screen.getByTestId("relay-close")).toHaveAttribute(
      "aria-label",
      "close",
    );
    expect(screen.getByTestId("relay-header-capabilities")).toHaveAttribute(
      "aria-label",
      "header.capabilities",
    );
  });

  it.each([
    ["relay-thread-trigger", "threads.listLabel", []],
    ["relay-header-capabilities", "header.capabilities", []],
    ["relay-new-thread", "header.newChatShortcut", ["Ctrl", "Shift", "O"]],
    ["relay-close", "close", ["Ctrl", "Shift", "L"]],
  ])("shows a tooltip for %s with its keycaps", async (testId, label, caps) => {
    vi.spyOn(platform, "isMac").mockReturnValue(false);
    render(<RelayHeader onClose={onClose} />);

    const tooltip = await hover(testId);

    expect(tooltip).toHaveTextContent(label);
    expect(
      Array.from(tooltip.querySelectorAll("kbd")).map((k) => k.textContent),
    ).toEqual(caps);
  });

  it("renders Mac keycaps on Mac", async () => {
    vi.spyOn(platform, "isMac").mockReturnValue(true);
    render(<RelayHeader onClose={onClose} />);

    const tooltip = await hover("relay-new-thread");

    expect(
      Array.from(tooltip.querySelectorAll("kbd")).map((k) => k.textContent),
    ).toEqual(["⌘", "Shift", "O"]);
  });
});

describe("RelayHeader", () => {
  it("shows the product title as a heading when no thread is active", () => {
    render(<RelayHeader onClose={onClose} />);

    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("title");
    expect(screen.getByTestId("relay-title")).toHaveTextContent("title");
  });

  it("leads with the logo when no thread is active", () => {
    render(<RelayHeader onClose={onClose} />);

    expect(screen.getByTestId("relay-logo")).toBeInTheDocument();
  });

  it("calls onClose from the close button", () => {
    render(<RelayHeader onClose={onClose} />);

    fireEvent.click(screen.getByTestId("relay-close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the active thread's title and follows a rename", async () => {
    await createThread({
      workspaceId: RELAY_WORKSPACE_ID,
      id: "t1",
      title: "Alpha",
    });
    useRelayStore.setState({ activeThreadId: "t1" });
    render(<RelayHeader onClose={onClose} />);

    await waitFor(() =>
      expect(screen.getByTestId("relay-title")).toHaveTextContent("Alpha"),
    );

    await renameThread("t1", "Beta");

    await waitFor(() =>
      expect(screen.getByTestId("relay-title")).toHaveTextContent("Beta"),
    );
  });

  it("falls back to the untitled label for a thread without a title", async () => {
    await createThread({ workspaceId: RELAY_WORKSPACE_ID, id: "t1" });
    useRelayStore.setState({ activeThreadId: "t1" });
    render(<RelayHeader onClose={onClose} />);

    await waitFor(() =>
      expect(screen.getByTestId("relay-title")).toHaveTextContent(
        "threads.untitled",
      ),
    );
  });

  it("logs and keeps the header usable when the title cannot be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const db = await import("@/lib/relay/threadDb");
    vi.spyOn(db, "getThread").mockRejectedValueOnce(new Error("corrupt"));
    useRelayStore.setState({ activeThreadId: "t1" });

    render(<RelayHeader onClose={onClose} />);

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        "[relay] reading the thread title failed",
        expect.objectContaining({ threadId: "t1" }),
      ),
    );
    expect(screen.getByTestId("relay-close")).toBeEnabled();
  });

  it("ignores a title read that resolves after the active thread changed", async () => {
    await createThread({
      workspaceId: RELAY_WORKSPACE_ID,
      id: "t1",
      title: "First Thread",
    });
    await createThread({
      workspaceId: RELAY_WORKSPACE_ID,
      id: "t2",
      title: "Second Thread",
    });

    const db = await import("@/lib/relay/threadDb");
    const realGetThread = db.getThread;
    let resolveStaleRead: (thread: RelayThread | null) => void = () => {};
    const staleRead = new Promise<RelayThread | null>((resolve) => {
      resolveStaleRead = resolve;
    });
    const getThreadSpy = vi
      .spyOn(db, "getThread")
      .mockImplementation((id: string) =>
        id === "t1" ? staleRead : realGetThread(id),
      );

    useRelayStore.setState({ activeThreadId: "t1" });
    render(<RelayHeader onClose={onClose} />);
    await waitFor(() => expect(getThreadSpy).toHaveBeenCalledWith("t1"));

    act(() => useRelayStore.setState({ activeThreadId: "t2" }));
    await waitFor(() =>
      expect(screen.getByTestId("relay-title")).toHaveTextContent(
        "Second Thread",
      ),
    );

    // The effect for t1 was cleaned up, so its late result must be dropped.
    await act(async () => {
      resolveStaleRead({
        id: "t1",
        title: "Stale Title",
        workspaceId: RELAY_WORKSPACE_ID,
        createdAt: 0,
        updatedAt: 0,
        messages: [],
        interruptedMessageId: null,
      });
      await staleRead;
    });

    expect(screen.getByTestId("relay-title")).toHaveTextContent("Second Thread");
  });

  describe("thread list", () => {
    it("opens and closes from the title, exposing the expanded state", async () => {
      render(<RelayHeader onClose={onClose} />);
      const trigger = screen.getByTestId("relay-thread-trigger");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByTestId("relay-threads")).toBeNull();

      fireEvent.click(trigger);

      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(await screen.findByTestId("relay-threads")).toBeInTheDocument();
      const overlay = screen.getByTestId("relay-thread-overlay");
      expect(overlay).toHaveAttribute("aria-label", "threads.listLabel");
      expect(overlay).toHaveClass("bg-popover", "shadow-lg");
      expect(overlay.closest("header")).toBeNull();

      fireEvent.click(trigger);

      await waitFor(() =>
        expect(screen.queryByTestId("relay-threads")).toBeNull(),
      );
    });

    it("closes on Escape and returns focus to the title", async () => {
      render(<RelayHeader onClose={onClose} />);
      const trigger = screen.getByTestId("relay-thread-trigger");
      fireEvent.click(trigger);
      const search = await screen.findByTestId("relay-thread-search");

      fireEvent.keyDown(search, { key: "Escape" });

      await waitFor(() =>
        expect(screen.queryByTestId("relay-threads")).toBeNull(),
      );
      expect(trigger).toHaveFocus();
    });

    it("ignores Escape while the list is closed", () => {
      render(<RelayHeader onClose={onClose} />);

      fireEvent.keyDown(screen.getByTestId("relay-thread-trigger"), {
        key: "Escape",
      });

      expect(screen.queryByTestId("relay-threads")).toBeNull();
    });

    it("closes after a thread is chosen and activates it", async () => {
      await createThread({
        workspaceId: RELAY_WORKSPACE_ID,
        id: "t1",
        title: "Alpha",
      });
      render(<RelayHeader onClose={onClose} />);
      fireEvent.click(screen.getByTestId("relay-thread-trigger"));

      fireEvent.click(await screen.findByTestId("relay-thread-select"));

      expect(useRelayStore.getState().activeThreadId).toBe("t1");
      await waitFor(() =>
        expect(screen.queryByTestId("relay-threads")).toBeNull(),
      );
    });
  });

  describe("new thread", () => {
    it("is labelled and starts a fresh thread, closing the list", async () => {
      render(<RelayHeader onClose={onClose} />);
      fireEvent.click(screen.getByTestId("relay-thread-trigger"));
      await screen.findByTestId("relay-threads");

      const button = screen.getByRole("button", { name: "threads.new" });
      fireEvent.click(button);

      await waitFor(() =>
        expect(useRelayStore.getState().activeThreadId).not.toBeNull(),
      );
      expect(screen.queryByTestId("relay-threads")).toBeNull();
    });

    it("logs and stays usable when the thread cannot be created", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      useRelayStore.setState({
        newThread: vi.fn().mockRejectedValue(new Error("quota")),
      });
      const original = useRelayStore.getInitialState().newThread;
      render(<RelayHeader onClose={onClose} />);

      fireEvent.click(screen.getByTestId("relay-new-thread"));

      await waitFor(() =>
        expect(error).toHaveBeenCalledWith(
          "[relay] starting a new thread failed",
          expect.any(Object),
        ),
      );
      useRelayStore.setState({ newThread: original });
    });
  });

  describe("pruned notice", () => {
    it("is hidden by default", () => {
      render(<RelayHeader onClose={onClose} />);

      expect(screen.queryByTestId("relay-pruned-notice")).toBeNull();
    });

    it("is announced politely, names the cap, and goes away once dismissed", () => {
      useRelayStore.setState({ prunedNotice: true });
      render(<RelayHeader onClose={onClose} />);

      const notice = screen.getByRole("status");
      expect(notice).toHaveAttribute("data-testid", "relay-pruned-notice");
      expect(notice).toHaveTextContent("threads.prunedNotice");

      fireEvent.click(
        screen.getByRole("button", { name: "threads.dismissNotice" }),
      );

      expect(screen.queryByTestId("relay-pruned-notice")).toBeNull();
      expect(useRelayStore.getState().prunedNotice).toBe(false);
    });
  });

  it("enlarges the header controls on touch layouts", () => {
    render(<RelayHeader onClose={onClose} touchTargets />);

    for (const id of ["relay-close", "relay-new-thread", "relay-thread-trigger"]) {
      expect(screen.getByTestId(id)).toHaveStyle({ minHeight: "44px" });
    }
  });

  describe("overlay focus management", () => {
    it("returns focus to trigger when overlay is closed via selection", async () => {
      await createThread({
        workspaceId: RELAY_WORKSPACE_ID,
        id: "t1",
        title: "Alpha",
      });
      render(<RelayHeader onClose={onClose} />);
      const trigger = screen.getByTestId("relay-thread-trigger");

      fireEvent.click(trigger);
      await screen.findByTestId("relay-threads");

      fireEvent.click(await screen.findByTestId("relay-thread-select"));

      await waitFor(() =>
        expect(screen.queryByTestId("relay-threads")).toBeNull(),
      );
      expect(trigger).toHaveFocus();
    });

    it("returns focus to trigger when overlay is closed via Escape", async () => {
      render(<RelayHeader onClose={onClose} />);
      const trigger = screen.getByTestId("relay-thread-trigger");

      fireEvent.click(trigger);
      const search = await screen.findByTestId("relay-thread-search");

      fireEvent.keyDown(search, { key: "Escape" });

      await waitFor(() =>
        expect(screen.queryByTestId("relay-threads")).toBeNull(),
      );
      expect(trigger).toHaveFocus();
    });

    it("closes overlay on outside click and returns focus", async () => {
      render(
        <div>
          <RelayHeader onClose={onClose} />
          <div data-testid="outside-element">Outside</div>
        </div>,
      );
      const trigger = screen.getByTestId("relay-thread-trigger");

      fireEvent.click(trigger);
      await screen.findByTestId("relay-threads");

      const outside = screen.getByTestId("outside-element");
      fireEvent.click(outside);

      await waitFor(() =>
        expect(screen.queryByTestId("relay-threads")).toBeNull(),
      );
      expect(trigger).toHaveFocus();
    });
  });

  describe("overlay positioning and styling", () => {
    it("renders the overlay with proper styling and positioning", async () => {
      render(<RelayHeader onClose={onClose} />);
      const trigger = screen.getByTestId("relay-thread-trigger");

      fireEvent.click(trigger);

      const overlay = await screen.findByTestId("relay-thread-overlay");
      expect(overlay).toHaveClass("bg-popover", "shadow-lg");
      expect(overlay).toHaveAttribute("aria-label", "threads.listLabel");
      // Verify overlay is not inside the header
      expect(overlay.closest("header")).toBeNull();
    });

    it("applies width constraints to the overlay", async () => {
      render(<RelayHeader onClose={onClose} />);

      fireEvent.click(screen.getByTestId("relay-thread-trigger"));

      const overlay = await screen.findByTestId("relay-thread-overlay");
      const styles = window.getComputedStyle(overlay);
      // Should have width class applied
      expect(overlay).toHaveClass("w-76");
    });
  });

  describe("header title and logo", () => {
    it("shows logo and title together when no thread is active", () => {
      render(<RelayHeader onClose={onClose} />);

      expect(screen.getByTestId("relay-logo")).toBeInTheDocument();
      expect(screen.getByTestId("relay-title")).toHaveTextContent("title");
    });

    it("hides logo and shows thread title when thread is active", async () => {
      await createThread({
        workspaceId: RELAY_WORKSPACE_ID,
        id: "t1",
        title: "My Thread",
      });
      useRelayStore.setState({ activeThreadId: "t1" });
      render(<RelayHeader onClose={onClose} />);

      await waitFor(() =>
        expect(screen.getByTestId("relay-title")).toHaveTextContent("My Thread"),
      );
      expect(screen.queryByTestId("relay-logo")).toBeNull();
    });

    it("hides active thread title when activeThreadId is cleared", async () => {
      await createThread({
        workspaceId: RELAY_WORKSPACE_ID,
        id: "t1",
        title: "My Thread",
      });
      useRelayStore.setState({ activeThreadId: "t1" });
      render(<RelayHeader onClose={onClose} />);

      await waitFor(() =>
        expect(screen.getByTestId("relay-title")).toHaveTextContent("My Thread"),
      );

      act(() => useRelayStore.setState({ activeThreadId: null }));

      await waitFor(() =>
        expect(screen.getByTestId("relay-title")).toHaveTextContent("title"),
      );
      expect(screen.getByTestId("relay-logo")).toBeInTheDocument();
    });
  });

  describe("header controls and callbacks", () => {
    it("calls onClose when close button is clicked", () => {
      render(<RelayHeader onClose={onClose} />);

      fireEvent.click(screen.getByTestId("relay-close"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose only once per click", () => {
      render(<RelayHeader onClose={onClose} />);
      const closeButton = screen.getByTestId("relay-close");

      fireEvent.click(closeButton);
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("closes the thread list when new thread is created", async () => {
      render(<RelayHeader onClose={onClose} />);
      fireEvent.click(screen.getByTestId("relay-thread-trigger"));
      await screen.findByTestId("relay-threads");

      fireEvent.click(screen.getByTestId("relay-new-thread"));

      await waitFor(() =>
        expect(screen.queryByTestId("relay-threads")).toBeNull(),
      );
    });
  });
});

describe("RelayHeader capabilities popover", () => {
  it("opens from the header button with the five categories", async () => {
    render(<RelayHeader onClose={onClose} />);

    await userEvent.click(screen.getByTestId("relay-header-capabilities"));

    expect(await screen.findByTestId("relay-capabilities-popover")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^relay-capability-category-/)).toHaveLength(5);
  });

  it("opens when the store asks for it, as the launcher does", async () => {
    render(<RelayHeader onClose={onClose} />);

    act(() => useRelayStore.getState().setCapabilitiesOpen(true));

    expect(await screen.findByTestId("relay-capabilities-popover")).toBeInTheDocument();
  });

  it("Esc closes it and returns focus to the header button", async () => {
    render(<RelayHeader onClose={onClose} />);
    const button = screen.getByTestId("relay-header-capabilities");
    await userEvent.click(button);
    await screen.findByTestId("relay-capabilities-popover");

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(useRelayStore.getState().capabilitiesOpen).toBe(false));
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("Change approval mode closes it and opens the approval popover", async () => {
    render(<RelayHeader onClose={onClose} />);
    await userEvent.click(screen.getByTestId("relay-header-capabilities"));

    await userEvent.click(await screen.findByTestId("relay-capability-change-mode"));

    expect(useRelayStore.getState().capabilitiesOpen).toBe(false);
    expect(useRelayStore.getState().permissionPopoverOpen).toBe(true);
  });

  it("choosing a starter that needs no target sends it and closes the popover", async () => {
    render(<RelayHeader onClose={onClose} />);
    await userEvent.click(screen.getByTestId("relay-header-capabilities"));

    await userEvent.click(
      (await screen.findAllByTestId("relay-capability-starter")).find(
        (el) => el.getAttribute("data-example") === "read-2",
      ) as HTMLElement,
    );

    expect(useRelayStore.getState().pendingPrompt).toBe("capabilities.read.examples.2");
    expect(useRelayStore.getState().capabilitiesOpen).toBe(false);
  });
});
