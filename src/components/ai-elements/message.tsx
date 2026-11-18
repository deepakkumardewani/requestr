import type { ComponentProps, HTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant";
};

/** One chat turn; user turns align right, assistant turns fill the row. */
export function Message({ from, className, ...props }: MessageProps) {
  return (
    <div
      data-from={from}
      className={cn(
        "group flex w-full max-w-[95%] flex-col gap-2",
        from === "user" ? "is-user ml-auto items-end" : "is-assistant",
        className,
      )}
      {...props}
    />
  );
}

export function MessageContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm",
        "group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary group-[.is-user]:px-3 group-[.is-user]:py-2 group-[.is-user]:text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function MessageActions({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-1", className)} {...props} />
  );
}

export type MessageActionProps = Omit<
  ComponentProps<typeof Button>,
  "aria-label"
> & {
  /** Accessible name; also shown as the native tooltip. */
  label: string;
};

export function MessageAction({
  label,
  children,
  ...props
}: MessageActionProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </Button>
  );
}
