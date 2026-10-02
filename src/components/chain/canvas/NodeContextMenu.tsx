"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import {
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Copy,
  Link2,
  Play,
  PlayCircle,
  Plus,
  Settings2,
  StretchHorizontal,
  StretchVertical,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { AlignEdge, DistributeAxis } from "@/lib/nodeAlign";
import type { ChainNodeType } from "@/types/chain";
import { BLOCK_REGISTRY } from "../blockRegistry";

type ContextMenuLabels = {
  addApiAfter: string;
  runUpToHere: string;
  runFromHere: string;
  configure: string;
  changeReference: string;
  duplicate: string;
  deleteNode: string;
  alignLeft: string;
  alignTop: string;
  alignRight: string;
  alignBottom: string;
  distributeHorizontal: string;
  distributeVertical: string;
};

type ActionEntry = {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  isDestructive?: boolean;
  disabled?: boolean;
};

type SeparatorEntry = { id: string; separator: true };

type MenuEntry = ActionEntry | SeparatorEntry;

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
  /** Sub-chain nodes only: reopens the chain picker for the node. */
  onChangeReference?: (nodeId: string) => void;
  /** Number of selected canvas nodes; align/distribute entries need 2+. */
  selectedCount?: number;
  onAlign?: (edge: AlignEdge) => void;
  onDistribute?: (axis: DistributeAxis) => void;
};

const MIN_ALIGN_NODES = 2;
const MIN_DISTRIBUTE_NODES = 3;

const ITEM_CLASS =
  "relative flex cursor-default items-center gap-2 rounded-md px-1.5 py-1 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50";

type MenuCallbacks = {
  onClose: () => void;
  onAddAfter: (requestId: string) => void;
  onRunUpTo: (requestId: string) => void;
  onRunFromHere: (requestId: string) => void;
  onDelete: (requestId: string) => void;
  onDuplicate?: (requestId: string) => void;
  onConfigure?: (nodeId: string) => void;
  onChangeReference?: (nodeId: string) => void;
  selectedCount: number;
  onAlign?: (edge: AlignEdge) => void;
  onDistribute?: (axis: DistributeAxis) => void;
};

const ICON_CLASS = "h-4 w-4 shrink-0";

const SEPARATOR_ENTRY: SeparatorEntry = { id: "separator-1", separator: true };
const ARRANGE_SEPARATOR_ENTRY: SeparatorEntry = {
  id: "separator-arrange",
  separator: true,
};

/** Align/distribute entries; empty unless 2+ nodes are selected. Each runs once and closes the menu. */
function buildArrangeEntries(
  labels: ContextMenuLabels,
  { selectedCount, onAlign, onDistribute, onClose }: MenuCallbacks,
): MenuEntry[] {
  if (selectedCount < MIN_ALIGN_NODES) return [];
  const canDistribute = selectedCount >= MIN_DISTRIBUTE_NODES;
  const align = (
    id: string,
    label: string,
    icon: React.ReactNode,
    edge: AlignEdge,
  ): ActionEntry => ({
    id,
    label,
    icon,
    onClick: () => {
      onAlign?.(edge);
      onClose();
    },
  });
  const spread = (
    id: string,
    label: string,
    icon: React.ReactNode,
    axis: DistributeAxis,
  ): ActionEntry => ({
    id,
    label,
    icon,
    disabled: !canDistribute,
    onClick: () => {
      onDistribute?.(axis);
      onClose();
    },
  });
  return [
    ARRANGE_SEPARATOR_ENTRY,
    align(
      "align-left",
      labels.alignLeft,
      <AlignStartVertical className={ICON_CLASS} />,
      "left",
    ),
    align(
      "align-top",
      labels.alignTop,
      <AlignStartHorizontal className={ICON_CLASS} />,
      "top",
    ),
    align(
      "align-right",
      labels.alignRight,
      <AlignEndVertical className={ICON_CLASS} />,
      "right",
    ),
    align(
      "align-bottom",
      labels.alignBottom,
      <AlignEndHorizontal className={ICON_CLASS} />,
      "bottom",
    ),
    spread(
      "distribute-horizontal",
      labels.distributeHorizontal,
      <StretchHorizontal className={ICON_CLASS} />,
      "horizontal",
    ),
    spread(
      "distribute-vertical",
      labels.distributeVertical,
      <StretchVertical className={ICON_CLASS} />,
      "vertical",
    ),
  ];
}

/**
 * Builds the entries for `nodeType` from its registry capability flags, so a
 * new block type needs no change here. Order is fixed: add-after, configure,
 * change-reference (sub-chain), duplicate, run, separator, delete.
 */
function buildMenuEntries(
  nodeType: ChainNodeType,
  requestId: string,
  labels: ContextMenuLabels,
  callbacks: MenuCallbacks,
): MenuEntry[] {
  const { canAddAfter, configurable, canDuplicate, canRun } =
    BLOCK_REGISTRY[nodeType];

  const entry = (
    id: string,
    label: string,
    icon: React.ReactNode,
    action?: (id: string) => void,
  ): ActionEntry => ({
    id,
    label,
    icon,
    onClick: () => {
      action?.(requestId);
      callbacks.onClose();
    },
  });

  return [
    ...(canAddAfter
      ? [
          entry(
            "add-api-after",
            labels.addApiAfter,
            <Plus className={ICON_CLASS} />,
            callbacks.onAddAfter,
          ),
        ]
      : []),
    ...(configurable
      ? [
          entry(
            "configure",
            labels.configure,
            <Settings2 className={ICON_CLASS} />,
            callbacks.onConfigure,
          ),
        ]
      : []),
    ...(nodeType === "subchain" && callbacks.onChangeReference
      ? [
          entry(
            "change-reference",
            labels.changeReference,
            <Link2 className={ICON_CLASS} />,
            callbacks.onChangeReference,
          ),
        ]
      : []),
    ...(canDuplicate
      ? [
          entry(
            "duplicate",
            labels.duplicate,
            <Copy className={ICON_CLASS} />,
            callbacks.onDuplicate,
          ),
        ]
      : []),
    ...(canRun
      ? [
          entry(
            "run-up-to",
            labels.runUpToHere,
            <Play className={ICON_CLASS} />,
            callbacks.onRunUpTo,
          ),
          entry(
            "run-from-here",
            labels.runFromHere,
            <PlayCircle className={ICON_CLASS} />,
            callbacks.onRunFromHere,
          ),
        ]
      : []),
    ...buildArrangeEntries(labels, callbacks),
    SEPARATOR_ENTRY,
    {
      ...entry(
        "delete",
        labels.deleteNode,
        <Trash2 className={ICON_CLASS} />,
        callbacks.onDelete,
      ),
      isDestructive: true,
    },
  ];
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
  onChangeReference,
  selectedCount = 0,
  onAlign,
  onDistribute,
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
    changeReference: t("contextMenuChangeReference"),
    duplicate: t("contextMenuDuplicate"),
    deleteNode: t("contextMenuDeleteNode"),
    alignLeft: t("alignLeft"),
    alignTop: t("alignTop"),
    alignRight: t("alignRight"),
    alignBottom: t("alignBottom"),
    distributeHorizontal: t("distributeHorizontal"),
    distributeVertical: t("distributeVertical"),
  };

  const menuEntries = buildMenuEntries(nodeType, requestId, labels, {
    onClose,
    onAddAfter,
    onRunUpTo,
    onRunFromHere,
    onDelete,
    onDuplicate,
    onConfigure,
    onChangeReference,
    selectedCount,
    onAlign,
    onDistribute,
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
              "separator" in entry ? (
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
                  disabled={entry.disabled}
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
