"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Copy, Play, PlayCircle, Plus, Settings2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { ChainNodeType } from "@/types/chain";

type ContextMenuLabels = {
  addApiAfter: string;
  runUpToHere: string;
  runFromHere: string;
  configure: string;
  duplicate: string;
  deleteNode: string;
};

type MenuEntry = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  isDestructive?: boolean;
  separator?: boolean;
};

type NodeContextMenuProps = {
  x: number;
  y: number;
  requestId: string;
  nodeType: ChainNodeType;
  onClose: () => void;
  onAddAfter: (requestId: string) => void;
  onRunUpTo: (requestId: string) => void;
  onRunFromHere: (requestId: string) => void;
  onDelete: (requestId: string) => void;
  onDuplicate?: (requestId: string) => void;
  onConfigure?: (nodeId: string) => void;
};

const ITEM_CLASS =
  "relative flex cursor-default items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50";

/**
 * Maps each node type to its context menu entries.
 * This record ensures exhaustiveness: adding a new BlockType requires
 * registering its menu entries here, or compilation fails.
 */
function buildMenuEntries(
  nodeType: ChainNodeType,
  requestId: string,
  labels: ContextMenuLabels,
  callbacks: {
    onClose: () => void;
    onAddAfter: (requestId: string) => void;
    onRunUpTo: (requestId: string) => void;
    onRunFromHere: (requestId: string) => void;
    onDelete: (requestId: string) => void;
    onDuplicate?: (requestId: string) => void;
    onConfigure?: (nodeId: string) => void;
  },
): MenuEntry[] {
  const runUpToEntry: MenuEntry = {
    id: "run-up-to",
    label: labels.runUpToHere,
    icon: <Play className="h-4 w-4 shrink-0" />,
    onClick: () => {
      callbacks.onRunUpTo(requestId);
      callbacks.onClose();
    },
  };

  const runFromHereEntry: MenuEntry = {
    id: "run-from-here",
    label: labels.runFromHere,
    icon: <PlayCircle className="h-4 w-4 shrink-0" />,
    onClick: () => {
      callbacks.onRunFromHere(requestId);
      callbacks.onClose();
    },
  };

  const separatorEntry: MenuEntry = {
    id: "separator-1",
    label: "",
    icon: null,
    onClick: () => {},
    separator: true,
  };

  const deleteEntry: MenuEntry = {
    id: "delete",
    label: labels.deleteNode,
    icon: <Trash2 className="h-4 w-4 shrink-0" />,
    onClick: () => {
      callbacks.onDelete(requestId);
      callbacks.onClose();
    },
    isDestructive: true,
  };

  const configureEntry: MenuEntry = {
    id: "configure",
    label: labels.configure,
    icon: <Settings2 className="h-4 w-4 shrink-0" />,
    onClick: () => {
      callbacks.onConfigure?.(requestId);
      callbacks.onClose();
    },
  };

  const menusByType: Record<ChainNodeType, MenuEntry[]> = {
    api: [
      {
        id: "add-api-after",
        label: labels.addApiAfter,
        icon: <Plus className="h-4 w-4 shrink-0" />,
        onClick: () => {
          callbacks.onAddAfter(requestId);
          callbacks.onClose();
        },
      },
      runUpToEntry,
      runFromHereEntry,
      separatorEntry,
      deleteEntry,
    ],

    delay: [runUpToEntry, runFromHereEntry, separatorEntry, deleteEntry],

    merge: [
      configureEntry,
      {
        id: "duplicate",
        label: labels.duplicate,
        icon: <Copy className="h-4 w-4 shrink-0" />,
        onClick: () => {
          callbacks.onDuplicate?.(requestId);
          callbacks.onClose();
        },
      },
      runUpToEntry,
      runFromHereEntry,
      separatorEntry,
      deleteEntry,
    ],

    condition: [
      configureEntry,
      runUpToEntry,
      runFromHereEntry,
      separatorEntry,
      deleteEntry,
    ],

    display: [
      configureEntry,
      {
        id: "duplicate",
        label: labels.duplicate,
        icon: <Copy className="h-4 w-4 shrink-0" />,
        onClick: () => {
          callbacks.onDuplicate?.(requestId);
          callbacks.onClose();
        },
      },
      separatorEntry,
      deleteEntry,
    ],

    // No Duplicate entry — at most one Start per chain, and duplicating a
    // Start would always violate that rule, so it is never offered here
    // (single source of truth for the rule itself is useChainStore).
    start: [
      configureEntry,
      runUpToEntry,
      runFromHereEntry,
      separatorEntry,
      deleteEntry,
    ],

    evaluate: [
      configureEntry,
      {
        id: "duplicate",
        label: labels.duplicate,
        icon: <Copy className="h-4 w-4 shrink-0" />,
        onClick: () => {
          callbacks.onDuplicate?.(requestId);
          callbacks.onClose();
        },
      },
      runUpToEntry,
      runFromHereEntry,
      separatorEntry,
      deleteEntry,
    ],

    loop: [
      configureEntry,
      {
        id: "duplicate",
        label: labels.duplicate,
        icon: <Copy className="h-4 w-4 shrink-0" />,
        onClick: () => {
          callbacks.onDuplicate?.(requestId);
          callbacks.onClose();
        },
      },
      runUpToEntry,
      runFromHereEntry,
      separatorEntry,
      deleteEntry,
    ],

    collect: [
      configureEntry,
      runUpToEntry,
      runFromHereEntry,
      separatorEntry,
      deleteEntry,
    ],

    validate: [
      configureEntry,
      {
        id: "duplicate",
        label: labels.duplicate,
        icon: <Copy className="h-4 w-4 shrink-0" />,
        onClick: () => {
          callbacks.onDuplicate?.(requestId);
          callbacks.onClose();
        },
      },
      runUpToEntry,
      runFromHereEntry,
      separatorEntry,
      deleteEntry,
    ],

    // Full context-menu wiring (picker entry, etc.) owned by P9.7 — this
    // keeps the exhaustive map compiling ahead of that.
    subchain: [
      configureEntry,
      {
        id: "duplicate",
        label: labels.duplicate,
        icon: <Copy className="h-4 w-4 shrink-0" />,
        onClick: () => {
          callbacks.onDuplicate?.(requestId);
          callbacks.onClose();
        },
      },
      runUpToEntry,
      runFromHereEntry,
      separatorEntry,
      deleteEntry,
    ],
  };

  return menusByType[nodeType];
}

export function NodeContextMenu({
  x,
  y,
  requestId,
  nodeType,
  onClose,
  onAddAfter,
  onRunUpTo,
  onRunFromHere,
  onDelete,
  onDuplicate,
  onConfigure,
}: NodeContextMenuProps) {
  // Virtual anchor at cursor coordinates — Base UI Positioner anchors to this
  const anchor = useMemo(
    () => ({
      getBoundingClientRect: (): DOMRect =>
        ({
          x,
          y,
          width: 0,
          height: 0,
          top: y,
          right: x,
          bottom: y,
          left: x,
          toJSON: () => ({}),
        }) as DOMRect,
    }),
    [x, y],
  );

  const t = useTranslations("chain");
  const labels: ContextMenuLabels = {
    addApiAfter: t("contextMenuAddApiAfter"),
    runUpToHere: t("contextMenuRunUpToHere"),
    runFromHere: t("contextMenuRunFromHere"),
    configure: t("contextMenuConfigure"),
    duplicate: t("contextMenuDuplicate"),
    deleteNode: t("contextMenuDeleteNode"),
  };

  const menuEntries = buildMenuEntries(nodeType, requestId, labels, {
    onClose,
    onAddAfter,
    onRunUpTo,
    onRunFromHere,
    onDelete,
    onDuplicate,
    onConfigure,
  });

  return (
    <MenuPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {/* Hidden trigger required by Base UI; layout is overridden by the virtual anchor */}
      <MenuPrimitive.Trigger className="sr-only" aria-hidden />

      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner
          className="isolate z-50 outline-none"
          anchor={anchor}
          side="bottom"
          align="start"
          sideOffset={4}
        >
          <MenuPrimitive.Popup className="z-50 min-w-48 origin-(--transform-origin) overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none">
            {menuEntries.map((entry) =>
              entry.separator ? (
                <MenuPrimitive.Separator
                  key={entry.id}
                  className="-mx-1 my-1 h-px bg-border"
                />
              ) : (
                <MenuPrimitive.Item
                  key={entry.id}
                  className={`${ITEM_CLASS}${
                    entry.isDestructive
                      ? " text-destructive focus:bg-destructive/10 focus:text-destructive"
                      : ""
                  }`}
                  onClick={entry.onClick}
                >
                  {entry.icon}
                  {entry.label}
                </MenuPrimitive.Item>
              ),
            )}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}
