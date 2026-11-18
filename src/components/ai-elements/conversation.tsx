"use client";

import { ArrowDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

/** Scroll container that follows new content unless the user scrolls up. */
export function Conversation({ className, ...props }: ConversationProps) {
  return (
    <StickToBottom
      className={cn("relative min-h-0 flex-1 overflow-y-hidden", className)}
      initial="smooth"
      resize="smooth"
      role="log"
      {...props}
    />
  );
}

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;

export function ConversationContent({
  className,
  ...props
}: ConversationContentProps) {
  return (
    <StickToBottom.Content
      className={cn("flex flex-col gap-4 p-3", className)}
      {...props}
    />
  );
}

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title: string;
  description?: string;
};

export function ConversationEmptyState({
  title,
  description,
  className,
  children,
  ...props
}: ConversationEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex size-full flex-col items-center justify-center gap-2 p-6 text-center",
        className,
      )}
      {...props}
    >
      {children}
      <h3 className="text-sm font-medium">{title}</h3>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export type ConversationScrollButtonProps = Omit<
  ComponentProps<typeof Button>,
  "onClick" | "children"
> & {
  /** Visible text and accessible name of the pill. */
  label: string;
};

/** "Jump to latest" pill, shown only while scrolled away from the bottom. */
export function ConversationScrollButton({
  label,
  className,
  ...props
}: ConversationScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  const handleClick = useCallback(() => scrollToBottom(), [scrollToBottom]);

  if (isAtBottom) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        "absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-md",
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      <ArrowDownIcon aria-hidden />
      {label}
    </Button>
  );
}
