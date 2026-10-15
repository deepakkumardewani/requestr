/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RelayComposer } from "./RelayComposer";

afterEach(cleanup);

type Overrides = Partial<{
  generating: boolean;
  online: boolean;
  lastUserText: string | null;
  initial: string;
}>;

function setup({ generating = false, online = true, lastUserText = null, initial = "" }: Overrides = {}) {
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

  it("updates the draft as the user types", () => {
    const { box } = setup();
    fireEvent.change(box, { target: { value: "typed" } });
    expect(box.value).toBe("typed");
    expect(screen.getByTestId("relay-send")).toBeEnabled();
  });
});
