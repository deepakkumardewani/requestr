"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Children,
  isValidElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";

const COPIED_RESET_MS = 1500;

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

function CodeBlock({ children }: { children?: ReactNode }) {
  const t = useTranslations("relay");
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        nodeText(children).replace(/\n$/, ""),
      );
    } catch (error) {
      console.error("[relay] copy code failed", error);
      return;
    }
    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }, [children]);

  const label = copied ? t("copied") : t("copyCode");
  return (
    <div className="group/code relative">
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
        {children}
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={label}
        title={label}
        data-testid="relay-copy-code"
        onClick={handleCopy}
        className="absolute right-1.5 top-1.5"
      >
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      </Button>
    </div>
  );
}

const COMPONENTS: Components = {
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  code: ({ className, children }) => (
    <code
      className={
        className ?? "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
      }
    >
      {children}
    </code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2"
    >
      {children}
    </a>
  ),
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
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
    <th className="border px-2 py-1 text-left font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border px-2 py-1">{children}</td>,
};

type RelayMarkdownProps = {
  text: string;
};

/**
 * Renders model output as Markdown. No raw-HTML plugin is installed, so any
 * HTML the model emits is shown as literal text, never as markup (FR-23).
 */
export function RelayMarkdown({ text }: RelayMarkdownProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2 break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
