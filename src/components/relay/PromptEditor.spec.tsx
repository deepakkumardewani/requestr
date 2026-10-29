/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PromptEditorHandle, SerializedEditor } from "./editorTypes";
import { AttachmentPillNode } from "./AttachmentPillNode";
import { CommandPillNode } from "./CommandPillNode";
import { PromptEditor, segmentsToDoc } from "./PromptEditor";

vi.mock("next-intl", async () => (await import("./relayIntlMock")).relayIntlMock());
vi.mock("@/lib/idb", () => ({ getDB: () => null }));

const PILL_EXTENSIONS = [AttachmentPillNode, CommandPillNode];
const TEST_ID = "relay-composer";

type HarnessProps = Partial<React.ComponentProps<typeof PromptEditor>>;

function setup(props: HarnessProps = {}) {
  const onSend = vi.fn();
  const onChange = vi.fn<(s: SerializedEditor) => void>();
  const onReady = vi.fn<(e: Editor | null) => void>();
  const handleRef = createRef<PromptEditorHandle>();
  const utils = render(
    <PromptEditor
      label="Message Relay"
      placeholder="Ask anything"
      onSend={onSend}
      onChange={onChange}
      onReady={onReady}
      handleRef={handleRef}
      extensions={PILL_EXTENSIONS}
      {...props}
    />,
  );
  return { ...utils, onSend, onChange, onReady, handleRef };
}

async function getEditorDom() {
  return screen.findByTestId(TEST_ID);
}

function liveEditor(onReady: ReturnType<typeof vi.fn<(e: Editor | null) => void>>): Editor {
  const editor = onReady.mock.calls.map((call) => call[0]).findLast(Boolean);
  if (!editor) throw new Error("editor not ready");
  return editor;
}

function pasteEvent(text: string | undefined) {
  return {
    clipboardData: { getData: (type: string) => (type === "text/plain" ? (text ?? "") : "") },
  };
}

afterEach(cleanup);

describe("segmentsToDoc", () => {
  it("maps text, attachment and command segments to one paragraph in order", () => {
    const doc = segmentsToDoc([
      { type: "text", text: "see " },
      { type: "attachment", chip: { kind: "request", id: "r1", label: "Get users" } },
      { type: "command", id: "run", label: "/run" },
    ]);
    expect(doc).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "see " },
            { type: "attachmentPill", attrs: { kind: "request", id: "r1", label: "Get users" } },
            { type: "commandPill", attrs: { id: "run", label: "/run" } },
          ],
        },
      ],
    });
  });

  it("yields an empty paragraph for no segments", () => {
    expect(segmentsToDoc([])).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [] }],
    });
  });
});

describe("PromptEditor rendering", () => {
  it("exposes an accessible multiline textbox with the label", async () => {
    setup();
    const dom = await getEditorDom();
    expect(dom.getAttribute("role")).toBe("textbox");
    expect(dom.getAttribute("aria-label")).toBe("Message Relay");
    expect(dom.getAttribute("aria-multiline")).toBe("true");
  });

  it("shows the placeholder on an empty document", async () => {
    setup();
    const dom = await getEditorDom();
    const paragraph = dom.querySelector("p");
    expect(paragraph?.getAttribute("data-placeholder")).toBe("Ask anything");
  });

  it("renders initialContent", async () => {
    setup({ initialContent: segmentsToDoc([{ type: "text", text: "hello world" }]) });
    const dom = await getEditorDom();
    expect(dom.textContent).toContain("hello world");
  });

  it("uses a custom test id", async () => {
    setup({ testId: "custom-editor" });
    expect(await screen.findByTestId("custom-editor")).toBeTruthy();
  });

  it("is non-editable and dimmed when disabled", async () => {
    const { container } = setup({ disabled: true });
    const dom = await getEditorDom();
    expect(dom.getAttribute("contenteditable")).toBe("false");
    expect(container.firstElementChild?.className).toContain("opacity-60");
  });

  it("toggles editability without reporting a content change", async () => {
    const { rerender, onChange, onSend } = setup();
    const dom = await getEditorDom();
    expect(dom.getAttribute("contenteditable")).toBe("true");
    rerender(
      <PromptEditor
        label="Message Relay"
        placeholder="Ask anything"
        onSend={onSend}
        onChange={onChange}
        extensions={PILL_EXTENSIONS}
        disabled
      />,
    );
    await waitFor(() => expect(dom.getAttribute("contenteditable")).toBe("false"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("PromptEditor onReady", () => {
  it("hands over the editor and then null on unmount", async () => {
    const { onReady, unmount } = setup();
    await waitFor(() => expect(onReady.mock.calls.some((call) => call[0] !== null)).toBe(true));
    unmount();
    expect(onReady.mock.calls.at(-1)).toEqual([null]);
  });
});

describe("PromptEditor aria-activedescendant", () => {
  it("sets the attribute and removes it when cleared", async () => {
    const { rerender, onSend } = setup({ activeDescendantId: "row-3" });
    const dom = await getEditorDom();
    await waitFor(() => expect(dom.getAttribute("aria-activedescendant")).toBe("row-3"));
    rerender(
      <PromptEditor
        label="Message Relay"
        placeholder="Ask anything"
        onSend={onSend}
        extensions={PILL_EXTENSIONS}
        activeDescendantId={null}
      />,
    );
    await waitFor(() => expect(dom.hasAttribute("aria-activedescendant")).toBe(false));
  });
});

describe("PromptEditor keyboard", () => {
  it("sends on plain Enter", async () => {
    const { onSend } = setup();
    const dom = await getEditorDom();
    fireEvent.keyDown(dom, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("does not send on Shift+Enter", async () => {
    const { onSend } = setup();
    const dom = await getEditorDom();
    fireEvent.keyDown(dom, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send while an IME composition is active", async () => {
    const { onSend } = setup();
    const dom = await getEditorDom();
    fireEvent.keyDown(dom, { key: "Enter", isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send for other keys", async () => {
    const { onSend } = setup();
    const dom = await getEditorDom();
    fireEvent.keyDown(dom, { key: "a" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("lets onKeyDown claim Enter before send", async () => {
    const onKeyDown = vi.fn(() => true);
    const { onSend } = setup({ onKeyDown });
    const dom = await getEditorDom();
    fireEvent.keyDown(dom, { key: "Enter" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("falls through to send when onKeyDown declines", async () => {
    const onKeyDown = vi.fn(() => false);
    const { onSend } = setup({ onKeyDown });
    const dom = await getEditorDom();
    fireEvent.keyDown(dom, { key: "Enter" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("uses the newest handlers after a rerender without rebuilding the editor", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, onReady } = setup({ onSend: first });
    const dom = await getEditorDom();
    const editorBefore = liveEditor(onReady);
    rerender(
      <PromptEditor
        label="Message Relay"
        placeholder="Ask anything"
        onSend={second}
        extensions={PILL_EXTENSIONS}
        onReady={onReady}
      />,
    );
    fireEvent.keyDown(dom, { key: "Enter" });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(liveEditor(onReady)).toBe(editorBefore);
  });
});

describe("PromptEditor paste", () => {
  it("inserts clipboard text as plain text, keeping line breaks", async () => {
    const { handleRef } = setup();
    const dom = await getEditorDom();
    fireEvent.paste(dom, pasteEvent("line one\nline two"));
    await waitFor(() =>
      expect(handleRef.current?.getSerialized().text).toBe("line one\nline two"),
    );
  });

  it("ignores formatting by taking only text/plain", async () => {
    const { handleRef } = setup();
    const dom = await getEditorDom();
    fireEvent.paste(dom, {
      clipboardData: {
        getData: (type: string) => (type === "text/html" ? "<b>bold</b>" : "plain"),
      },
    });
    await waitFor(() => expect(handleRef.current?.getSerialized().text).toBe("plain"));
    expect(dom.querySelector("b, strong")).toBeNull();
  });

  it("falls back to the default handler when the clipboard has no text", async () => {
    const { handleRef } = setup();
    const dom = await getEditorDom();
    fireEvent.paste(dom, pasteEvent(undefined));
    expect(handleRef.current?.getSerialized().text).toBe("");
  });
});

describe("PromptEditor onChange", () => {
  it("reports the serialized document with pills as segments", async () => {
    const { onChange, onReady } = setup();
    await getEditorDom();
    const editor = liveEditor(onReady);
    act(() => {
      editor
        .chain()
        .insertContent([
          { type: "text", text: "check " },
          { type: "attachmentPill", attrs: { kind: "request", id: "r1", label: "Get users" } },
        ])
        .run();
    });
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last?.text).toBe("check @Get users");
    expect(last?.attachments).toEqual([{ kind: "request", id: "r1", label: "Get users" }]);
  });

  it("drops the attachment from the derived list when its pill is removed", async () => {
    const { onChange, onReady } = setup({
      initialContent: segmentsToDoc([
        { type: "text", text: "x" },
        { type: "attachment", chip: { kind: "request", id: "r1", label: "Get users" } },
      ]),
    });
    await getEditorDom();
    const editor = liveEditor(onReady);
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      editor.commands.deleteSelection();
      editor.commands.command(({ tr, state }) => {
        const end = state.doc.content.size - 1;
        tr.delete(end - 1, end);
        return true;
      });
    });
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last?.attachments).toEqual([]);
  });
});

describe("PromptEditor handle", () => {
  it("getSerialized reflects initial content", async () => {
    const { handleRef } = setup({
      initialContent: segmentsToDoc([{ type: "text", text: "hi" }]),
    });
    await getEditorDom();
    await waitFor(() => expect(handleRef.current?.getSerialized().text).toBe("hi"));
  });

  it("clear empties the document", async () => {
    const { handleRef } = setup({
      initialContent: segmentsToDoc([{ type: "text", text: "hi" }]),
    });
    await getEditorDom();
    act(() => handleRef.current?.clear());
    expect(handleRef.current?.getSerialized().text).toBe("");
  });

  it("focus moves focus into the editor", async () => {
    const { handleRef } = setup();
    const dom = await getEditorDom();
    act(() => handleRef.current?.focus());
    await waitFor(() => expect(document.activeElement).toBe(dom));
  });

  it("insertTextAtCaret inserts text into an empty editor without a leading space", async () => {
    const { handleRef } = setup();
    await getEditorDom();
    act(() => handleRef.current?.insertTextAtCaret("  hello  "));
    expect(handleRef.current?.getSerialized().text).toBe("hello");
  });

  it("insertTextAtCaret adds a space after a word at the caret", async () => {
    const { handleRef, onReady } = setup({
      initialContent: segmentsToDoc([{ type: "text", text: "word" }]),
    });
    await getEditorDom();
    const editor = liveEditor(onReady);
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      handleRef.current?.insertTextAtCaret("next");
    });
    expect(handleRef.current?.getSerialized().text).toBe("word next");
  });

  it("insertTextAtCaret adds no extra space after whitespace", async () => {
    const { handleRef, onReady } = setup({
      initialContent: segmentsToDoc([{ type: "text", text: "word " }]),
    });
    await getEditorDom();
    const editor = liveEditor(onReady);
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      handleRef.current?.insertTextAtCaret("next");
    });
    expect(handleRef.current?.getSerialized().text).toBe("word next");
  });

  it("insertTextAtCaret leaves existing pills untouched", async () => {
    const { handleRef, onReady } = setup({
      initialContent: segmentsToDoc([
        { type: "attachment", chip: { kind: "request", id: "r1", label: "Get users" } },
      ]),
    });
    await getEditorDom();
    const editor = liveEditor(onReady);
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      handleRef.current?.insertTextAtCaret("go");
    });
    const serialized = handleRef.current?.getSerialized();
    expect(serialized?.attachments).toEqual([{ kind: "request", id: "r1", label: "Get users" }]);
    expect(serialized?.text).toContain("go");
  });
});
