import { describe, expect, it } from "vitest";
import type {
  EditorNode,
  SerializedEditor,
} from "@/components/relay/editorTypes";
import type { ContextChip } from "@/lib/relay/chips";
import {
  isSendable,
  plainTextContent,
  serializeEditorDoc,
  toOutgoingText,
  withDeletedPills,
} from "./editorSerializer";

const para = (...content: EditorNode[]): EditorNode => ({
  type: "paragraph",
  content,
});
const doc = (...content: EditorNode[]): EditorNode => ({
  type: "doc",
  content,
});
const text = (value: string): EditorNode => ({ type: "text", text: value });
const pill = (
  kind: string,
  id: string,
  label: string,
  extra: Record<string, unknown> = {},
): EditorNode => ({
  type: "attachmentPill",
  attrs: { kind, id, label, ...extra },
});
const command = (id: string, label: string): EditorNode => ({
  type: "commandPill",
  attrs: { id, label },
});

const requestChip: ContextChip = { kind: "request", id: "r1", label: "Login" };

describe("serializeEditorDoc", () => {
  it("returns empty output for an empty doc", () => {
    expect(serializeEditorDoc({ type: "doc" })).toEqual({
      text: "",
      segments: [],
      attachments: [],
      commands: [],
    });
  });

  it("serialises text, a pill and a command in order", () => {
    const result = serializeEditorDoc(
      doc(
        para(
          command("explain", "Explain"),
          text(" this "),
          pill("request", "r1", "Login"),
        ),
      ),
    );
    expect(result.text).toBe("/explain this @Login");
    expect(result.segments).toEqual([
      { type: "command", id: "explain", label: "Explain" },
      { type: "text", text: " this " },
      { type: "attachment", chip: requestChip },
    ]);
    expect(result.attachments).toEqual([requestChip]);
    expect(result.commands).toEqual([{ id: "explain", label: "Explain" }]);
  });

  it("joins paragraphs with a newline and hard breaks as newlines, merging text runs", () => {
    const result = serializeEditorDoc(
      doc(para(text("a"), { type: "hardBreak" }, text("b")), para(text("c"))),
    );
    expect(result.text).toBe("a\nb\nc");
    expect(result.segments).toEqual([{ type: "text", text: "a\nb\nc" }]);
  });

  it("treats an empty paragraph as an empty line", () => {
    const result = serializeEditorDoc(
      doc(para(text("a")), { type: "paragraph" }, para(text("b"))),
    );
    expect(result.text).toBe("a\n\nb");
  });

  it("treats each non-paragraph top-level node as its own block", () => {
    const result = serializeEditorDoc(doc(text("x"), pill("tab", "t", "Tab")));
    expect(result.text).toBe("x\n@Tab");
  });

  it("dedupes attachments by kind and id", () => {
    const result = serializeEditorDoc(
      doc(
        para(
          pill("request", "r1", "Login"),
          pill("request", "r1", "Login"),
          pill("collection", "r1", "Login"),
        ),
      ),
    );
    expect(result.segments).toHaveLength(3);
    expect(result.attachments.map((chip) => chip.kind)).toEqual([
      "request",
      "collection",
    ]);
  });

  it("keeps the deleted flag only when it is exactly true", () => {
    const result = serializeEditorDoc(
      doc(
        para(
          pill("request", "r1", "A", { deleted: true }),
          pill("request", "r2", "B", { deleted: "yes" }),
        ),
      ),
    );
    expect(result.segments).toEqual([
      {
        type: "attachment",
        chip: { kind: "request", id: "r1", label: "A" },
        deleted: true,
      },
      {
        type: "attachment",
        chip: { kind: "request", id: "r2", label: "B" },
      },
    ]);
  });

  it("drops empty text, unknown nodes and incomplete pills", () => {
    const result = serializeEditorDoc(
      doc(
        para(
          { type: "text" },
          { type: "mystery" },
          { type: "attachmentPill" },
          pill("", "x", "No kind"),
          pill("request", "", "No id"),
          { type: "commandPill", attrs: { id: 5 } },
          { type: "commandPill" },
          text("ok"),
        ),
      ),
    );
    expect(result.segments).toEqual([{ type: "text", text: "ok" }]);
  });

  it("defaults a non-string label to an empty string", () => {
    const result = serializeEditorDoc(
      doc(
        para({
          type: "attachmentPill",
          attrs: { kind: "tab", id: "t1", label: 3 },
        }),
      ),
    );
    expect(result.attachments).toEqual([{ kind: "tab", id: "t1", label: "" }]);
  });
});

describe("isSendable", () => {
  const serialize = (...nodes: EditorNode[]) =>
    serializeEditorDoc(doc(para(...nodes)));

  it("is false for empty and whitespace-only input", () => {
    expect(isSendable(serialize())).toBe(false);
    expect(isSendable(serialize(text("  \t"), { type: "hardBreak" }))).toBe(
      false,
    );
  });

  it("is true for text", () => {
    expect(isSendable(serialize(text(" hi ")))).toBe(true);
  });

  it("is true for a pill-only or command-only composer", () => {
    expect(isSendable(serialize(pill("request", "r1", "Login")))).toBe(true);
    expect(isSendable(serialize(command("docs", "Docs")))).toBe(true);
  });
});

describe("plainTextContent", () => {
  it("returns no nodes for empty text", () => {
    expect(plainTextContent("")).toEqual([]);
  });

  it("joins lines with hard breaks for LF and CRLF", () => {
    expect(plainTextContent("a\r\nb\n\nc")).toEqual([
      { type: "text", text: "a" },
      { type: "hardBreak" },
      { type: "text", text: "b" },
      { type: "hardBreak" },
      { type: "hardBreak" },
      { type: "text", text: "c" },
    ]);
  });

  it("never parses markup as HTML", () => {
    expect(plainTextContent("<b>x</b>")).toEqual([
      { type: "text", text: "<b>x</b>" },
    ]);
  });
});

describe("withDeletedPills", () => {
  const serialized = serializeEditorDoc(
    doc(
      para(
        text("see "),
        pill("request", "r1", "Gone"),
        pill("request", "r2", "Live"),
      ),
    ),
  );
  const isGone = (chip: ContextChip) => chip.id === "r1";

  it("flags deleted pills and removes them from attachments", () => {
    const result = withDeletedPills(serialized, isGone);
    expect(result.segments).toEqual([
      { type: "text", text: "see " },
      {
        type: "attachment",
        chip: { kind: "request", id: "r1", label: "Gone" },
        deleted: true,
      },
      {
        type: "attachment",
        chip: { kind: "request", id: "r2", label: "Live" },
      },
    ]);
    expect(result.attachments).toEqual([
      { kind: "request", id: "r2", label: "Live" },
    ]);
    expect(result.text).toBe(serialized.text);
  });

  it("does not mutate its input", () => {
    withDeletedPills(serialized, isGone);
    expect(serialized.attachments).toHaveLength(2);
  });
});

describe("toOutgoingText", () => {
  const options = {
    promptFor: (id: string) => (id === "explain" ? "Please explain" : undefined),
    deletedNote: (label: string) => `[${label} was deleted]`,
  };

  it("resolves commands, notes deleted pills, keeps live pills and trims", () => {
    const serialized: SerializedEditor = withDeletedPills(
      serializeEditorDoc(
        doc(
          para(
            command("explain", "Explain"),
            text(" "),
            pill("request", "r1", "Gone"),
            text(" and "),
            pill("request", "r2", "Live"),
            text(" "),
            command("docs", "Docs"),
            text("  "),
          ),
        ),
      ),
      (chip) => chip.id === "r1",
    );
    expect(toOutgoingText(serialized, options)).toBe(
      "Please explain [Gone was deleted] and @Live /docs",
    );
  });
});
