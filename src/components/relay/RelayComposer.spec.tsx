/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayStore } from "@/stores/useRelayStore";
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

afterEach(() => {
  cleanup();
  useRelayStore.setState({ attachedItems: [] });
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

  it("always shows the footer under the composer row, with no dismiss control", () => {
    setup();
    const footer = screen.getByTestId("relay-footer");
    expect(footer).toHaveTextContent("composerFooter");
    expect(footer.querySelector("button")).toBeNull();
    const row = screen.getByTestId("relay-composer-row");
    expect(row.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the footer when offline", () => {
    setup({ online: false });
    expect(screen.getByTestId("relay-footer")).toBeInTheDocument();
  });

  it("lays out leading slot, textarea, trailing slot and send in one row, in that order", () => {
    setup();
    const row = screen.getByTestId("relay-composer-row");
    const ids = Array.from(row.children).map((el) => el.getAttribute("data-testid"));
    expect(ids).toEqual([
      "relay-composer-leading",
      "relay-composer",
      "relay-composer-trailing",
      "relay-send",
    ]);
  });

  it("gives the send button an accessible name and a 36px target", () => {
    setup({ initial: "hi" });
    const send = screen.getByTestId("relay-send");
    expect(send).toHaveAccessibleName("send");
    expect(send).toHaveClass("size-9");
  });

  it("swaps to a named Stop control in the same row while generating", () => {
    const { onStop } = setup({ generating: true });
    const stop = screen.getByTestId("relay-stop");
    expect(screen.getByTestId("relay-composer-row")).toContainElement(stop);
    expect(stop).toHaveAccessibleName("stop");
    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("shows the offline notice outside the row and disables input", () => {
    const { box } = setup({ online: false });
    const notice = screen.getByTestId("relay-offline-notice");
    expect(notice).toHaveTextContent("offlineNotice");
    expect(screen.getByTestId("relay-composer-row")).not.toContainElement(notice);
    expect(box).toBeDisabled();
  });

  it("enlarges the textarea and the + control on touch layouts", () => {
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
    expect(screen.getByTestId("relay-composer")).toHaveStyle({ minHeight: "44px" });
    expect(screen.getByTestId("relay-picker-trigger")).toHaveStyle({ minHeight: "44px" });
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

    it("typing @ opens the same picker", () => {
      const { box } = setup();
      typeAt(box, "look at @");
      expect(screen.getByTestId("stub-picker")).toBeInTheDocument();
    });

    it("does not open for an @ inside a word or when text is deleted", () => {
      const { box } = setup({ initial: "ab" });
      typeAt(box, "me@");
      expect(screen.queryByTestId("stub-picker")).toBeNull();
      typeAt(box, "x @a");
      expect(screen.queryByTestId("stub-picker")).toBeNull();
    });

    it("choosing from an @ replaces it with a token and attaches a chip", () => {
      const { box } = setup();
      typeAt(box, "see @");
      fireEvent.click(screen.getByTestId("stub-pick"));
      expect(box.value).toBe("see @Get users ");
      expect(box.selectionStart).toBe(box.value.length);
      expect(useRelayStore.getState().attachedItems).toEqual([
        { kind: "request", id: "r1", label: "Get users" },
      ]);
      expect(screen.queryByTestId("stub-picker")).toBeNull();
    });

    it("choosing from + attaches a chip and leaves the draft alone", () => {
      const { box } = setup({ initial: "hello" });
      fireEvent.click(screen.getByTestId("relay-picker-trigger"));
      fireEvent.click(screen.getByTestId("stub-pick"));
      expect(box.value).toBe("hello");
      expect(useRelayStore.getState().attachedItems).toHaveLength(1);
      expect(document.activeElement).toBe(box);
    });

    it("closing without a choice keeps the draft and forgets the mention", () => {
      const { box } = setup();
      typeAt(box, "@");
      fireEvent.click(screen.getByTestId("stub-close"));
      expect(box.value).toBe("@");
      fireEvent.click(screen.getByTestId("relay-picker-trigger"));
      fireEvent.click(screen.getByTestId("stub-pick"));
      expect(box.value).toBe("@");
    });

    it("disables the + button offline", () => {
      setup({ online: false });
      expect(screen.getByTestId("relay-picker-trigger")).toBeDisabled();
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

    it("lists the five commands when the draft starts with /", () => {
      setup({ initial: "/" });
      expect(options().map((o) => o.getAttribute("data-command"))).toEqual([
        "explain",
        "assert",
        "curl",
        "docs",
        "clear",
      ]);
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

    it("arrows move the highlight and Enter fills the prompt instead of sending", () => {
      const { box, onSend } = setup({ initial: "/" });
      const menu = screen.getByTestId("relay-slash-menu");
      fireEvent.keyDown(box, { key: "ArrowDown" });
      expect(menu.getAttribute("aria-activedescendant")).toBe(options()[1].id);
      fireEvent.keyDown(box, { key: "ArrowUp" });
      fireEvent.keyDown(box, { key: "Enter" });
      expect(box.value).toBe("slash.explain.prompt");
      expect(onSend).not.toHaveBeenCalled();
      expect(screen.queryByTestId("relay-slash-menu")).toBeNull();
    });

    it("Escape dismisses the menu and keeps the draft", () => {
      const { box } = setup({ initial: "/" });
      fireEvent.keyDown(box, { key: "Escape" });
      expect(screen.queryByTestId("relay-slash-menu")).toBeNull();
      expect(box.value).toBe("/");
    });

    it("clicking a command fills its prompt", () => {
      const { box } = setup({ initial: "/" });
      fireEvent.click(options()[2]);
      expect(box.value).toBe("slash.curl.prompt");
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
});
