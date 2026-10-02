import { Handle, Position } from "@xyflow/react";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ChainNodeState } from "@/types/chain";
import { NodeErrorStrip } from "./NodeErrorStrip";
import { NodeHoverFrame } from "./NodeHoverFrame";
import type { ToolbarAction } from "./NodeToolbar";
import { NODE_HANDLE_CLASS, nodeCardClass, StateIcon } from "./nodeStateStyles";

export type NodeHandleSpec = { id?: string; position: Position };

const DEFAULT_SOURCE_HANDLES: NodeHandleSpec[] = [{ position: Position.Right }];
const SUMMARY_CARD_CLASS = "flex min-w-[180px] items-center gap-2 px-3 py-2";
const INVALID_CARD_CLASS = "border-destructive bg-destructive/10";

type NodeShellProps = {
  testId: string;
  state: ChainNodeState;
  error?: string;
  isKeyboardFocused?: boolean;
  toolbar: ToolbarAction[];
  /** True for nodes that reference something broken (deleted/cyclic); overrides the run-state tint. */
  invalid?: boolean;
  /** Omit on nodes with no incoming edge (Start). */
  hasTargetHandle?: boolean;
  /** Defaults to one handle on the right; pass `[]` when `children` renders its own (Start, Condition). */
  sourceHandles?: NodeHandleSpec[];
  /** Summary layout (icon + title + subtitle). Ignored when `children` supplies a bespoke body. */
  icon?: LucideIcon;
  iconClassName?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Extra line under the subtitle. */
  detail?: ReactNode;
  /** Replaces the run-state icon (e.g. an invalid-reference warning). */
  statusIcon?: ReactNode;
  /** Bespoke card body; switches the card to block layout with an inline error strip. */
  children?: ReactNode;
  cardClassName?: string;
  cardStyle?: CSSProperties;
};

type SummaryProps = Pick<
  NodeShellProps,
  "icon" | "iconClassName" | "title" | "subtitle" | "detail" | "statusIcon"
> & { state: ChainNodeState };

function NodeSummary({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  detail,
  statusIcon,
  state,
}: SummaryProps) {
  const status =
    statusIcon ?? (state !== "idle" ? <StateIcon state={state} /> : null);
  return (
    <>
      {Icon && (
        <Icon className={cn("h-4 w-4 shrink-0", iconClassName)} aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-foreground truncate">
          {title}
        </span>
        <span className="block text-[10px] text-muted-foreground truncate">
          {subtitle}
        </span>
        {detail}
      </div>
      {status && <div className="ml-auto shrink-0">{status}</div>}
    </>
  );
}

/** Shared chrome for block nodes: hover toolbar, state-tinted card, handles and error strip. */
export function NodeShell({
  testId,
  state,
  error,
  isKeyboardFocused,
  toolbar,
  invalid,
  hasTargetHandle = true,
  sourceHandles = DEFAULT_SOURCE_HANDLES,
  children,
  cardClassName,
  cardStyle,
  ...summary
}: NodeShellProps) {
  const isBespoke = children !== undefined;

  return (
    <NodeHoverFrame actions={toolbar} isKeyboardFocused={isKeyboardFocused}>
      <div
        data-testid={testId}
        className={nodeCardClass({
          state,
          isKeyboardFocused,
          className: cn(
            !isBespoke && SUMMARY_CARD_CLASS,
            invalid && INVALID_CARD_CLASS,
            cardClassName,
          ),
        })}
        style={cardStyle}
      >
        {hasTargetHandle && (
          <Handle
            type="target"
            position={Position.Left}
            className={NODE_HANDLE_CLASS}
          />
        )}
        {isBespoke ? children : <NodeSummary state={state} {...summary} />}
        <NodeErrorStrip
          state={state}
          error={error}
          variant={isBespoke ? "inline" : "absolute"}
        />
        {sourceHandles.map(({ id, position }) => (
          <Handle
            key={id ?? position}
            id={id}
            type="source"
            position={position}
            className={NODE_HANDLE_CLASS}
          />
        ))}
      </div>
    </NodeHoverFrame>
  );
}
