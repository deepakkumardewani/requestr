import {
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  LoaderCircleIcon,
  WrenchIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Mirrors the AI SDK tool part states that Relay renders. */
export type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

const STATE_ICON: Record<ToolState, ReactNode> = {
  "input-streaming": (
    <LoaderCircleIcon
      className="size-4 animate-spin motion-reduce:animate-none"
      aria-hidden
    />
  ),
  "input-available": (
    <LoaderCircleIcon
      className="size-4 animate-spin motion-reduce:animate-none"
      aria-hidden
    />
  ),
  "output-available": (
    <CircleCheckIcon className="size-4 text-green-600" aria-hidden />
  ),
  "output-error": (
    <CircleAlertIcon className="size-4 text-destructive" aria-hidden />
  ),
};

export function Tool({ className, ...props }: ComponentProps<"details">) {
  return (
    <details
      className={cn(
        "group/tool w-full rounded-lg border bg-card text-sm",
        className,
      )}
      {...props}
    />
  );
}

export type ToolHeaderProps = Omit<ComponentProps<"summary">, "title"> & {
  title: string;
  state: ToolState;
  /** Localised text for the state, shown next to the icon. */
  stateLabel: string;
};

export function ToolHeader({
  title,
  state,
  stateLabel,
  className,
  ...props
}: ToolHeaderProps) {
  return (
    <summary
      className={cn(
        "flex cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden",
        className,
      )}
      {...props}
    >
      <WrenchIcon className="size-4 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {STATE_ICON[state]}
        {stateLabel}
      </span>
      <ChevronRightIcon
        className="size-4 text-muted-foreground transition-transform group-open/tool:rotate-90 motion-reduce:transition-none"
        aria-hidden
      />
    </summary>
  );
}

export function ToolContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("space-y-3 border-t p-3", className)} {...props} />;
}

type ToolBlockProps = { label: string; value: unknown };

function stringify(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function ToolBlock({
  label,
  value,
  tone,
}: ToolBlockProps & { tone?: "error" }) {
  return (
    <section className="space-y-1">
      <h4 className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </h4>
      <pre
        className={cn(
          "max-h-60 overflow-auto rounded-md bg-muted p-2 text-xs",
          tone === "error" && "bg-destructive/10 text-destructive",
        )}
      >
        {stringify(value)}
      </pre>
    </section>
  );
}

export function ToolInput(props: ToolBlockProps) {
  return <ToolBlock {...props} />;
}

export function ToolOutput({
  label,
  output,
  errorText,
}: {
  label: string;
  output?: unknown;
  errorText?: string;
}) {
  if (errorText)
    return <ToolBlock label={label} value={errorText} tone="error" />;
  if (output === undefined) return null;
  return <ToolBlock label={label} value={output} />;
}
