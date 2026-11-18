/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { MentionMenu, type MentionKeyHandler } from "./MentionMenu";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    value: 288,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    value: 320,
  });
});

afterEach(() => {
  cleanup();
  useCollectionsStore.setState({ collections: [], requests: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null } as never);
  useEnvironmentsStore.setState({ environments: [] });
});

function seedWorkspace() {
  const base = {
    collectionId: "c1",
    method: "GET" as const,
    params: [],
    headers: [],
    auth: { type: "none" as const },
    body: { type: "none" as const, content: "" },
    preScript: "",
    postScript: "",
    createdAt: 0,
    updatedAt: 0,
  };
  useCollectionsStore.setState({
    collections: [
      { id: "c1", name: "API", createdAt: 0, updatedAt: 0 },
      { id: "c2", name: "Tests", createdAt: 0, updatedAt: 0 },
    ],
    requests: [
      {
        ...base,
        id: "r1",
        name: "Get users",
        url: "https://api.test/users",
      },
      {
        ...base,
        id: "r2",
        name: "Create user",
        url: "https://api.test/users",
      },
      {
        ...base,
        id: "r3",
        name: "Delete user",
        url: "https://api.test/users/{id}",
      },
    ],
  } as never);
}

type MentionMenuProps = React.ComponentProps<typeof MentionMenu>;
type MentionMenuTestProps = Partial<
  Omit<MentionMenuProps, "onSelect" | "onClose" | "onActiveChange">
> & {
  onSelect?: Mock<MentionMenuProps["onSelect"]>;
  onClose?: Mock<MentionMenuProps["onClose"]>;
  onActiveChange?: Mock<NonNullable<MentionMenuProps["onActiveChange"]>>;
  initialQuery?: string;
};

function setup({
  query = "",
  kind,
  hint,
  searchable = false,
  pinCurrentTab = true,
  onSelect = vi.fn<MentionMenuProps["onSelect"]>(),
  onClose = vi.fn<MentionMenuProps["onClose"]>(),
  onActiveChange = vi.fn<NonNullable<MentionMenuProps["onActiveChange"]>>(),
  initialQuery = query,
}: MentionMenuTestProps = {}) {
  cleanup();
  seedWorkspace();
  const keyHandlerRef = createRef<MentionKeyHandler>();
  let currentQuery = initialQuery;

  function Harness() {
    const [q, setQ] = useState(currentQuery);
    currentQuery = q;
    return (
      <>
        <textarea
          data-testid="composer"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            const handled = keyHandlerRef.current?.(e.nativeEvent);
            if (handled) e.preventDefault();
          }}
        />
        <MentionMenu
          query={q}
          kind={kind}
          hint={hint}
          searchable={searchable}
          pinCurrentTab={pinCurrentTab}
          anchor="composer"
          keyHandlerRef={keyHandlerRef}
          onActiveChange={onActiveChange}
          onSelect={onSelect}
          onClose={onClose}
        />
      </>
    );
  }

  render(<Harness />);
  const press = (key: string, options = {}) => {
    const ta = screen.getByTestId("composer") as HTMLTextAreaElement;
    fireEvent.keyDown(ta, { key, ...options });
  };

  return {
    onSelect,
    onClose,
    onActiveChange,
    press,
    invokeHandler: (init: {
      key: string;
      isComposing?: boolean;
    }) => {
      const preventDefault = vi.fn();
      const handled = keyHandlerRef.current?.({
        key: init.key,
        isComposing: init.isComposing ?? false,
        preventDefault,
      });
      return { handled, preventDefault };
    },
    textarea: () => screen.getByTestId("composer") as HTMLTextAreaElement,
    options: () => screen.queryAllByTestId("relay-mention-option"),
  };
}

describe("MentionMenu", () => {
  it("renders a labelled listbox", () => {
    setup({ initialQuery: "" });
    const menu = screen.getByTestId("relay-mention-menu");
    expect(menu).toHaveAttribute("role", "listbox");
    expect(menu).toHaveAccessibleName("mention.listLabel");
  });

  it("shows a hint above the list when provided", () => {
    setup({ initialQuery: "", hint: "Pick a request" });
    const hint = screen.getByText("Pick a request");
    expect(hint.className).toContain("text-xs");
    expect(hint.className).toContain("text-muted-foreground");
  });

  it("pins the current tab as the first row when there is an active tab", () => {
    useTabsStore.setState({
      tabs: [{ tabId: "t1", name: "Open Request", requestId: "r1" }],
      activeTabId: "t1",
    } as never);
    seedWorkspace();
    setup({ initialQuery: "" });
    const options = screen.getAllByTestId("relay-mention-option");
    expect(options[0]).toHaveTextContent("Open Request");
    expect(options[0]).toHaveAttribute("data-kind", "tab");
  });

  it("shows a disabled tab option when no tab is open", () => {
    setup({ initialQuery: "" });
    const tabGroup = screen.getByRole("group", { name: "mention.currentTab" });
    const disabled = tabGroup.querySelector('[aria-disabled]');
    expect(disabled).toHaveTextContent("mention.noTab");
    expect(disabled).toHaveAttribute("aria-selected", "false");
  });

  it("hides the current tab section when pinCurrentTab is false", () => {
    useTabsStore.setState({
      tabs: [{ tabId: "t1", name: "Open Request", requestId: "r1" }],
      activeTabId: "t1",
    } as never);
    seedWorkspace();
    setup({ initialQuery: "", pinCurrentTab: false });
    expect(screen.queryByRole("group", { name: "mention.currentTab" })).toBeNull();
  });

  it("hides the current tab row when the tab does not match the query", () => {
    useTabsStore.setState({
      tabs: [{ tabId: "t1", name: "Delete something", requestId: "r1" }],
      activeTabId: "t1",
    } as never);
    seedWorkspace();
    setup({ initialQuery: "Create" });
    expect(screen.queryByRole("group", { name: "mention.currentTab" })).toBeNull();
  });

  it("shows all options and marks them as options", () => {
    setup({ initialQuery: "" });
    const options = screen.getAllByTestId("relay-mention-option");
    expect(options.length).toBeGreaterThan(0);
    options.forEach((option) => {
      expect(option).toHaveAttribute("role", "option");
    });
  });

  it("gives every option a distinct id", () => {
    setup({ initialQuery: "" });
    const options = screen.getAllByTestId("relay-mention-option");
    const ids = options.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ArrowDown and ArrowUp are handled by the key handler", () => {
    const { press } = setup({ initialQuery: "" });
    expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
    press("ArrowDown");
    expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
    press("ArrowUp");
    expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
  });

  it("Enter selects the highlighted option", () => {
    const { press, onSelect } = setup({ initialQuery: "" });
    press("ArrowDown");
    press("Enter");
    expect(onSelect).toHaveBeenCalled();
    expect(onSelect.mock.calls[0][0]).toHaveProperty("kind");
  });

  it("Tab also selects the highlighted option", () => {
    const { press, onSelect } = setup({ initialQuery: "" });
    press("Tab");
    expect(onSelect).toHaveBeenCalled();
  });

  it("Escape closes the menu without selecting", () => {
    const { press, onClose, onSelect } = setup({ initialQuery: "" });
    press("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not return true for other keys", () => {
    const { press } = setup({ initialQuery: "" });
    press("a");
    expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
  });


  it("clicking an option selects it without taking focus from textarea", () => {
    const { onSelect, textarea } = setup({ initialQuery: "" });
    textarea().focus();
    const options = screen.getAllByTestId("relay-mention-option");
    fireEvent.click(options[1]);
    expect(onSelect).toHaveBeenCalledWith({
      kind: "request",
      id: "r1",
      label: "Get users",
    });
    expect(document.activeElement).toBe(textarea());
  });

  it("does not apply activeDescendant when there are no options", () => {
    setup({ initialQuery: "nonexistent" });
    const menu = screen.getByTestId("relay-mention-menu");
    expect(menu.getAttribute("aria-activedescendant")).toBeNull();
  });

  it("shows an empty status message when no results match the query", () => {
    setup({ initialQuery: "zzzzzzz" });
    expect(screen.getByTestId("relay-mention-empty")).toHaveTextContent(
      "mention.empty",
    );
  });



  it("calls onActiveChange with the active option id", () => {
    const { press, onActiveChange } = setup({ initialQuery: "" });
    const initialCall = onActiveChange.mock.calls[0][0];
    expect(typeof initialCall).toBe("string");
    expect(initialCall).toBeTruthy();
    press("ArrowDown");
    const secondCall = onActiveChange.mock.calls[onActiveChange.mock.calls.length - 1][0];
    expect(typeof secondCall).toBe("string");
    expect(secondCall).not.toBe(initialCall);
  });

  it("calls onActiveChange with null on unmount", () => {
    const { onActiveChange } = setup({ initialQuery: "" });
    onActiveChange.mockClear();
    const ta = screen.getByTestId("composer") as HTMLTextAreaElement;
    cleanup();
    expect(onActiveChange).toHaveBeenCalledWith(null);
  });


  it("does not select with Enter when there are no options", () => {
    const { press, onSelect } = setup({ initialQuery: "zzz" });
    press("Enter");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not close the menu for non-navigation keys", () => {
    setup({ initialQuery: "" });
    const ta = screen.getByTestId("composer") as HTMLTextAreaElement;
    fireEvent.keyDown(ta, { key: "a" });
    expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
  });

  it("includes aria-posinset and aria-setsize on request options", () => {
    useTabsStore.setState({
      tabs: [{ tabId: "t1", name: "My Tab", requestId: "r1" }],
      activeTabId: "t1",
    } as never);
    seedWorkspace();
    setup({ initialQuery: "" });
    const options = screen.getAllByTestId("relay-mention-option");
    const requestOptions = options.filter((o) => o.getAttribute("data-kind") === "request");
    const totalSetSize = options.length;
    expect(requestOptions[0]).toHaveAttribute("aria-posinset", "2");
    expect(requestOptions[0]).toHaveAttribute("aria-setsize", String(totalSetSize));
  });

  it("sets an option active when mouseMove fires on a non-active option", () => {
    setup({ initialQuery: "" });
    const requestOptions = screen
      .getAllByTestId("relay-mention-option")
      .filter((o) => o.getAttribute("data-kind") === "request");
    const activeRequest = requestOptions.find(
      (o) => o.getAttribute("aria-selected") === "true",
    );
    const inactiveOption = requestOptions.find(
      (o) => o.getAttribute("aria-selected") !== "true",
    );
    expect(activeRequest).toBeTruthy();
    expect(inactiveOption).toBeTruthy();

    fireEvent.mouseMove(inactiveOption!);

    expect(inactiveOption).toHaveAttribute("aria-selected", "true");
    expect(activeRequest).toHaveAttribute("aria-selected", "false");
  });

  it("ignores keyboard events while IME composition is active", () => {
    const { invokeHandler, onSelect } = setup({ initialQuery: "" });
    const { handled } = invokeHandler({ key: "Enter", isComposing: true });
    expect(handled).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("prevents default on mouseDown to keep focus in textarea", () => {
    const { textarea } = setup({ initialQuery: "" });
    const option = screen
      .getAllByTestId("relay-mention-option")
      .find((o) => o.getAttribute("data-kind") === "request");

    expect(option).toBeTruthy();
    textarea().focus();
    fireEvent.mouseDown(option!);
    expect(document.activeElement).toBe(textarea());
  });

  describe("searchable (starter and slash mode)", () => {
    const search = () => screen.getByTestId("relay-mention-search") as HTMLInputElement;
    const requestLabels = () =>
      screen
        .queryAllByTestId("relay-mention-option")
        .filter((o) => o.getAttribute("data-kind") === "request")
        .map((o) => o.textContent ?? "");

    it("autofocuses its own search field and ignores the composer query", () => {
      setup({ searchable: true, kind: "request", initialQuery: "zzzz" });
      expect(document.activeElement).toBe(search());
      expect(requestLabels()).toHaveLength(3);
    });

    it("has no search field in mention mode", () => {
      setup({ initialQuery: "" });
      expect(screen.queryByTestId("relay-mention-search")).toBeNull();
    });

    it("narrows by name, case-insensitively", () => {
      setup({ searchable: true, kind: "request", pinCurrentTab: false });
      fireEvent.change(search(), { target: { value: "CREATE" } });
      expect(requestLabels()).toEqual([expect.stringContaining("Create user")]);
    });

    it("narrows by URL", () => {
      setup({ searchable: true, kind: "request", pinCurrentTab: false });
      fireEvent.change(search(), { target: { value: "users/{id}" } });
      expect(requestLabels()).toEqual([expect.stringContaining("Delete user")]);
    });

    it("moves with arrow keys and selects with Enter from the search field", () => {
      const { onSelect } = setup({
        searchable: true,
        kind: "request",
        pinCurrentTab: false,
      });
      fireEvent.change(search(), { target: { value: "user" } });
      fireEvent.keyDown(search(), { key: "ArrowDown" });
      fireEvent.keyDown(search(), { key: "Enter" });
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect.mock.calls[0][0]).toMatchObject({ kind: "request" });
    });

    it("Escape in the search field closes the menu", () => {
      const { onClose } = setup({ searchable: true, kind: "request" });
      fireEvent.keyDown(search(), { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("shows the no-match text with the query", () => {
      setup({ searchable: true, kind: "request", pinCurrentTab: false });
      fireEvent.change(search(), { target: { value: "nothing-here" } });
      expect(screen.getByTestId("relay-mention-empty")).toHaveTextContent(
        /nothing-here|mention\.noMatch/,
      );
    });

    it("shows no footer hint", () => {
      setup({ searchable: true, kind: "request" });
      expect(screen.queryByTestId("relay-mention-truncated")).toBeNull();
    });
  });
});
