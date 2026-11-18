/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AttachmentPillNode } from "./AttachmentPillNode";
import { CommandPill, CommandPillNode } from "./CommandPillNode";
import { PromptEditor, segmentsToDoc } from "./PromptEditor";
import type { PromptEditorHandle } from "./editorTypes";

vi.mock("next-intl", async () => (await import("./relayIntlMock")).relayIntlMock());
vi.mock("@/lib/idb", () => ({ getDB: () => null }));

const EXTENSIONS = [AttachmentPillNode, CommandPillNode];

afterEach(cleanup);

async function mountEditor(initial?: Parameters<typeof segmentsToDoc>[0]) {
  let editor: Editor | null = null;
  const handleRef: { current: PromptEditorHandle | null } = { current: null };
  render(
    <PromptEditor
      label="Message"
      placeholder="Ask"
      onSend={vi.fn()}
      extensions={EXTENSIONS}
      initialContent={initial ? segmentsToDoc(initial) : undefined}
      onReady={(e) => {
        editor = e ?? editor;
      }}
      handleRef={(h) => {
        handleRef.current = h;
      }}
    />,
  );
  const dom = await screen.findByTestId("relay-composer");
  await waitFor(() => expect(editor).not.toBeNull());
  return { editor: editor as unknown as Editor, dom, handleRef };
}

describe("CommandPill", () => {
  it("renders the command name with an accessible name and description tooltip", () => {
    render(<CommandPill id="run" className="extra" />);
    const pill = screen.getByTestId("relay-command-pill");
    expect(pill.getAttribute("role")).toBe("img");
    expect(pill.getAttribute("data-command")).toBe("run");
    expect(pill.textContent).toContain("/run");
    expect(pill.getAttribute("aria-label")?.startsWith("/run: ")).toBe(true);
    expect(pill.getAttribute("title")).toBe(pill.getAttribute("aria-label")?.slice("/run: ".length));
    expect(pill.className).toContain("extra");
  });

  it("renders nothing for an unknown command id", () => {
    const { container } = render(<CommandPill id={"nope" as never} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("CommandPillNode in the editor", () => {
  it("renders a command pill in the middle of a sentence", async () => {
    const { dom, handleRef } = await mountEditor([
      { type: "text", text: "please " },
      { type: "command", id: "run", label: "/run" },
      { type: "text", text: " the login request" },
    ]);
    expect(dom.querySelector('[data-testid="relay-command-pill"]')?.getAttribute("data-command")).toBe("run");
    const serialized = handleRef.current?.getSerialized();
    expect(serialized?.text).toBe("please /run the login request");
    expect(serialized?.commands).toEqual([{ id: "run", label: "/run" }]);
    expect(serialized?.segments.map((segment) => segment.type)).toEqual(["text", "command", "text"]);
  });

  it("renders the pill as /id in the editor's plain text", async () => {
    const { editor } = await mountEditor([{ type: "command", id: "run", label: "/run" }]);
    expect(editor.getText()).toBe("/run");
  });

  it("renders to HTML with the pill attribute and parses it back", async () => {
    const { editor } = await mountEditor([{ type: "command", id: "run", label: "/run" }]);
    const html = editor.getHTML();
    expect(html).toContain("data-relay-command-pill");
    act(() => {
      editor.commands.setContent(html);
    });
    expect(editor.state.doc.firstChild?.firstChild?.attrs).toEqual({ id: "run", label: "/run" });
  });

  it("falls back to default attrs when parsed without any", async () => {
    const { editor } = await mountEditor();
    act(() => {
      editor.commands.setContent("<p><span data-relay-command-pill></span></p>");
    });
    expect(editor.state.doc.firstChild?.firstChild?.attrs).toEqual({ id: "", label: "" });
  });

  it("Backspace right after the pill removes it in one keystroke", async () => {
    const { editor, dom } = await mountEditor([
      { type: "text", text: "go " },
      { type: "command", id: "run", label: "/run" },
    ]);
    act(() => {
      editor.commands.focus("end");
    });
    fireEvent.keyDown(dom, { key: "Backspace" });
    expect(dom.querySelector('[data-testid="relay-command-pill"]')).toBeNull();
    expect(editor.getText()).toBe("go ");
  });
});
