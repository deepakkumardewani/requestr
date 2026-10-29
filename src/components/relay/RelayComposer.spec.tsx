/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayRecentStore } from "@/stores/useRelayRecentStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { SLASH_COMMANDS } from "@/lib/relay/slashCommands";
import { RelayComposer } from "./RelayComposer";

const runCommand = SLASH_COMMANDS.find((command) => command.id === "run")!;

// The real launcher is covered by its own spec. This stub keeps the composer's
// wiring (trigger, open state, selection, focus handoff) under test.
vi.mock("./RelayLauncher", () => ({
  RelayLauncher: (props: {
    onClose: (restoreFocus: boolean) => void;
    onSelectChip: (chip: { kind: "request" | "tab"; id: string; label: string }) => void;
    onPasteCurl: () => void;
    onRunCommand: (command: typeof runCommand) => void;
    onOpenPermission: () => void;
  }) => (
    <div data-testid="stub-launcher">
      <button
        type="button"
        data-testid="stub-pick"
        onClick={() => props.onSelectChip({ kind: "request", id: "r1", label: "Get users" })}
      />
      <button
        type="button"
        data-testid="stub-pick-tab"
        onClick={() => props.onSelectChip({ kind: "tab", id: "t1", label: "Tab 1" })}
      />
      <button type="button" data-testid="stub-paste-curl" onClick={() => props.onPasteCurl()} />
      <button type="button" data-testid="stub-run-command" onClick={() => props.onRunCommand(runCommand)} />
      <button type="button" data-testid="stub-open-permission" onClick={() => props.onOpenPermission()} />
      <button type="button" data-testid="stub-close" onClick={() => props.onClose(true)} />
      <button type="button" data-testid="stub-close-no-focus" onClick={() => props.onClose(false)} />
    </div>
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
  useRelayStore.setState({
    attachedItems: [],
    outgoing: null,
    composerDraft: null,
    permissionPopoverOpen: false,
    mentionRequest: null,
  });
  useRelayRecentStore.setState({ items: [] });
  useRelayPermissionStore.setState({ mode: "review" });
  useCollectionsStore.setState({ collections: [], requests: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null } as never);
});

function seedOneRequest() {
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
    collections: [{ id: "c1", name: "API", createdAt: 0, updatedAt: 0 }],
    requests: [{ ...base, id: "r1", name: "Get users", url: "https://api.test/users" }],
  } as never);
}

type Overrides = Partial<{
  generating: boolean;
  online: boolean;
  lastUserText: string | null;
  initial: string;
  threadHasMessages: boolean;
}>;

const editorOf = (box: HTMLElement) => (box as HTMLElement & { editor: Editor }).editor;
/** What the editor reports as its text, pills as `@name` and commands as `/id`. */
const textOf = (box: HTMLElement) => editorOf(box).getText();

/** Types at the caret, so the `@` and `/` triggers see it like real input. */
function type(box: HTMLElement, text: string) {
  act(() => {
    editorOf(box).chain().focus().insertContent(text).run();
  });
}

/** Replaces everything, then places the caret at the end. */
function setText(box: HTMLElement, text: string) {
  act(() => {
    editorOf(box).commands.clearContent();
  });
  if (text) type(box, text);
}

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
  return { onSend, onStop, box: screen.getByTestId("relay-composer") };
}

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

// The pinned "Current tab" row is also an option, so rows are picked by kind.
const pickFirstRequest = () =>
  fireEvent.click(
    screen
      .getAllByTestId("relay-mention-option")
      .find((option) => option.getAttribute("data-kind") === "request") as HTMLElement,
  );

const isEditable = (box: HTMLElement) => box.getAttribute("contenteditable") !== "false";

describe("RelayComposer", () => {
  it("Enter sends the trimmed text and clears the draft", () => {
    const { onSend, box } = setup({ initial: "  hello  " });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("hello");
    expect(textOf(box)).toBe("");
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
    expect(isEditable(box)).toBe(false);
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
    expect(textOf(box)).toBe("previous");
  });

  it("ArrowUp leaves a non-empty draft alone", () => {
    const { box } = setup({ lastUserText: "previous", initial: "typing" });
    fireEvent.keyDown(box, { key: "ArrowUp" });
    expect(textOf(box)).toBe("typing");
  });

  it("ArrowUp with nothing to recall is a no-op", () => {
    const { box } = setup();
    fireEvent.keyDown(box, { key: "ArrowUp" });
    expect(textOf(box)).toBe("");
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

  it("wraps the editor and the toolbar in one bordered box, with no separate pill row", () => {
    setup();
    const composerBox = screen.getByTestId("relay-composer-box");
    expect(composerBox).toHaveClass("rounded-2xl", "border");
    expect(composerBox).toContainElement(screen.getByTestId("relay-composer"));
    const toolbar = screen.getByTestId("relay-composer-toolbar");
    expect(toolbar).toContainElement(screen.getByTestId("relay-picker-trigger"));
    expect(toolbar).toContainElement(screen.getByTestId("relay-send"));
    expect(screen.queryByTestId("relay-composer-pills")).toBeNull();
  });

  it("is a labelled multiline textbox", () => {
    const { box } = setup();
    expect(box).toHaveAttribute("role", "textbox");
    expect(box).toHaveAttribute("aria-multiline", "true");
    expect(box).toHaveAccessibleName("composerLabel");
  });

  it("keeps the editor, +, shield and send in tab order", () => {
    setup({ initial: "hi" });
    const focusable = Array.from(
      screen
        .getByTestId("relay-composer-box")
        .querySelectorAll<HTMLElement>("[contenteditable=true], button"),
    ).map((el) => el.getAttribute("data-testid"));
    expect(focusable).toEqual([
      "relay-composer",
      "relay-picker-trigger",
      "relay-permission-trigger",
      "relay-send",
    ]);
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
    expect(isEditable(box)).toBe(false);
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

  it("enables send as the user types and keeps newlines", () => {
    const { box } = setup();
    type(box, "typed");
    expect(textOf(box)).toBe("typed");
    expect(screen.getByTestId("relay-send")).toBeEnabled();
  });

  describe("whitespace and pills (COMP-07)", () => {
    beforeEach(seedWorkspace);

    it("a pill alone is sendable and goes out as that pill's attachment", () => {
      const { box, onSend } = setup();
      type(box, "@");
      pickFirstRequest();
      expect(screen.getByTestId("relay-send")).toBeEnabled();
      fireEvent.keyDown(box, { key: "Enter" });
      expect(onSend).toHaveBeenCalledWith("@Get users");
      expect(useRelayStore.getState().outgoing?.attachments).toEqual([
        { kind: "request", id: "r1", label: "Get users" },
      ]);
    });

    it("whitespace beside no pill is not sendable", () => {
      const { box, onSend } = setup();
      type(box, "   ");
      expect(screen.getByTestId("relay-send")).toBeDisabled();
      fireEvent.keyDown(box, { key: "Enter" });
      expect(onSend).not.toHaveBeenCalled();
    });

    it("after send the editor, its pills and the derived attachments are empty", () => {
      const { box } = setup();
      type(box, "look @");
      pickFirstRequest();
      expect(useRelayStore.getState().attachedItems).toHaveLength(1);
      fireEvent.keyDown(box, { key: "Enter" });
      expect(textOf(box)).toBe("");
      expect(screen.queryAllByTestId("relay-composer-pill")).toHaveLength(0);
      expect(useRelayStore.getState().attachedItems).toEqual([]);
    });

    it("a deleted entity goes out as a note and not as an attachment", () => {
      const { box, onSend } = setup();
      type(box, "@");
      pickFirstRequest();
      act(() => useCollectionsStore.setState({ requests: [] } as never));
      expect(screen.getByTestId("relay-composer-pill")).toHaveAttribute("data-stale", "true");
      fireEvent.keyDown(box, { key: "Enter" });
      expect(onSend).toHaveBeenCalledWith("composer.pill.stale");
      expect(useRelayStore.getState().outgoing?.attachments).toEqual([]);
    });
  });

  describe("draft opened from an entry point (COMP-04)", () => {
    const chip = { kind: "request", id: "r1", label: "Get users" } as const;

    it("loads the draft with its pills into the editor and takes it once", async () => {
      seedWorkspace();
      const { box } = setup();
      await act(async () =>
        useRelayStore.getState().openWithDraft({
          segments: [
            { type: "attachment", chip },
            { type: "text", text: " Explain this" },
          ],
        }),
      );
      expect(textOf(box)).toBe("@Get users Explain this");
      expect(screen.getAllByTestId("relay-composer-pill")).toHaveLength(1);
      expect(useRelayStore.getState().composerDraft).toBeNull();
      expect(useRelayStore.getState().attachedItems).toEqual([chip]);
    });

    it("clears like any other content once sent", async () => {
      seedWorkspace();
      const { box, onSend } = setup();
      await act(async () =>
        useRelayStore.getState().openWithDraft({
          segments: [
            { type: "attachment", chip },
            { type: "text", text: " Explain" },
          ],
        }),
      );
      fireEvent.keyDown(box, { key: "Enter" });
      expect(onSend).toHaveBeenCalledWith("@Get users Explain");
      expect(screen.queryAllByTestId("relay-composer-pill")).toHaveLength(0);
      expect(useRelayStore.getState().attachedItems).toEqual([]);
    });
  });

  describe("dictation (COMP-08)", () => {
    class FakeRecognition {
      static last: FakeRecognition | null = null;
      onresult: ((e: unknown) => void) | null = null;
      onerror: (() => void) | null = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn();
      abort = vi.fn();
      constructor() {
        FakeRecognition.last = this;
      }
    }

    afterEach(() => {
      delete (window as unknown as Record<string, unknown>).SpeechRecognition;
    });

    it("inserts the words at the caret as text and leaves the pills alone", async () => {
      (window as unknown as Record<string, unknown>).SpeechRecognition =
        FakeRecognition;
      seedWorkspace();
      const { box } = setup();
      await act(async () =>
        useRelayStore.getState().openWithDraft({
          segments: [
            { type: "attachment", chip: { kind: "request", id: "r1", label: "Get users" } },
            { type: "text", text: " explain" },
          ],
        }),
      );
      fireEvent.click(screen.getByTestId("relay-mic"));
      act(() =>
        FakeRecognition.last?.onresult?.({
          resultIndex: 0,
          results: [{ isFinal: true, 0: { transcript: "this please" } }],
        }),
      );
      expect(textOf(box)).toBe("@Get users explain this please");
      expect(screen.getAllByTestId("relay-composer-pill")).toHaveLength(1);
      expect(useRelayStore.getState().attachedItems).toHaveLength(1);
    });
  });

  describe("launcher", () => {
    it("the + button opens the launcher and a second press closes it", () => {
      setup();
      const trigger = screen.getByTestId("relay-picker-trigger");
      expect(trigger).toHaveAccessibleName("picker.add");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(trigger);
      expect(screen.getByTestId("stub-launcher")).toBeInTheDocument();
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      fireEvent.click(trigger);
      expect(screen.queryByTestId("stub-launcher")).toBeNull();
    });

    it("choosing from + inserts a pill and leaves the text alone", async () => {
      const { box } = setup({ initial: "hello" });
      fireEvent.click(screen.getByTestId("relay-picker-trigger"));
      fireEvent.click(screen.getByTestId("stub-pick"));
      expect(textOf(box)).toContain("hello");
      expect(screen.getAllByTestId("relay-composer-pill")).toHaveLength(1);
      expect(useRelayStore.getState().attachedItems).toHaveLength(1);
      // Tiptap focuses on the next frame.
      await waitFor(() => expect(box.contains(document.activeElement)).toBe(true));
    });

    it("closing the launcher without a choice leaves the draft alone and refocuses +", () => {
      const { box } = setup({ initial: "hello" });
      const trigger = screen.getByTestId("relay-picker-trigger");
      fireEvent.click(trigger);
      fireEvent.click(screen.getByTestId("stub-close"));
      expect(textOf(box)).toBe("hello");
      expect(screen.queryByTestId("stub-launcher")).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it("Paste cURL prefills /import and closes the launcher", () => {
      const { box } = setup({ initial: "hello" });
      fireEvent.click(screen.getByTestId("relay-picker-trigger"));
      fireEvent.click(screen.getByTestId("stub-paste-curl"));
      expect(textOf(box)).toBe("/import ");
      expect(screen.queryByTestId("stub-launcher")).toBeNull();
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

    it("closing with restoreFocus=false does not restore focus to trigger", () => {
      setup();
      const trigger = screen.getByTestId("relay-picker-trigger");
      fireEvent.click(trigger);
      fireEvent.click(screen.getByTestId("stub-close-no-focus"));
      expect(screen.queryByTestId("stub-launcher")).toBeNull();
      expect(document.activeElement).not.toBe(trigger);
    });

    it("attaching a tab through the launcher dedupes the same tab", () => {
      setup();
      const trigger = screen.getByTestId("relay-picker-trigger");
      fireEvent.click(trigger);
      fireEvent.click(screen.getByTestId("stub-pick-tab"));
      expect(screen.queryAllByTestId("relay-composer-pill")).toHaveLength(1);
      expect(useRelayStore.getState().attachedItems[0]).toEqual({
        kind: "tab",
        id: "t1",
        label: "Tab 1",
      });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByTestId("stub-pick-tab"));
      expect(screen.queryAllByTestId("relay-composer-pill")).toHaveLength(1);
    });

    it("skips attaching a request already covered by an attached tab", () => {
      useTabsStore.setState({
        tabs: [{ tabId: "t1", name: "Tab 1", url: "", method: "GET", requestId: "r1" }],
        activeTabId: "t1",
      } as never);
      setup();
      const trigger = screen.getByTestId("relay-picker-trigger");
      fireEvent.click(trigger);
      fireEvent.click(screen.getByTestId("stub-pick-tab"));
      fireEvent.click(trigger);
      fireEvent.click(screen.getByTestId("stub-pick"));
      expect(screen.queryAllByTestId("relay-composer-pill")).toHaveLength(1);
      expect(useRelayStore.getState().attachedItems).toEqual([
        { kind: "tab", id: "t1", label: "Tab 1" },
      ]);
      expect(useRelayRecentStore.getState().items).toHaveLength(2);
    });

    it("running a command from the launcher inserts its pill and opens the /run target menu", () => {
      seedOneRequest();
      const { box } = setup();
      fireEvent.click(screen.getByTestId("relay-picker-trigger"));
      fireEvent.click(screen.getByTestId("stub-run-command"));
      expect(screen.queryByTestId("stub-launcher")).toBeNull();
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
      expect(screen.getByText("slash.hint.request")).toBeInTheDocument();
      expect(screen.getByTestId("relay-command-pill")).toBeInTheDocument();
      expect(textOf(box)).toBe("/run ");
    });

    it("a store mention request focuses the menu search, shows its hint and is consumed once", () => {
      seedOneRequest();
      setup();
      act(() =>
        useRelayStore.getState().requestMention({ kind: "request", hintKey: "slash.hint.request" }),
      );
      expect(useRelayStore.getState().mentionRequest).toBeNull();
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
      expect(screen.getByText("slash.hint.request")).toBeInTheDocument();
      expect(document.activeElement).toBe(screen.getByTestId("relay-mention-search"));
    });

    it("Escape in the target menu search closes it and returns focus to the editor", async () => {
      seedOneRequest();
      const { box } = setup();
      act(() =>
        useRelayStore.getState().requestMention({ kind: "request", hintKey: "slash.hint.request" }),
      );
      fireEvent.keyDown(screen.getByTestId("relay-mention-search"), { key: "Escape" });
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
      await waitFor(() => expect(box.contains(document.activeElement)).toBe(true));
    });

    it("picking a target for a store mention request inserts a pill and closes the menu", () => {
      seedOneRequest();
      setup();
      act(() =>
        useRelayStore.getState().requestMention({ kind: "request", hintKey: "slash.hint.request" }),
      );
      pickFirstRequest();
      expect(useRelayStore.getState().attachedItems).toHaveLength(1);
      expect(screen.getAllByTestId("relay-composer-pill")).toHaveLength(1);
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
    });

    it("+ opens the launcher positioned above the composer", () => {
      setup();
      fireEvent.click(screen.getByTestId("relay-picker-trigger"));
      expect(screen.getByTestId("stub-launcher").parentElement?.className).toContain("absolute");
    });
  });

  describe("@ mentions", () => {
    beforeEach(seedWorkspace);

    it("opens for an @ at the start and after a space, never mid-word", () => {
      const { box } = setup();
      type(box, "@");
      expect(screen.getByTestId("relay-mention-menu")).toHaveAttribute("role", "listbox");
      setText(box, "see @");
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
      setText(box, "a@b");
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
    });

    it("stays closed offline", () => {
      const { box } = setup({ online: false });
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
      expect(isEditable(box)).toBe(false);
    });

    it("choosing a request inserts an atomic pill at the caret and records a recent", () => {
      const { box } = setup();
      type(box, "see @");
      pickFirstRequest();
      expect(textOf(box)).toBe("see @Get users ");
      expect(useRelayStore.getState().attachedItems).toEqual([
        { kind: "request", id: "r1", label: "Get users" },
      ]);
      expect(useRelayRecentStore.getState().items).toHaveLength(1);
      const pill = screen.getByTestId("relay-composer-pill");
      expect(pill).toHaveAccessibleName("context.kindRequest: Get users");
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
    });

    it("choosing the same request again adds no second pill", () => {
      const { box } = setup();
      type(box, "@");
      pickFirstRequest();
      type(box, "@");
      pickFirstRequest();
      expect(screen.getAllByTestId("relay-composer-pill")).toHaveLength(1);
      expect(useRelayStore.getState().attachedItems).toHaveLength(1);
      expect(textOf(box)).not.toContain("@@");
    });

    it("Backspace removes the whole pill and its attachment", () => {
      const { box } = setup();
      type(box, "run @");
      pickFirstRequest();
      // Caret sits after the trailing space; one Backspace for it, one for the pill.
      fireEvent.keyDown(box, { key: "Backspace" });
      act(() => {
        editorOf(box).commands.deleteRange({
          from: editorOf(box).state.selection.from - 1,
          to: editorOf(box).state.selection.from,
        });
      });
      fireEvent.keyDown(box, { key: "Backspace" });
      expect(screen.queryByTestId("relay-composer-pill")).toBeNull();
      expect(useRelayStore.getState().attachedItems).toEqual([]);
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
      expect(textOf(box)).toMatch(/^@Get \w+ $/);
    });

    it("Escape closes the menu and keeps the typed text", () => {
      const { box } = setup();
      type(box, "@ge");
      fireEvent.keyDown(box, { key: "Escape" });
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
      expect(textOf(box)).toBe("@ge");
    });

    it("typing another @ after Escape opens the menu again", () => {
      const { box } = setup();
      type(box, "@");
      fireEvent.keyDown(box, { key: "Escape" });
      type(box, " @");
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
    });

    it("after dismissing mention, clearing and retyping @ opens the menu", () => {
      const { box } = setup();
      type(box, "@");
      fireEvent.keyDown(box, { key: "Escape" });
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
      setText(box, "");
      type(box, "@");
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
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
      const { box } = setup();
      type(box, "/");
      expect(options()).toHaveLength(15);
      expect(options()[0]?.getAttribute("data-command")).toBe("explain");
      expect(options().at(-1)?.getAttribute("data-command")).toBe("clear");
    });

    it("also opens mid-sentence after a space", () => {
      const { box } = setup();
      type(box, "hello /");
      expect(screen.getByTestId("relay-slash-menu")).toBeInTheDocument();
    });

    it("narrows as the user types and hides when nothing matches", () => {
      const { box } = setup();
      type(box, "/cl");
      expect(options()).toHaveLength(1);
      type(box, "zz");
      expect(screen.queryByTestId("relay-slash-menu")).toBeNull();
    });

    it("Enter inserts a command pill instead of sending", () => {
      const { box, onSend } = setup();
      type(box, "/import");
      fireEvent.keyDown(box, { key: "Enter" });
      expect(onSend).not.toHaveBeenCalled();
      expect(screen.getByTestId("relay-command-pill")).toBeInTheDocument();
      expect(textOf(box)).toBe("/import ");
      expect(screen.queryByTestId("relay-slash-menu")).toBeNull();
    });

    it("a command pill may sit mid-sentence", () => {
      const { box } = setup();
      type(box, "please /import");
      fireEvent.click(options()[0]);
      expect(textOf(box)).toBe("please /import ");
    });

    it("the command resolves to its prompt at send", () => {
      const { box, onSend } = setup();
      type(box, "/import");
      fireEvent.click(options()[0]);
      fireEvent.keyDown(box, { key: "Enter" });
      expect(onSend).toHaveBeenCalledWith("slash.import.prompt");
      expect(textOf(box)).toBe("");
    });

    it("Escape dismisses the menu and keeps the draft", () => {
      const { box } = setup();
      type(box, "/");
      fireEvent.keyDown(box, { key: "Escape" });
      expect(screen.queryByTestId("relay-slash-menu")).toBeNull();
      expect(textOf(box)).toBe("/");
    });

    it("/run with nothing attached opens the picker and the chosen pill follows the command pill", () => {
      seedOneRequest();
      const { box } = setup();
      type(box, "/run");
      fireEvent.click(options()[0]);
      expect(textOf(box)).toBe("/run ");
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
      expect(screen.getByText("slash.hint.request")).toBeInTheDocument();
      pickFirstRequest();
      expect(textOf(box)).toBe("/run @Get users ");
      expect(useRelayStore.getState().attachedItems).toHaveLength(1);
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
    });

    it("Escape closes the target picker and keeps the command pill", () => {
      seedOneRequest();
      const { box } = setup();
      type(box, "/run");
      fireEvent.click(options()[0]);
      expect(screen.getByTestId("relay-mention-menu")).toBeInTheDocument();
      fireEvent.keyDown(box, { key: "Escape" });
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
      expect(textOf(box)).toBe("/run ");
    });

    it("/clear on an empty thread starts a new conversation with no confirm", () => {
      const { box } = setup();
      type(box, "/cl");
      fireEvent.keyDown(box, { key: "Enter" });
      expect(screen.queryByTestId("relay-clear-confirm")).toBeNull();
      expect(newThread).toHaveBeenCalledTimes(1);
      expect(textOf(box)).toBe("");
    });

    it("/clear on a non-empty thread confirms first", () => {
      const { box } = setup({ threadHasMessages: true });
      type(box, "/cl");
      fireEvent.keyDown(box, { key: "Enter" });
      expect(screen.getByTestId("relay-clear-confirm")).toBeInTheDocument();
      expect(newThread).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId("relay-clear-confirm-button"));
      expect(newThread).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("relay-clear-confirm")).toBeNull();
    });

    it("cancelling the confirm keeps the conversation and returns focus", async () => {
      const { box } = setup({ threadHasMessages: true });
      type(box, "/cl");
      fireEvent.keyDown(box, { key: "Enter" });
      fireEvent.keyDown(screen.getByTestId("relay-clear-confirm"), { key: "Escape" });
      expect(newThread).not.toHaveBeenCalled();
      expect(screen.queryByTestId("relay-clear-confirm")).toBeNull();
      await waitFor(() => expect(box.contains(document.activeElement)).toBe(true));
    });

    it("logs and keeps going when starting the conversation fails", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
      newThread.mockRejectedValueOnce(new Error("quota"));
      const { box } = setup();
      type(box, "/cl");
      fireEvent.keyDown(box, { key: "Enter" });
      await waitFor(() => expect(error).toHaveBeenCalled());
      error.mockRestore();
    });

    it("other keys inside the confirm do not cancel it", () => {
      const { box } = setup({ threadHasMessages: true });
      type(box, "/cl");
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
      expect(textOf(box)).toBe("note from voice");
      expect(onSend).not.toHaveBeenCalled();
    });

    it("disables the mic while offline", () => {
      w.SpeechRecognition = FakeRecognition;
      setup({ online: false });
      expect((screen.getByTestId("relay-mic") as HTMLButtonElement).disabled).toBe(true);
    });

    it("keeps the mic after the shield and before send in tab order", () => {
      w.SpeechRecognition = FakeRecognition;
      setup({ initial: "hi" });
      const focusable = Array.from(
        screen
          .getByTestId("relay-composer-box")
          .querySelectorAll<HTMLElement>("[contenteditable=true], button"),
      ).map((el) => el.getAttribute("data-testid"));
      expect(focusable).toEqual([
        "relay-composer",
        "relay-picker-trigger",
        "relay-permission-trigger",
        "relay-mic",
        "relay-send",
      ]);
    });
  });

  describe("textareaRef", () => {
    const renderWithRef = (ref: Parameters<typeof RelayComposer>[0]["textareaRef"]) =>
      render(
        <RelayComposer
          value=""
          onValueChange={() => undefined}
          onSend={() => undefined}
          onStop={() => undefined}
          generating={false}
          online
          lastUserText={null}
          textareaRef={ref}
        />,
      );

    it("passes the editable element as a callback ref", () => {
      const refCallback = vi.fn();
      renderWithRef(refCallback);
      expect(refCallback).toHaveBeenCalledWith(screen.getByTestId("relay-composer"));
    });

    it("passes the editable element as a mutable object", () => {
      const refObject = { current: null as HTMLElement | null };
      renderWithRef(refObject);
      expect(refObject.current).toBe(screen.getByTestId("relay-composer"));
    });
  });

  describe("tooltips", () => {
    it("names the + and send buttons", () => {
      setup({ initial: "hi" });
      expect(screen.getByTestId("relay-picker-trigger")).toHaveAccessibleName("picker.add");
      expect(screen.getByTestId("relay-send")).toHaveAccessibleName("send");
    });

    it("names the stop button while generating", () => {
      setup({ generating: true });
      expect(screen.getByTestId("relay-stop")).toHaveAccessibleName("stop");
    });
  });

  describe("slash and mention exclusivity", () => {
    it("typing @ right after / leaves no menu open", () => {
      const { box } = setup();
      type(box, "/");
      expect(screen.getByTestId("relay-slash-menu")).toBeInTheDocument();
      type(box, "@");
      expect(screen.queryByTestId("relay-slash-menu")).toBeNull();
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
    });

    it("typing / after an @ query swaps the mention menu for the slash menu", () => {
      const { box } = setup();
      type(box, "@get /");
      expect(screen.queryByTestId("relay-mention-menu")).toBeNull();
      expect(screen.getByTestId("relay-slash-menu")).toBeInTheDocument();
    });
  });

  describe("approval shield", () => {
    it("shows the shield after + and no notice in review mode", () => {
      setup();
      const trigger = screen.getByTestId("relay-permission-trigger");
      expect(trigger.dataset.mode).toBe("review");
      expect(screen.queryByTestId("relay-permission-notice")).toBeNull();
    });

    it("the launcher's Permission mode row closes it and opens the shield popover", () => {
      setup();
      fireEvent.click(screen.getByTestId("relay-picker-trigger"));
      fireEvent.click(screen.getByTestId("stub-open-permission"));

      expect(screen.queryByTestId("stub-launcher")).toBeNull();
      expect(useRelayStore.getState().permissionPopoverOpen).toBe(true);
      expect(screen.getByTestId("relay-permission-trigger")).toHaveAttribute("aria-expanded", "true");
    });

    it("shows the Approvals are off notice only in skip mode", () => {
      useRelayPermissionStore.setState({ mode: "skip" });
      setup();
      const notice = screen.getByTestId("relay-permission-notice");
      expect(notice).toHaveAttribute("role", "status");
      expect(screen.getByTestId("relay-composer-box")).toContainElement(notice);
      act(() => useRelayPermissionStore.setState({ mode: "always-ask" }));
      expect(screen.queryByTestId("relay-permission-notice")).toBeNull();
    });
  });
});
