/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type { TabState } from "@/types";
import { Tab } from "./Tab";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

function makeTab(overrides: Record<string, unknown> = {}): TabState {
  return {
    tabId: "tab-1",
    type: "http",
    name: "Get Users",
    isDirty: false,
    ...overrides,
  } as unknown as TabState;
}

function renderTab(tab: TabState, onClose?: (e: React.MouseEvent) => void) {
  const onSelect = vi.fn();
  // Mirrors TabBar: the owner's close handler is responsible for stopping propagation
  const close =
    onClose ??
    vi.fn((e: React.MouseEvent) => {
      e.stopPropagation();
    });
  render(<Tab tab={tab} isActive={false} onSelect={onSelect} onClose={close} />);
  return { onSelect, onClose: close };
}

function setConnected(tabId: string, isConnected: boolean) {
  useConnectionStore.setState({
    connections: {
      [tabId]: { isConnected, isConnecting: false, error: null },
    },
  });
}

beforeEach(() => {
  useConnectionStore.setState({ connections: {} });
});

afterEach(() => {
  cleanup();
  useConnectionStore.setState({ connections: {} });
  vi.clearAllMocks();
});

describe("Tab", () => {
  describe("content", () => {
    it("shows the tab name", () => {
      renderTab(makeTab({ name: "Get Users" }));
      expect(screen.getByTestId("tab")).toHaveTextContent("Get Users");
    });

    it("falls back to the default name when the tab has no name", () => {
      renderTab(makeTab({ name: "" }));
      expect(screen.getByTestId("tab")).toHaveTextContent("New Request");
    });

    it.each([
      ["http", "lucide-globe"],
      ["graphql", "lucide-braces"],
      ["websocket", "lucide-arrow-left-right"],
      ["socketio", "lucide-zap"],
    ])("renders the %s icon for a %s tab and no other type icon", (type, expected) => {
      renderTab(makeTab({ type }));
      const icons = screen
        .getByTestId("tab")
        .querySelectorAll("svg.lucide");
      const names = Array.from(icons).map((i) =>
        Array.from(i.classList).find((c) => c.startsWith("lucide-")),
      );
      // first svg is the type icon, the second is the close X
      expect(names[0]).toBe(expected);
      expect(names).toHaveLength(2);
    });
  });

  describe("indicators", () => {
    it("shows the dirty indicator only when the tab has unsaved changes", () => {
      renderTab(makeTab({ isDirty: true }));
      expect(screen.getByTestId("tab-dirty-indicator")).toBeInTheDocument();
    });

    it("hides the dirty indicator for a clean tab", () => {
      renderTab(makeTab({ isDirty: false }));
      expect(screen.queryByTestId("tab-dirty-indicator")).toBeNull();
    });

    it("shows a color dot with the tab color and group title when labelled", () => {
      renderTab(makeTab({ color: "#3b82f6", group: "Auth" }));
      const dot = screen.getByTestId("tab-color-dot");
      expect(dot).toHaveStyle({ backgroundColor: "#3b82f6" });
      expect(dot).toHaveAttribute("title", "Group: Auth");
    });

    it("hides the color dot when the tab has no color", () => {
      renderTab(makeTab());
      expect(screen.queryByTestId("tab-color-dot")).toBeNull();
    });

    it.each(["websocket", "socketio"])(
      "shows the connection dot for a connected %s tab",
      (type) => {
        setConnected("tab-1", true);
        renderTab(makeTab({ type }));
        expect(screen.getByTestId("tab-connection-dot")).toBeInTheDocument();
      },
    );

    it.each(["websocket", "socketio"])(
      "hides the connection dot for a disconnected %s tab",
      (type) => {
        setConnected("tab-1", false);
        renderTab(makeTab({ type }));
        expect(screen.queryByTestId("tab-connection-dot")).toBeNull();
      },
    );

    it("hides the connection dot for a websocket tab with no connection record", () => {
      renderTab(makeTab({ type: "websocket" }));
      expect(screen.queryByTestId("tab-connection-dot")).toBeNull();
    });

    it.each(["http", "graphql"])(
      "never shows the connection dot for a %s tab even if a connection is flagged connected",
      (type) => {
        setConnected("tab-1", true);
        renderTab(makeTab({ type }));
        expect(screen.queryByTestId("tab-connection-dot")).toBeNull();
      },
    );

    it("ignores the connection state of other tabs", () => {
      setConnected("other-tab", true);
      renderTab(makeTab({ type: "websocket" }));
      expect(screen.queryByTestId("tab-connection-dot")).toBeNull();
    });
  });

  describe("selecting", () => {
    it("selects the tab on click", async () => {
      const user = userEvent.setup();
      const { onSelect } = renderTab(makeTab());
      await user.click(screen.getByTestId("tab"));
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it.each(["Enter", " "])("selects the tab when %j is pressed", (key) => {
      const { onSelect } = renderTab(makeTab());
      fireEvent.keyDown(screen.getByTestId("tab"), { key });
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("does not select the tab for other keys", () => {
      const { onSelect } = renderTab(makeTab());
      fireEvent.keyDown(screen.getByTestId("tab"), { key: "a" });
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("closing", () => {
    it("closes without selecting when the X is clicked", async () => {
      const user = userEvent.setup();
      const { onSelect, onClose } = renderTab(makeTab());
      await user.click(screen.getByTestId("tab-close-btn"));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it.each(["Enter", " "])(
      "closes without selecting when %j is pressed on the X",
      (key) => {
        const { onSelect, onClose } = renderTab(makeTab());
        fireEvent.keyDown(screen.getByTestId("tab-close-btn"), { key });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onSelect).not.toHaveBeenCalled();
      },
    );

    it("does not close for other keys on the X", () => {
      const { onClose } = renderTab(makeTab());
      fireEvent.keyDown(screen.getByTestId("tab-close-btn"), { key: "a" });
      expect(onClose).not.toHaveBeenCalled();
    });

    it("labels the X with the tab name for assistive tech", () => {
      renderTab(makeTab({ name: "Get Users" }));
      expect(
        screen.getByRole("button", { name: "Close Get Users tab" }),
      ).toBeInTheDocument();
    });
  });
});
