/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useRelayRecentStore } from "@/stores/useRelayRecentStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { RelayComposer } from "./RelayComposer";

// The real picker needs layout APIs jsdom lacks; its own spec covers it. This stub
// keeps the composer's wiring (trigger, open state, selection) under test.
vi.mock("./RelayPicker", () => ({
  RelayPicker: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (item: { kind: "request"; id: string; label: string }) => void;
    trigger: React.ReactElement<{ onClick?: () => void }>;
    initialQuery?: string;
  }) => (
    <>
      <span
        data-testid="stub-trigger"
        onClick={() => props.onOpenChange(!props.open)}
        onKeyDown={() => undefined}
      >
        {props.trigger}
      </span>
      {props.open ? (
        <div data-testid="stub-picker" data-query={props.initialQuery}>
          <button
            type="button"
            data-testid="stub-pick"
            onClick={() => props.onSelect({ kind: "request", id: "r1", label: "Get users" })}
          />
          <button type="button" data-testid="stub-close" onClick={() => props.onOpenChange(false)} />
        </div>
      ) : null}
    </>
  ),
}));

// @tanstack/react-virtual measures the scroll element; happy-dom has no layout.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 264 });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 320 });
});

afterEach(() => {
  cleanup();
  useRelayStore.setState({ attachedItems: [] });
  useRelayRecentStore.setState({ items: [] });
  useCollectionsStore.setState({ collections: [], requests: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null } as never);
});

type Overrides = Partial<{
  generating: boolean;
  online: boolean;
  lastUserText: string | null;
  initial: string;
  threadHasMessages: boolean;
}>;

function setup({ generating = false, online = true, lastUserText = null, initial = "", threadHasMessages = false }: Overrides = {}) {
  const onSend = vi.fn();
  const onStop = vi.fn();
  function Harness() {
    const [value, setValue] = useState(initial);
    return (
      <RelayComposer
        value={value}
        onValueChange={setValue}
        onSend={onSend}
        onStop={onStop}
        generating={generating}
        online={online}
        lastUserText={lastUserText}
        textareaRef={null}
        threadHasMessages={threadHasMessages}
      />
    );
  }
  render(<Harness />);
  return { onSend, onStop, box: screen.getByTestId("relay-composer") as HTMLTextAreaElement };
}

describe("RelayComposer", () => {
  it("Enter sends the trimmed text and clears the draft", () => {
    const { onSend, box } = setup({ initial: "  hello  " });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("hello");
    expect(box.value).toBe("");
  });

  it("Shift+Enter does not send", () => {
    const { onSend, box } = setup({ initial: "hello" });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send an empty or whitespace draft", () => {
    const { onSend, box } = setup({ initial: "   " });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByTestId("relay-send")).toBeDisabled();
  });

  it("the Send button submits", () => {
    const { onSend } = setup({ initial: "hi" });
    fireEvent.click(screen.getByTestId("relay-send"));
    expect(onSend).toHaveBeenCalledWith("hi");
  });

  it("toggles to an enabled Stop button while generating", () => {
    const { onStop, onSend } = setup({ generating: true, initial: "next" });
    expect(screen.queryByTestId("relay-send")).toBeNull();
    const stop = screen.getByTestId("relay-stop");
    expect(stop).toBeEnabled();
    expect(stop).toHaveAttribute("aria-label", "stop");
    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send on Enter while generating", () => {
    const { onSend, box } = setup({ generating: true, initial: "next" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("is disabled offline with an inline notice and never sends", () => {
    const { onSend, box } = setup({ online: false, initial: "hi" });
    expect(box).toBeDisabled();
    expect(screen.getByTestId("relay-offline-notice")).toHaveTextContent("offlineNotice");
    expect(screen.getByTestId("relay-send")).toBeDisabled();
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("hides the notice when online", () => {
    setup();
    expect(screen.queryByTestId("relay-offline-notice")).toBeNull();
  });

  it("ArrowUp on an empty draft recalls the last message", () => {
    const { box } = setup({ lastUserText: "previous" });
    fireEvent.keyDown(box, { key: "ArrowUp" });
    expect(box.value).toBe("previous");
  });

  it("ArrowUp leaves a non-empty draft alone", () => {
    const { box } = setup({ lastUserText: "previous", initial: "typing" });
    fireEvent.keyDown(box, { key: "ArrowUp" });
    expect(box.value).toBe("typing");
  });

  it("ArrowUp with nothing to recall is a no-op", () => {
    const { box } = setup();
    fireEvent.keyDown(box, { key: "ArrowUp" });
    expect(box.value).toBe("");
  });

  it("always shows the footer under the composer box, with no dismiss control", () => {
    setup();
    const footer = screen.getByTestId("relay-footer");
    expect(footer).toHaveTextContent("composerFooter");
    expect(footer.querySelector("button")).toBeNull();
    const composerBox = screen.getByTestId("relay-composer-box");
    expect(composerBox.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the footer when offline", () => {
    setup({ online: false });
    expect(screen.getByTestId("relay-footer")).toBeInTheDocument();
  });

  it("wraps the textarea and the toolbar in one bordered box", () => {
    setup();
    const composerBox = screen.getByTestId("relay-composer-box");
    expect(composerBox).toHaveClass("rounded-2xl", "border");
    const ids = Array.from(composerBox.children).map((el) => el.getAttribute("data-testid"));
    expect(ids).toEqual(["relay-composer", "relay-composer-toolbar"]);
    const toolbar = screen.getByTestId("relay-composer-toolbar");
    expect(toolbar).toContainElement(screen.getByTestId("relay-picker-trigger"));
    expect(toolbar).toContainElement(screen.getByTestId("relay-send"));
  });

  it("keeps the placeholder, + and send in tab order", () => {
    setup({ initial: "hi" });
    const focusable = Array.from(
      screen.getByTestId("relay-composer-box").querySelectorAll<HTMLElement>("textarea, button"),
    ).map((el) => el.getAttribute("data-testid"));
    expect(focusable).toEqual(["relay-composer", "relay-picker-trigger", "relay-send"]);
  });

  it("gives the send button an accessible name and a 36px target", () => {
    setup({ initial: "hi" });
    const send = screen.getByTestId("relay-send");
    expect(send).toHaveAccessibleName("send");
    expect(send).toHaveClass("size-9");
  });

  it("swaps to a named Stop control in the same box while generating", () => {
    const { onStop } = setup({ generating: true });
    const stop = screen.getByTestId("relay-stop");
    expect(screen.getByTestId("relay-composer-box")).toContainElement(stop);
    expect(stop).toHaveAccessibleName("stop");
    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("shows the offline notice outside the box and disables input", () => {
    const { box } = setup({ online: false });
    const notice = screen.getByTestId("relay-offline-notice");
    expect(notice).toHaveTextContent("offlineNotice");
    expect(screen.getByTestId("relay-composer-box")).not.toContainElement(notice);
    expect(box).toBeDisabled();
  });

  it("enlarges the + and send controls on touch layouts", () => {
    render(
      <RelayComposer
        value=""
        onValueChange={() => undefined}
        onSend={() => undefined}
        onStop={() => undefined}
        generating={false}
        online
        lastUserText={null}
        textareaRef={null}
        touchTargets
      />,
    );
    for (const id of ["relay-picker-trigger", "relay-send"]) {
      expect(screen.getByTestId(id)).toHaveStyle({ minHeight: "44px", minWidth: "44px" });
    }
  });

  it("updates the draft as the user types", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "typed" } });
    expect(box.value).toBe("typed");
    expect(screen.getByTestId("relay-send")).toBeEnabled();
  });

  describe("picker", () => {
    const typeAt = (box: HTMLTextAreaElement, value: string) => {
      box.focus();
      fireEvent.change(box, { target: { value } });
    };

    it("the + button opens the picker without a mention", () => {
      setup();
      const trigger = screen.getByTestId("relay-picker-trigger");
      expect(trigger).toHaveAccessibleName("picker.add");
      fireEvent.click(trigger);
      expect(screen.getByTestId("stub-picker")).toBeInTheDocument();
    });

    it("choosing from + attaches a chip and leaves the draft alone", () => {
      const { box } = setup({ initial: "hello" });
      fireEvent.click(screen.getByTestId("relay-picker-trigger"));
      fireEvent.click(screen.getByTestId("stub-pick"));
      expect(box.value).toBe("hello");
      expect(useRelayStore.getState().attachedItems).toHaveLength(1);
      expect(document.activeElement).toBe(box);
    });

    it("closing the + picker without a choice leaves the draft alone", () => {
      const { box } = setup({ initial: "hello" });
      fireEvent.click(screen.getByTestId("relay-picker-trigger"));
      fireEvent.click(screen.getByTestId("stub-close"));
      expect(box.value).toBe("hello");
      expect(screen.queryByTestId("stub-picker")).toBeNull();
    });

    it("records a + choice in the recents", () => {
      setup();
      fireEvent.click(screen.getByTestId("relay-picker-trigger"));
      fireEvent.click(screen.getByTestId("stub-pick"));
      expect(useRelayRecentStore.getState().items).toEqual([
        { kind: "request", id: "r1", name: "Get users" },
      ]);
    });

    it("disables the + button offline", () => {
      setup({ online: false });
      expect(screen.getByTestId("relay-picker-trigger")).toBeDisabled();
    });
  });

  describe("@ mentions", () => {
    const seedWorkspace = () => {
      const base = {
        collectionId: "c1",
        method: "GET",
        params: [],
        headers: [],
        auth: { type: "none" },
        body: { type: "none", content: "" },
        preScript: "",
        postScript: "",
        createdAt: 0,
        updatedAt: 0,
      };
      useCollectionsStore.setState({
        collections: [{ id: "c1", name: "Payments", createdAt: 0, updatedAt: 0 }],
        requests: [
          { ...base, id: "r1", name: "Get users", url: "https://api.test/users" },
          { ...base, id: "r2", name: "Get orders", url: "https://api.test/orders" },
        ],
      } as never);
    };
    const type = (box: HTMLTextAreaElement, value: string) => {
      box.focus();
      fireEvent.change(box, { target: { value } });
    };

    // The pinned "Current tab" row is also an option, so rows are picked by kind.
    const pickFirstRequest = () =>
      fireEvent.click(
        screen
          .getAllByTestId("relay-mention-option")
          .find((option) => option.getAttribute("data-kind") === "request") as HTMLElement,
      );

    beforeEach(seedWorkspace);

    it("opens for an @ at the start and after a space, never mid-word", () => {
      const { box } = setup();
      type(box, "@");
      expect(screen.getByTestId("relay-mention-menu")).toHaveAttribute("role", "listbox");
      type(box, "see @");
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
      type(box, "a@b");
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
    });

    it("stays closed offline and while the slash menu owns the draft", () => {
      const { box } = setup({ online: false });
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
      expect(box).toBeDisabled();
    });

    it("never shows beside the slash menu", () => {
      const { box } = setup();
      type(box, "/ex");
      expect(screen.getByTestId("relay-slash-menu")).toBeInTheDocument();
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
      type(box, "@");
      expect(screen.queryByTestId("relay-slash-menu")).toBeNull();
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
    });

    it("choosing a request inserts the token, attaches one pill and records a recent", () => {
      const { box } = setup();
      type(box, "see @");
      pickFirstRequest();
      expect(box.value).toBe("see @Get users ");
      expect(box.selectionStart).toBe(box.value.length);
      expect(useRelayStore.getState().attachedItems).toEqual([
        { kind: "request", id: "r1", label: "Get users" },
      ]);
      expect(useRelayRecentStore.getState().items).toHaveLength(1);
      expect(screen.getAllByTestId("relay-composer-pill")).toHaveLength(1);
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
    });

    it("choosing the same request again adds no second pill", () => {
      const { box } = setup();
      type(box, "@");
      pickFirstRequest();
      type(box, `${box.value}@`);
      pickFirstRequest();
      expect(screen.getAllByTestId("relay-composer-pill")).toHaveLength(1);
      expect(useRelayStore.getState().attachedItems).toHaveLength(1);
    });

    it("arrows move the highlight and Enter selects without sending", () => {
      const { box, onSend } = setup();
      type(box, "@");
      fireEvent.keyDown(box, { key: "ArrowDown" });
      const active = screen
        .getAllByTestId("relay-mention-option")
        .find((option) => option.getAttribute("aria-selected") === "true");
      expect(box).toHaveAttribute("aria-activedescendant", active?.id);
      fireEvent.keyDown(box, { key: "Enter" });
      expect(onSend).not.toHaveBeenCalled();
      expect(useRelayStore.getState().attachedItems).toHaveLength(1);
    });

    it("Tab selects the highlighted row", () => {
      const { box } = setup();
      type(box, "@");
      fireEvent.keyDown(box, { key: "Tab" });
      expect(box.value).toMatch(/^@Get \w+ $/);
    });

    it("Escape closes the menu and keeps the typed text", () => {
      const { box } = setup();
      type(box, "@ge");
      fireEvent.keyDown(box, { key: "Escape" });
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
      expect(box.value).toBe("@ge");
    });

    it("typing another @ after Escape opens the menu again", () => {
      const { box } = setup();
      type(box, "@");
      fireEvent.keyDown(box, { key: "Escape" });
      type(box, "@ @");
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
    });

    it("removing the pill strips its token from the draft", () => {
      const { box } = setup();
      type(box, "run @");
      pickFirstRequest();
      type(box, `${box.value}now`);
      fireEvent.click(screen.getByTestId("relay-composer-pill-remove"));
      expect(box.value).toBe("run now");
      expect(screen.queryByTestId("relay-composer-pill")).toBeNull();
    });

    it("deleting the token text does not detach the pill", () => {
      const { box } = setup();
      type(box, "@");
      pickFirstRequest();
      type(box, "");
      expect(screen.getByTestId("relay-composer-pill")).toBeInTheDocument();
    });
  });

  describe("slash commands", () => {
    const options = () => screen.queryAllByTestId("relay-slash-option");
    const newThread = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
      newThread.mockClear();
      useRelayStore.setState({ newThread });
    });
    afterEach(() => {
      useRelayStore.setState({ newThread: useRelayStore.getInitialState().newThread });
    });

    it("lists fifteen commands when the draft starts with /", () => {
      setup({ initial: "/" });
      expect(options()).toHaveLength(15);
      expect(options()[0]?.getAttribute("data-command")).toBe("explain");
      expect(options().at(-1)?.getAttribute("data-command")).toBe("clear");
    });

    it("opens only at the start of the draft", () => {
      setup({ initial: "hello /" });
      expect(screen.queryByTestId("relay-slash-menu")).toBeNull();
    });

    it("narrows as the user types and hides when nothing matches", () => {
      const { box } = setup({ initial: "/" });
      fireEvent.change(box, { target: { value: "/cl" } });
      expect(options()).toHaveLength(1);
      fireEvent.change(box, { target: { value: "/zzz" } });
      expect(screen.queryByTestId("relay-slash-menu")).toBeNull();
    });

    it("arrows move the highlight and Enter fills a no-target prompt instead of sending", () => {
      const { box, onSend } = setup({ initial: "/import" });
      const menu = screen.getByTestId("relay-slash-menu");
      expect(options()).toHaveLength(1);
      fireEvent.keyDown(box, { key: "Enter" });
      expect(box.value).toBe("slash.import.prompt");
      expect(onSend).not.toHaveBeenCalled();
      expect(screen.queryByTestId("relay-slash-menu")).toBeNull();
      expect(menu.getAttribute("aria-activedescendant")).toBeTruthy();
    });

    it("Escape dismisses the menu and keeps the draft", () => {
      const { box } = setup({ initial: "/" });
      fireEvent.keyDown(box, { key: "Escape" });
      expect(screen.queryByTestId("relay-slash-menu")).toBeNull();
      expect(box.value).toBe("/");
    });

    it("clicking a no-target command fills its prompt", () => {
      const { box } = setup({ initial: "/import" });
      fireEvent.click(options()[0]);
      expect(box.value).toBe("slash.import.prompt");
    });

    it("/run with nothing attached opens the mention menu with a hint", () => {
      const { box } = setup({ initial: "/run" });
      fireEvent.click(options()[0]);
      expect(box.value).toBe("/run");
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
      expect(screen.getByText("slash.hint.request")).toBeInTheDocument();
    });

    it("/clear on an empty thread starts a new conversation with no confirm", () => {
      const { box } = setup({ initial: "/cl" });
      fireEvent.keyDown(box, { key: "Enter" });
      expect(screen.queryByTestId("relay-clear-confirm")).toBeNull();
      expect(newThread).toHaveBeenCalledTimes(1);
      expect(box.value).toBe("");
    });

    it("/clear on a non-empty thread confirms first", () => {
      const { box } = setup({ initial: "/cl", threadHasMessages: true });
      fireEvent.keyDown(box, { key: "Enter" });
      expect(screen.getByTestId("relay-clear-confirm")).toBeInTheDocument();
      expect(newThread).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId("relay-clear-confirm-button"));
      expect(newThread).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("relay-clear-confirm")).toBeNull();
    });

    it("cancelling the confirm keeps the conversation and returns focus", () => {
      const { box } = setup({ initial: "/cl", threadHasMessages: true });
      fireEvent.keyDown(box, { key: "Enter" });
      fireEvent.keyDown(screen.getByTestId("relay-clear-confirm"), { key: "Escape" });
      expect(newThread).not.toHaveBeenCalled();
      expect(screen.queryByTestId("relay-clear-confirm")).toBeNull();
      expect(document.activeElement).toBe(box);
    });

    it("logs and keeps going when starting the conversation fails", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
      newThread.mockRejectedValueOnce(new Error("quota"));
      const { box } = setup({ initial: "/cl" });
      fireEvent.keyDown(box, { key: "Enter" });
      await waitFor(() => expect(error).toHaveBeenCalled());
      error.mockRestore();
    });

    it("other keys inside the confirm do not cancel it", () => {
      const { box } = setup({ initial: "/cl", threadHasMessages: true });
      fireEvent.keyDown(box, { key: "Enter" });
      fireEvent.keyDown(screen.getByTestId("relay-clear-confirm"), { key: "a" });
      expect(screen.getByTestId("relay-clear-confirm")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("relay-clear-cancel"));
      expect(screen.queryByTestId("relay-clear-confirm")).toBeNull();
      expect(newThread).not.toHaveBeenCalled();
    });

    it("Enter still sends a normal message when no menu is open", () => {
      const { box, onSend } = setup({ initial: "hello" });
      fireEvent.keyDown(box, { key: "Enter" });
      expect(onSend).toHaveBeenCalledWith("hello");
    });
  });
  describe("dictation mic", () => {
    class FakeRecognition {
      static last: FakeRecognition | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        FakeRecognition.last = this;
      }
    }
    const w = window as unknown as Record<string, unknown>;

    afterEach(() => {
      delete w.SpeechRecognition;
    });

    it("renders no mic where speech recognition is unsupported", () => {
      setup();
      expect(screen.queryByTestId("relay-mic")).toBeNull();
    });

    it("renders the mic in the toolbar and dictation fills the draft without sending", () => {
      w.SpeechRecognition = FakeRecognition;
      const { box, onSend } = setup({ initial: "note" });
      const mic = screen.getByTestId("relay-mic");
      expect(screen.getByTestId("relay-composer-toolbar").contains(mic)).toBe(true);
      fireEvent.click(mic);
      act(() =>
        FakeRecognition.last?.onresult?.({
          resultIndex: 0,
          results: [{ isFinal: true, 0: { transcript: "from voice" } }],
        }),
      );
      expect(box.value).toBe("note from voice");
      expect(onSend).not.toHaveBeenCalled();
    });

    it("disables the mic while offline", () => {
      w.SpeechRecognition = FakeRecognition;
      setup({ online: false });
      expect((screen.getByTestId("relay-mic") as HTMLButtonElement).disabled).toBe(true);
    });

    it("mic renders with correct tab order after pills and before send", () => {
      w.SpeechRecognition = FakeRecognition;
      const { box } = setup({ initial: "hi" });
      const focusable = Array.from(
        screen.getByTestId("relay-composer-box").querySelectorAll<HTMLElement>("textarea, button"),
      ).map((el) => el.getAttribute("data-testid"));
      expect(focusable).toEqual(["relay-composer", "relay-picker-trigger", "relay-mic", "relay-send"]);
    });
  });

  describe("textareaRef", () => {
    it("passes the ref as a callback function", () => {
      const refCallback = vi.fn();
      render(
        <RelayComposer
          value=""
          onValueChange={() => undefined}
          onSend={() => undefined}
          onStop={() => undefined}
          generating={false}
          online
          lastUserText={null}
          textareaRef={refCallback}
        />,
      );
      expect(refCallback).toHaveBeenCalledWith(screen.getByTestId("relay-composer"));
    });

    it("passes the ref as a mutable object", () => {
      const refObject = { current: null as HTMLTextAreaElement | null };
      render(
        <RelayComposer
          value=""
          onValueChange={() => undefined}
          onSend={() => undefined}
          onStop={() => undefined}
          generating={false}
          online
          lastUserText={null}
          textareaRef={refObject}
        />,
      );
      expect(refObject.current).toBe(screen.getByTestId("relay-composer"));
    });
  });

  describe("tooltips", () => {
    it("shows a tooltip on the + button via the ComposerTip component", () => {
      setup({ initial: "hi" });
      const trigger = screen.getByTestId("relay-picker-trigger");
      expect(trigger).toHaveAccessibleName("picker.add");
    });

    it("shows a tooltip on the send button via the ComposerTip component", () => {
      setup({ initial: "hi" });
      const send = screen.getByTestId("relay-send");
      expect(send).toHaveAccessibleName("send");
    });

    it("shows a stop tooltip instead when generating", () => {
      setup({ generating: true });
      const stop = screen.getByTestId("relay-stop");
      expect(stop).toHaveAccessibleName("stop");
    });
  });

  describe("slash and mention exclusivity", () => {
    it("typing @ after / dismisses the slash menu", () => {
      const { box } = setup({ initial: "/" });
      expect(screen.getByTestId("relay-slash-menu")).toBeInTheDocument();
      fireEvent.change(box, { target: { value: "/@" } });
      expect(screen.queryByTestId("relay-slash-menu")).toBeNull();
    });

    it("typing / inside @ dismisses the mention menu", () => {
      const { box } = setup();
      box.focus();
      fireEvent.change(box, { target: { value: "@" } });
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
      fireEvent.change(box, { target: { value: "@get /" } });
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
    });
  });
});
