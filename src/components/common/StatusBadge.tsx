import { cn } from "@/lib/utils";

type StatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  status: number;
};

export function getStatusClasses(status: number): string {
  if (status >= 200 && status < 300)
    return "bg-emerald-500/20 text-emerald-400";
  if (status >= 300 && status < 400) return "bg-blue-500/20 text-blue-400";
  if (status >= 400 && status < 500) return "bg-amber-500/20 text-amber-400";
  if (status >= 500) return "bg-red-500/20 text-red-400";
  return "bg-zinc-500/20 text-zinc-400";
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 font-mono text-xs font-semibold",
        getStatusClasses(status),
        className,
      )}
      {...props}
    >
      {status}
    </span>
  );
}
