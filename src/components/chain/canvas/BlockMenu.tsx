"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ConnectFrom } from "@/stores/useChainStore";
import type { ChainNodeType } from "@/types/chain";
import { BlockMenuPanel } from "./BlockMenuPanel";
import type { AddBlockFn } from "./useAddBlock";

type Point = { x: number; y: number };

type BlockMenuProps = {
  disabled?: boolean;
  /** Hides the Start entry once the chain already has one — at most one Start per chain. */
  hasStartNode?: boolean;
  onAddBlock: AddBlockFn;
};

type AnchoredBlockMenuProps = {
  /** Screen (client) coordinates the menu opens at — the cursor. */
  anchor: Point;
  /** Flow-space position the chosen block is placed at (no click-to-place ghost). */
  position?: Point;
  /** Dangling connection the chosen block attaches to (connection-drop mode). */
  connectFrom?: ConnectFrom;
  hasStartNode?: boolean;
  /** Hides blocks that cannot receive a connection. */
  hideWithoutTargetHandle?: boolean;
  onAddBlock: AddBlockFn;
  /** Called on selection, Esc and outside click; the owner restores canvas focus. */
  onClose: () => void;
};

const POPUP_CLASS =
  "z-50 w-72 origin-(--transform-origin) rounded-lg bg-popover p-0 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none";

/** Toolbar "Add block" trigger with its popover list. */
export function BlockMenu({
  disabled,
  hasStartNode,
  onAddBlock,
}: BlockMenuProps) {
  const t = useTranslations("chain");
  const blockMenuContentId = useId();
  const [open, setOpen] = useState(false);

  function handleSelect(type: ChainNodeType) {
    setOpen(false);
    onAddBlock(type);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-testid="block-menu-trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={blockMenuContentId}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {t("blockMenuTrigger")}
      </PopoverTrigger>
      <PopoverContent
        id={blockMenuContentId}
        className="w-72 p-0"
        side="bottom"
        align="start"
        sideOffset={6}
      >
        <BlockMenuPanel
          hasStartNode={hasStartNode}
          searchPlaceholder={t("blockMenuSearchPlaceholder")}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * A connection drag released over empty canvas opens the menu on pointer-up, and the
 * browser then dispatches the gesture's own `click`, which Base UI reads as an outside
 * press. That click was stamped before the menu existed, so it is not a real dismissal.
 */
function isTrailingGestureClick(
  details: { reason: string; event: Event },
  openedAt: number,
): boolean {
  return (
    details.reason === "outside-press" &&
    details.event.type === "click" &&
    details.event.timeStamp <= openedAt
  );
}

/** Block list opened at the cursor: the pane right-click menu and the connection-drop menu. */
export function AnchoredBlockMenu({
  anchor,
  position,
  connectFrom,
  hasStartNode,
  hideWithoutTargetHandle,
  onAddBlock,
  onClose,
}: AnchoredBlockMenuProps) {
  const t = useTranslations("chain");
  const virtualAnchor = useMemo(
    () => ({
      getBoundingClientRect: (): DOMRect =>
        new DOMRect(anchor.x, anchor.y, 0, 0),
    }),
    [anchor.x, anchor.y],
  );

  // Captured at mount so the click that finishes the opening gesture can be told apart.
  const [openedAt] = useState(() => performance.now());

  function handleSelect(type: ChainNodeType) {
    onClose();
    onAddBlock(type, { position, connectFrom });
  }

  return (
    <PopoverPrimitive.Root
      open
      onOpenChange={(open, details) => {
        if (!open && !isTrailingGestureClick(details, openedAt)) onClose();
      }}
    >
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          className="isolate z-50"
          anchor={virtualAnchor}
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <PopoverPrimitive.Popup
            data-testid="pane-block-menu"
            aria-label={t("paneMenuTitle")}
            className={POPUP_CLASS}
            finalFocus={false}
          >
            <BlockMenuPanel
              hasStartNode={hasStartNode}
              hideWithoutTargetHandle={hideWithoutTargetHandle}
              searchPlaceholder={t("paneMenuSearch")}
              onSelect={handleSelect}
            />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
