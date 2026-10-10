"use client";

import { forwardRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { tokenizeVariables } from "@/lib/variableResolver";

export const VARIABLE_OVERLAY_TEST_ID = "variable-highlight-overlay";

const VARIABLE_STATE_CLASSES = {
  resolved: "rounded-xs bg-primary/15 text-primary",
  unresolved: "rounded-xs bg-destructive/15 text-destructive",
} as const;

type VariableHighlightOverlayProps = {
  value: string;
  /** Variable name -> value for the active environment. Empty values count as unresolved. */
  env: Record<string, string>;
  /** Must match the typography/padding of the input it mirrors. */
  className?: string;
  /** Mirrors the input's disabled dimming. */
  disabled?: boolean;
};

/**
 * Decorative mirror of an input's text, rendered behind a transparent-text
 * input so `{{variables}}` can be highlighted. The input stays the accessible
 * element; the inner span's `scrollLeft` is driven by the parent.
 */
export const VariableHighlightOverlay = forwardRef<
  HTMLSpanElement,
  VariableHighlightOverlayProps
>(function VariableHighlightOverlay(
  { value, env, className, disabled },
  innerRef,
) {
  const tokens = useMemo(() => tokenizeVariables(value, env), [value, env]);

  return (
    <div
      aria-hidden="true"
      data-testid={VARIABLE_OVERLAY_TEST_ID}
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre text-foreground",
        disabled && "opacity-50",
        className,
      )}
    >
      <span ref={innerRef} className="will-change-transform">
        {tokens.map((token, i) => {
          if (!token.isVariable) {
            // biome-ignore lint/suspicious/noArrayIndexKey: tokens have no stable identity
            return <span key={i}>{token.text}</span>;
          }
          const state = token.resolved ? "resolved" : "unresolved";
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: tokens have no stable identity
              key={i}
              data-variable-state={state}
              className={VARIABLE_STATE_CLASSES[state]}
            >
              {token.text}
            </span>
          );
        })}
      </span>
    </div>
  );
});
