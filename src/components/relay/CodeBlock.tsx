"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type HighlightSegment,
  highlightCode,
} from "@/lib/relay/codeHighlight";
import { ApplyCodeAction } from "./ApplyCodeAction";

const COPIED_RESET_MS = 1500;

type CodeBlockProps = {
  code: string;
  /** Fence label such as `json`; null for an unlabelled fence. */
  language: string | null;
};

/**
 * Highlighted segments for `code`, or null while the grammar loads and for
 * languages without one, so the block always has plain text to show.
 */
function useHighlightedSegments(
  code: string,
  language: string | null,
): HighlightSegment[] | null {
  const [state, setState] = useState<{
    code: string;
    segments: HighlightSegment[] | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void highlightCode(code, language).then((segments) => {
      if (!cancelled) setState({ code, segments });
    });
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  // A result for earlier code (streaming) is never shown against newer text.
  return state?.code === code ? state.segments : null;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const t = useTranslations("relay");
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => () => clearTimeout(resetTimer.current), []);
  const segments = useHighlightedSegments(code, language);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch (error) {
      console.error("[relay] copy code failed", error);
      return;
    }
    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }, [code]);

  const label = copied ? t("copied") : t("copyCode");
  return (
    <div className="flex flex-col gap-1.5" data-testid="relay-code-block">
      <div className="group/code relative">
        <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
          <code
            data-highlighted={segments ? "true" : "false"}
            className={language ? `language-${language}` : undefined}
          >
            {segments
              ? segments.map((segment, index) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional and never reordered
                    key={index}
                    className={segment.className ?? undefined}
                  >
                    {segment.text}
                  </span>
                ))
              : code}
          </code>
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
      <ApplyCodeAction code={code} />
    </div>
  );
}
