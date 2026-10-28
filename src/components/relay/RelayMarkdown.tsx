"use client";

import { Children, isValidElement, memo, type ReactNode } from "react";
import ReactMarkdown, {
  type Components,
  defaultUrlTransform,
} from "react-markdown";
import remarkGfm from "remark-gfm";
import { getStatusClasses } from "@/components/common/StatusBadge";
import { METHOD_BADGE_CLASSES } from "@/lib/constants";
import { languageFromClassName } from "@/lib/relay/codeHighlight";
import { parseRelayHref, resolveEntity } from "@/lib/relay/entityLinks";
import { tokenizeProse } from "@/lib/relay/tokenize";
import { cn } from "@/lib/utils";
import type { HttpMethod } from "@/types";
import { CodeBlock } from "./CodeBlock";
import { EntityPill } from "./EntityPill";

function nodeText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      return isValidElement<{ children?: ReactNode }>(child)
        ? nodeText(child.props.children)
        : "";
    })
    .join("");
}

/** Pulls the fence label and source text out of the `<code>` element react-markdown puts inside `<pre>`. */
function FencedCode({ children }: { children?: ReactNode }) {
  const codeElement = Children.toArray(children).find(isValidElement);
  const props = (codeElement?.props ?? {}) as {
    className?: string;
    children?: ReactNode;
  };
  return (
    <CodeBlock
      code={nodeText(props.children ?? children).replace(/\n$/, "")}
      language={languageFromClassName(props.className)}
    />
  );
}

const TOKEN_BASE_CLASS = "rounded px-1 font-mono text-[0.85em]";

/** Wraps method words and status codes in coloured spans; the text itself is untouched. */
function colorize(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    return tokenizeProse(child).map((token, index) => {
      if (token.type === "text") return token.value;
      const colour =
        token.type === "method"
          ? METHOD_BADGE_CLASSES[token.value as HttpMethod]
          : getStatusClasses(Number(token.value));
      return (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional and never reordered
          key={index}
          data-testid={`relay-${token.type}`}
          className={cn(TOKEN_BASE_CLASS, colour)}
        >
          {token.value}
        </span>
      );
    });
  });
}

const INLINE_CODE_CLASS =
  "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]";

function RelayLink({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  const link = parseRelayHref(href);
  const entity = link ? resolveEntity(link) : null;
  if (entity) return <EntityPill entity={entity} />;
  // Unknown ids, unknown kinds and stripped unsafe schemes keep only their label.
  if (!href || link) return <span>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
    >
      {children}
    </a>
  );
}

const COMPONENTS: Components = {
  pre: FencedCode,
  code: ({ className, children }) => (
    <code className={className ?? INLINE_CODE_CLASS}>{children}</code>
  ),
  a: RelayLink,
  p: ({ children }) => <p className="leading-relaxed">{colorize(children)}</p>,
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5">{children}</ol>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border px-2 py-1 text-left font-medium">
      {colorize(children)}
    </th>
  ),
  td: ({ children }) => (
    <td className="border px-2 py-1">{colorize(children)}</td>
  ),
  li: ({ children }) => <li>{colorize(children)}</li>,
  strong: ({ children }) => <strong>{colorize(children)}</strong>,
  em: ({ children }) => <em>{colorize(children)}</em>,
};

/** Lets valid `relay://` links through; every other URL gets the default scheme filtering. */
function allowRelayUrl(url: string): string {
  return parseRelayHref(url) ? url : defaultUrlTransform(url);
}

type RelayMarkdownProps = {
  text: string;
};

/**
 * Renders model output as Markdown. No raw-HTML plugin is installed, so any
 * HTML the model emits is shown as literal text, never as markup (FR-23).
 */
export const RelayMarkdown = memo(function RelayMarkdown({
  text,
}: RelayMarkdownProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={COMPONENTS}
        urlTransform={allowRelayUrl}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
