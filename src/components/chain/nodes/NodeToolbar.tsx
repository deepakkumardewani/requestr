import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ToolbarAction = {
  id: string;
  icon: LucideIcon;
  /** Accessible name; also the tooltip text unless `tooltip` is given. */
  label: string;
  tooltip?: string;
  onClick: () => void;
  destructive?: boolean;
  iconClassName?: string;
};

type NodeToolbarProps = {
  actions: ToolbarAction[];
  isKeyboardFocused?: boolean;
  /** Vertical placement; nodes whose wrapper already reserves the gap pass "top-0". */
  className?: string;
};

const ACTION_BUTTON_BASE = "h-6 w-6 rounded-full text-muted-foreground";
const ACTION_BUTTON_DEFAULT = "hover:bg-muted hover:text-primary";
const ACTION_BUTTON_DESTRUCTIVE =
  "hover:bg-destructive/20 hover:text-destructive";

function ToolbarButton({ action }: { action: ToolbarAction }) {
  const { icon: Icon, label, tooltip, onClick, destructive } = action;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(
              ACTION_BUTTON_BASE,
              destructive ? ACTION_BUTTON_DESTRUCTIVE : ACTION_BUTTON_DEFAULT,
            )}
            aria-label={label}
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          />
        }
      >
        <Icon className={cn("h-3 w-3", action.iconClassName)} aria-hidden />
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip ?? label}</TooltipContent>
    </Tooltip>
  );
}

/** Hover/keyboard-focus action pill shared by every chain node. Renders nothing without actions. */
export function NodeToolbar({
  actions,
  isKeyboardFocused,
  className = "-top-9",
}: NodeToolbarProps) {
  if (actions.length === 0) return null;

  return (
    <TooltipProvider delay={400}>
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 hidden items-center gap-0.5 rounded-full border border-border bg-card px-1.5 py-1 shadow-lg z-20 group-hover/node:flex",
          isKeyboardFocused && "flex",
          className,
        )}
      >
        {actions.map((action) => (
          <ToolbarButton key={action.id} action={action} />
        ))}
      </div>
    </TooltipProvider>
  );
}
