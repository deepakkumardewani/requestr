"use client";

import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Placeholder, UndoRedo } from "@tiptap/extensions";
import { Fragment, Slice } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import {
  type Editor,
  EditorContent,
  type Extensions,
  type JSONContent,
  useEditor,
} from "@tiptap/react";
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { RELAY_COMPOSER_MAX_HEIGHT_PX } from "@/lib/relay/constants";
import {
  plainTextContent,
  serializeEditorDoc,
} from "@/lib/relay/editorSerializer";
import { cn } from "@/lib/utils";
import {
  ATTACHMENT_PILL_NODE,
  COMMAND_PILL_NODE,
  type PromptEditorHandle,
  type PromptSegment,
  type SerializedEditor,
} from "./editorTypes";

/** min-h-12 (3rem) keeps two lines of room at rest, matching the old textarea's two rows. */
const EDITOR_CLASS =
  "min-h-12 min-w-0 px-3 pt-3 pb-1 text-sm leading-6 outline-none break-words whitespace-pre-wrap [&_p]:m-0 [&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-muted-foreground [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]";

type PromptEditorProps = {
  /** Initial document; the editor owns its content afterwards. */
  initialContent?: JSONContent;
  label: string;
  placeholder: string;
  disabled?: boolean;
  testId?: string;
  /**
   * Pill nodes and suggestion triggers contributed by the composer. Must be a
   * stable reference: a new array rebuilds the editor and loses the caret.
   */
  extensions?: Extensions;
  /** Hands the live editor to the composer, and null when it goes away. */
  onReady?: (editor: Editor | null) => void;
  /** DOM id of the highlighted menu row, announced while focus stays in the editor. */
  activeDescendantId?: string | null;
  onChange?: (serialized: SerializedEditor) => void;
  /** Enter outside a composition, with no Shift held. */
  onSend: () => void;
  /** Runs first; return true to claim the key (open menus, history recall). */
  onKeyDown?: (event: KeyboardEvent) => boolean;
  handleRef?: Ref<PromptEditorHandle>;
};

function segmentToNodes(segment: PromptSegment): JSONContent[] {
  if (segment.type === "text") return plainTextContent(segment.text);
  if (segment.type === "attachment") {
    const { kind, id, label } = segment.chip;
    return [{ type: ATTACHMENT_PILL_NODE, attrs: { kind, id, label } }];
  }
  return [
    {
      type: COMMAND_PILL_NODE,
      attrs: { id: segment.id, label: segment.label },
    },
  ];
}

/** Ordered text and pills as an editor document, the inverse of the serializer. */
export function segmentsToDoc(segments: readonly PromptSegment[]): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: segments.flatMap(segmentToNodes) }],
  };
}

/** Plain text to inline nodes: each line is a text node, joined by hard breaks. */
function textToFragment(view: EditorView, text: string): Fragment {
  const { schema } = view.state;
  return Fragment.fromJSON(schema, plainTextContent(text));
}

function pastePlainText(view: EditorView, event: ClipboardEvent): boolean {
  const text = event.clipboardData?.getData("text/plain");
  if (!text) return false;
  event.preventDefault();
  const slice = new Slice(textToFragment(view, text), 0, 0);
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
  return true;
}

const WHITESPACE = /\s/;

/** Dictated words arrive trimmed; keep them apart from the word before the caret. */
function spacedAtCaret(editor: Editor, text: string): string {
  const phrase = text.trim();
  const { from } = editor.state.selection;
  const before = from > 1 ? editor.state.doc.textBetween(from - 1, from) : "";
  return before && !WHITESPACE.test(before) ? ` ${phrase}` : phrase;
}

const NO_EXTENSIONS: Extensions = [];

export function PromptEditor({
  initialContent,
  label,
  placeholder,
  disabled = false,
  testId = "relay-composer",
  extensions = NO_EXTENSIONS,
  onReady,
  activeDescendantId = null,
  onChange,
  onSend,
  onKeyDown,
  handleRef,
}: PromptEditorProps) {
  // Handlers change every render; the editor is created once and reads them here.
  const latest = useRef({ onSend, onKeyDown, onChange });
  latest.current = { onSend, onKeyDown, onChange };

  const allExtensions = useMemo(
    () => [
      Document,
      Paragraph,
      Text,
      HardBreak,
      UndoRedo,
      Placeholder.configure({ placeholder }),
      ...extensions,
    ],
    [placeholder, extensions],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: allExtensions,
      content: initialContent,
      editable: !disabled,
      editorProps: {
        attributes: {
          class: EDITOR_CLASS,
          role: "textbox",
          "aria-label": label,
          "aria-multiline": "true",
          "data-testid": testId,
        },
        handlePaste: (view, event) => pastePlainText(view, event),
        handleKeyDown: (view, event) => {
          if (latest.current.onKeyDown?.(event)) return true;
          const isSendKey = event.key === "Enter" && !event.shiftKey;
          // `composing` covers IME input where keyCode 229 hides the real key.
          if (!isSendKey || event.isComposing || view.composing) return false;
          event.preventDefault();
          latest.current.onSend();
          return true;
        },
      },
      onUpdate: ({ editor: current }) =>
        latest.current.onChange?.(serializeEditorDoc(current.getJSON())),
    },
    [allExtensions, label, testId],
  );

  useEffect(() => {
    // No update event: toggling editability must not report the content as a user change.
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);

  useEffect(() => {
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);

  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    if (activeDescendantId)
      dom.setAttribute("aria-activedescendant", activeDescendantId);
    else dom.removeAttribute("aria-activedescendant");
  }, [editor, activeDescendantId]);

  useImperativeHandle(
    handleRef,
    () => ({
      focus: () => editor?.commands.focus(),
      clear: () => {
        editor?.commands.clearContent(true);
      },
      insertTextAtCaret: (text) => {
        if (!editor) return;
        editor
          .chain()
          .focus()
          .insertContent(plainTextContent(spacedAtCaret(editor, text)))
          .run();
      },
      getSerialized: () =>
        serializeEditorDoc(editor?.getJSON() ?? { type: "doc", content: [] }),
    }),
    [editor],
  );

  return (
    <EditorContent
      editor={editor}
      className={cn("overflow-y-auto", disabled && "opacity-60")}
      style={{ maxHeight: RELAY_COMPOSER_MAX_HEIGHT_PX }}
    />
  );
}
