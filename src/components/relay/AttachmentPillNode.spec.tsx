/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import type { CollectionModel, EnvironmentModel, RequestModel } from "@/types";
import { AttachmentPill, AttachmentPillNode, removePillBeforeCaret } from "./AttachmentPillNode";
import { CommandPillNode } from "./CommandPillNode";
import { PromptEditor, segmentsToDoc } from "./PromptEditor";
import type { PromptEditorHandle } from "./editorTypes";

vi.mock("next-intl", async () => (await import("./relayIntlMock")).relayIntlMock());
vi.mock("@/lib/idb", () => ({ getDB: () => null }));

const EXTENSIONS = [AttachmentPillNode, CommandPillNode];

const postRequest = {
  id: "req-create_1",
  name: "Create user",
  method: "POST",
  url: "https://api.test/users",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "json" },
} as unknown as RequestModel;

const apiCollection = {
  id: "col-api_1",
  name: "API Tests",
  folders: [],
  requests: [],
} as unknown as CollectionModel;

const prodEnvironment = {
  id: "env-prod_1",
  name: "Production",
  variables: [],
  isActive: false,
} as unknown as EnvironmentModel;

beforeEach(() => {
  useCollectionsStore.setState({
    collections: [apiCollection],
    requests: [postRequest],
    folders: [],
  });
  useEnvironmentsStore.setState({ environments: [prodEnvironment], activeEnvId: null });
  useChainStore.setState({ chains: {} });
});

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

describe("AttachmentPill", () => {
  it("labels a live request with its kind and name and shows the method", () => {
    render(
      <AttachmentPill
        chip={{ kind: "request", id: "req-create_1", label: "Create user" }}
        deleted={false}
        method="POST"
      />,
    );
    const pill = screen.getByTestId("relay-composer-pill");
    expect(pill.getAttribute("aria-label")).toBe("Request: Create user");
    expect(pill.getAttribute("title")).toBe("Request: Create user");
    expect(pill.getAttribute("role")).toBe("img");
    expect(pill.getAttribute("data-kind")).toBe("request");
    expect(pill.getAttribute("data-stale")).toBe("false");
    expect(screen.getByTestId("relay-pill-method").textContent).toBe("POST");
  });

  it("renders a deleted entity muted with the stale label", () => {
    render(
      <AttachmentPill
        chip={{ kind: "collection", id: "gone", label: "Old API" }}
        deleted
        className="extra-class"
      />,
    );
    const pill = screen.getByTestId("relay-composer-pill");
    expect(pill.getAttribute("aria-label")).toBe("Old API no longer exists");
    expect(pill.getAttribute("data-stale")).toBe("true");
    expect(pill.className).toContain("line-through");
    expect(pill.className).toContain("opacity-60");
    expect(pill.className).toContain("extra-class");
  });

  it("shows a tab as a request pill defaulting to GET", () => {
    render(<AttachmentPill chip={{ kind: "tab", id: "t1", label: "Tab one" }} deleted={false} />);
    expect(screen.getByTestId("relay-composer-pill").getAttribute("aria-label")).toBe("Tab: Tab one");
    expect(screen.getByTestId("relay-pill-method").textContent).toBe("GET");
  });

  it.each([
    ["chain", "Chain: Flow"],
    ["collection", "Collection: Flow"],
    ["environment", "Environment: Flow"],
  ] as const)("labels a %s chip", (kind, expected) => {
    render(<AttachmentPill chip={{ kind, id: "x", label: "Flow" }} deleted={false} />);
    expect(screen.getByTestId("relay-composer-pill").getAttribute("aria-label")).toBe(expected);
  });

  it("redacts secrets in the chip label", () => {
    render(
      <AttachmentPill
        chip={{ kind: "request", id: "r", label: "Bearer abcdef1234567890abcdef" }}
        deleted={false}
      />,
    );
    const label = screen.getByTestId("relay-composer-pill").getAttribute("aria-label");
    expect(label).not.toContain("abcdef1234567890abcdef");
  });
});

describe("AttachmentPillNode in the editor", () => {
  it("renders a live pill with the request method from the store", async () => {
    const { dom } = await mountEditor([
      { type: "attachment", chip: { kind: "request", id: "req-create_1", label: "Create user" } },
    ]);
    const pill = dom.querySelector('[data-testid="relay-composer-pill"]');
    expect(pill?.getAttribute("data-stale")).toBe("false");
    expect(pill?.getAttribute("aria-label")).toBe("Request: Create user");
    expect(dom.querySelector('[data-testid="relay-pill-method"]')?.textContent).toBe("POST");
    expect(dom.querySelector('[data-key="request:req-create_1"]')).not.toBeNull();
  });

  it("marks a pill stale when its entity does not exist", async () => {
    const { dom } = await mountEditor([
      { type: "attachment", chip: { kind: "request", id: "missing", label: "Ghost" } },
    ]);
    const pill = dom.querySelector('[data-testid="relay-composer-pill"]');
    expect(pill?.getAttribute("data-stale")).toBe("true");
    expect(pill?.getAttribute("aria-label")).toBe("Ghost no longer exists");
  });

  it("flips to the deleted state when the entity is removed from the store", async () => {
    const { dom } = await mountEditor([
      { type: "attachment", chip: { kind: "environment", id: "env-prod_1", label: "Production" } },
    ]);
    const selector = '[data-testid="relay-composer-pill"]';
    expect(dom.querySelector(selector)?.getAttribute("data-stale")).toBe("false");
    act(() => {
      useEnvironmentsStore.setState({ environments: [] });
    });
    await waitFor(() => expect(dom.querySelector(selector)?.getAttribute("data-stale")).toBe("true"));
  });

  it("never reports a tab pill as deleted", async () => {
    const { dom } = await mountEditor([
      { type: "attachment", chip: { kind: "tab", id: "tab-1", label: "Scratch" } },
    ]);
    expect(
      dom.querySelector('[data-testid="relay-composer-pill"]')?.getAttribute("data-stale"),
    ).toBe("false");
  });

  it("serialises as an @label token and keeps the chip attrs", async () => {
    const { handleRef } = await mountEditor([
      { type: "text", text: "see " },
      { type: "attachment", chip: { kind: "request", id: "req-create_1", label: "Create user" } },
    ]);
    const serialized = handleRef.current?.getSerialized();
    expect(serialized?.text).toBe("see @Create user");
    expect(serialized?.attachments).toEqual([
      { kind: "request", id: "req-create_1", label: "Create user" },
    ]);
  });

  it("renders the pill as @label in the editor's plain text", async () => {
    const { editor } = await mountEditor([
      { type: "attachment", chip: { kind: "chain", id: "c1", label: "Flow" } },
    ]);
    expect(editor.getText()).toBe("@Flow");
  });

  it("renders to HTML with the pill attribute and parses it back", async () => {
    const { editor } = await mountEditor([
      { type: "attachment", chip: { kind: "chain", id: "c1", label: "Flow" } },
    ]);
    const html = editor.getHTML();
    expect(html).toContain("data-relay-attachment-pill");
    act(() => {
      editor.commands.setContent(html);
    });
    expect(editor.state.doc.firstChild?.firstChild?.attrs).toEqual({
      kind: "chain",
      id: "c1",
      label: "Flow",
    });
  });

  it("falls back to default attrs when parsed without any", async () => {
    const { editor } = await mountEditor();
    act(() => {
      editor.commands.setContent("<p><span data-relay-attachment-pill></span></p>");
    });
    expect(editor.state.doc.firstChild?.firstChild?.attrs).toEqual({
      kind: "request",
      id: "",
      label: "",
    });
  });

  it("Backspace right after a pill removes the whole pill in one keystroke", async () => {
    const { editor, dom } = await mountEditor([
      { type: "text", text: "a" },
      { type: "attachment", chip: { kind: "request", id: "req-create_1", label: "Create user" } },
    ]);
    act(() => {
      editor.commands.focus("end");
    });
    fireEvent.keyDown(dom, { key: "Backspace" });
    expect(dom.querySelector('[data-testid="relay-composer-pill"]')).toBeNull();
    expect(editor.getText()).toBe("a");
  });

  it("Backspace after plain text is left to the default handler", async () => {
    const { editor, dom } = await mountEditor([
      { type: "attachment", chip: { kind: "request", id: "req-create_1", label: "Create user" } },
      { type: "text", text: "ab" },
    ]);
    act(() => {
      editor.commands.focus("end");
    });
    fireEvent.keyDown(dom, { key: "Backspace" });
    expect(dom.querySelector('[data-testid="relay-composer-pill"]')).not.toBeNull();
  });
});

describe("removePillBeforeCaret", () => {
  it("returns false when the caret is not right after the named node", async () => {
    const { editor } = await mountEditor([{ type: "text", text: "abc" }]);
    act(() => {
      editor.commands.focus("end");
    });
    expect(removePillBeforeCaret(editor, "attachmentPill")).toBe(false);
    expect(editor.getText()).toBe("abc");
  });

  it("returns false for a range selection even next to a pill", async () => {
    const { editor } = await mountEditor([
      { type: "text", text: "ab" },
      { type: "attachment", chip: { kind: "request", id: "req-create_1", label: "Create user" } },
    ]);
    act(() => {
      editor.commands.setTextSelection({ from: 1, to: 3 });
    });
    expect(removePillBeforeCaret(editor, "attachmentPill")).toBe(false);
  });

  it("ignores a different pill type before the caret", async () => {
    const { editor } = await mountEditor([{ type: "command", id: "run", label: "/run" }]);
    act(() => {
      editor.commands.focus("end");
    });
    expect(removePillBeforeCaret(editor, "attachmentPill")).toBe(false);
    expect(removePillBeforeCaret(editor, "commandPill")).toBe(true);
  });
});
