/**
 * Syntax highlighting for fenced code in replies (FR-183). Every grammar is
 * imported on demand, so none of it reaches a bundle until a code block renders
 * (NFR-5). Output is plain text segments with class names, never markup, so
 * model output is still shown as data (NFR-2).
 */

type Tree = import("@lezer/common").Tree;
type Parser = { parse(input: string): Tree };

export type HighlightLanguage =
  | "json"
  | "javascript"
  | "typescript"
  | "shell"
  | "xml";

export type HighlightSegment = {
  text: string;
  /** Null for text that has no token style. */
  className: string | null;
};

/** Fence labels (lowercase) that map to an installed grammar; anything else stays plain text. */
const LANGUAGE_ALIASES: Record<string, HighlightLanguage> = {
  json: "json",
  jsonc: "json",
  javascript: "javascript",
  js: "javascript",
  jsx: "javascript",
  typescript: "typescript",
  ts: "typescript",
  tsx: "typescript",
  bash: "shell",
  sh: "shell",
  shell: "shell",
  zsh: "shell",
  xml: "xml",
  html: "xml",
};

/** Maps a fence label such as `JSON` or `ts` to a grammar, or null when it has none. */
export function resolveHighlightLanguage(
  label: string | null | undefined,
): HighlightLanguage | null {
  if (!label) return null;
  return Object.hasOwn(LANGUAGE_ALIASES, label.toLowerCase())
    ? LANGUAGE_ALIASES[label.toLowerCase()]
    : null;
}

/** Extracts the label from a markdown class such as `language-json`. */
export function languageFromClassName(
  className: string | null | undefined,
): string | null {
  const match = /(?:^|\s)language-(\S+)/.exec(className ?? "");
  return match ? match[1] : null;
}

const PARSER_LOADERS: Record<HighlightLanguage, () => Promise<Parser>> = {
  json: async () => (await import("@codemirror/lang-json")).jsonLanguage.parser,
  javascript: async () =>
    (await import("@codemirror/lang-javascript")).javascriptLanguage.parser,
  typescript: async () =>
    (await import("@codemirror/lang-javascript")).typescriptLanguage.parser,
  shell: async () => {
    const [{ StreamLanguage }, { shell }] = await Promise.all([
      import("@codemirror/language"),
      import("@codemirror/legacy-modes/mode/shell"),
    ]);
    return StreamLanguage.define(shell).parser;
  },
  xml: async () => {
    const [{ StreamLanguage }, { xml }] = await Promise.all([
      import("@codemirror/language"),
      import("@codemirror/legacy-modes/mode/xml"),
    ]);
    return StreamLanguage.define(xml).parser;
  },
};

/** Tailwind classes per token family, readable in light and dark. */
const TOKEN_CLASSES = {
  keyword: "text-purple-700 dark:text-purple-400",
  string: "text-green-700 dark:text-green-400",
  number: "text-amber-700 dark:text-amber-400",
  literal: "text-orange-700 dark:text-orange-400",
  property: "text-sky-700 dark:text-sky-400",
  name: "text-teal-700 dark:text-teal-400",
  comment: "italic text-muted-foreground",
  punctuation: "text-muted-foreground",
} as const;

async function loadHighlighter() {
  const { highlightTree, tagHighlighter, tags } = await import(
    "@lezer/highlight"
  );
  const highlighter = tagHighlighter([
    {
      tag: [tags.keyword, tags.operatorKeyword, tags.controlKeyword],
      class: TOKEN_CLASSES.keyword,
    },
    {
      tag: [tags.string, tags.special(tags.string), tags.regexp],
      class: TOKEN_CLASSES.string,
    },
    { tag: tags.number, class: TOKEN_CLASSES.number },
    { tag: [tags.bool, tags.null, tags.atom], class: TOKEN_CLASSES.literal },
    {
      tag: [tags.propertyName, tags.attributeName],
      class: TOKEN_CLASSES.property,
    },
    {
      tag: [tags.tagName, tags.typeName, tags.className, tags.variableName],
      class: TOKEN_CLASSES.name,
    },
    {
      tag: [tags.comment, tags.lineComment, tags.blockComment],
      class: TOKEN_CLASSES.comment,
    },
    {
      tag: [tags.punctuation, tags.separator, tags.bracket],
      class: TOKEN_CLASSES.punctuation,
    },
  ]);
  return { highlighter, highlightTree };
}

/**
 * Splits `code` into styled and unstyled segments that concatenate back to the
 * exact input. Resolves to null when the language has no grammar or loading
 * fails, so the caller keeps showing plain text.
 */
export async function highlightCode(
  code: string,
  label: string | null | undefined,
): Promise<HighlightSegment[] | null> {
  const language = resolveHighlightLanguage(label);
  if (!language) return null;
  try {
    const [parser, { highlighter, highlightTree }] = await Promise.all([
      PARSER_LOADERS[language](),
      loadHighlighter(),
    ]);
    const segments: HighlightSegment[] = [];
    let position = 0;
    const pushPlain = (to: number) => {
      if (to > position) {
        segments.push({ text: code.slice(position, to), className: null });
      }
    };
    highlightTree(parser.parse(code), highlighter, (from, to, className) => {
      pushPlain(from);
      segments.push({ text: code.slice(from, to), className });
      position = to;
    });
    pushPlain(code.length);
    return segments;
  } catch (error) {
    console.error("[relay] code highlighting failed", { language, error });
    return null;
  }
}
