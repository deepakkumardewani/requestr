import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NodeToolbar, type ToolbarAction } from "./NodeToolbar";

type NodeHoverFrameProps = {
  actions: ToolbarAction[];
  isKeyboardFocused?: boolean;
  children: ReactNode;
};

/**
 * Pointer-transparent strip: the frame itself ignores pointer events so a neighbour's strip
 * never swallows clicks on a node sitting underneath it, while its direct children (card,
 * toolbar) opt back in. The toolbar bridges its own gap to the card (see NodeToolbar).
 */
const STRIP_CLASS = "-mt-9 pt-9 pointer-events-none [&>*]:pointer-events-auto";

/**
 * Hover scope shared by every chain node. The `pt-9` strip (cancelled by `-mt-9`, so the card
 * bounds never move) reserves room for the toolbar above the card. The strip exists only when
 * there are actions.
 */
export function NodeHoverFrame({
  actions,
  isKeyboardFocused,
  children,
}: NodeHoverFrameProps) {
  const hasActions = actions.length > 0;

  return (
    <div className={cn("group/node relative", hasActions && STRIP_CLASS)}>
      <NodeToolbar actions={actions} isKeyboardFocused={isKeyboardFocused} />
      {children}
    </div>
  );
}
