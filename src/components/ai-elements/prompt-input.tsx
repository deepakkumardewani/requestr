"use client";

import { ArrowUpIcon, SquareIcon } from "lucide-react";
import type {
  ComponentProps,
  FormEvent,
  HTMLAttributes,
  KeyboardEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type PromptInputProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit: () => void;
};

/** Form shell; the owner keeps the draft so it can recall and clear it. */
export function PromptInput({
  onSubmit,
  className,
  ...props
}: PromptInputProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

export type PromptInputTextareaProps = ComponentProps<typeof Textarea>;

/** Enter submits, Shift+Enter inserts a newline, IME composition is respected. */
export function PromptInputTextarea({
  onKeyDown,
  className,
  ...props
}: PromptInputTextareaProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };
  return (
    <Textarea
      onKeyDown={handleKeyDown}
      className={cn("min-h-0 resize-none", className)}
      {...props}
    />
  );
}

export function PromptInputFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between gap-2", className)}
      {...props}
    />
  );
}

export type PromptInputSubmitProps = Omit<
  ComponentProps<typeof Button>,
  "type" | "children" | "aria-label"
> & {
  /** While true the button stops the stream instead of sending. */
  generating: boolean;
  sendLabel: string;
  stopLabel: string;
  onStop: () => void;
};

/** Send/Stop toggle: submits the form, or aborts the in-flight reply. */
export function PromptInputSubmit({
  generating,
  sendLabel,
  stopLabel,
  onStop,
  onClick,
  ...props
}: PromptInputSubmitProps) {
  const label = generating ? stopLabel : sendLabel;
  return (
    <Button
      type={generating ? "button" : "submit"}
      size="icon"
      aria-label={label}
      title={label}
      onClick={generating ? onStop : onClick}
      {...props}
    >
      {generating ? <SquareIcon aria-hidden /> : <ArrowUpIcon aria-hidden />}
    </Button>
  );
}
