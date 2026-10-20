"use client";

import {
  ChevronRightIcon,
  ClipboardPasteIcon,
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  type LucideIcon,
  PanelTopIcon,
  WorkflowIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { CommandItem } from "@/components/ui/command";
import type { PickerItem } from "@/hooks/useRelayPickerItems";
import { type ContextChipKind, chipKey } from "@/lib/relay/chips";
import type { LauncherRow } from "@/lib/relay/launcherItems";
import { SLASH_COMMAND_ICONS } from "@/lib/relay/slashCommands";

const CHIP_KIND_LABEL_KEYS = {
  tab: "kindTab",
  request: "kindRequest",
  chain: "kindChain",
  collection: "kindCollection",
  environment: "kindEnvironment",
} as const satisfies Record<ContextChipKind, string>;

/** Shared by the mention menu and the composer pills so a kind looks the same everywhere. */
export const CHIP_KIND_ICONS = {
  tab: PanelTopIcon,
  request: FileTextIcon,
  chain: WorkflowIcon,
  collection: FolderIcon,
  environment: GlobeIcon,
} as const satisfies Record<ContextChipKind, LucideIcon>;

type RelayPickerRowProps = {
  item: PickerItem;
  /** Zero-based position among all results, for the listbox position announcement. */
  index: number;
  count: number;
  /** Environment values are not sent while Share is off; the row says so (FR-126). */
  valuesHidden: boolean;
  style: CSSProperties;
  onSelect: (item: PickerItem) => void;
};

export function RelayPickerRow({
  item,
  index,
  count,
  valuesHidden,
  style,
  onSelect,
}: RelayPickerRowProps) {
  const t = useTranslations("relay.context");
  const note = item.kind === "environment" && valuesHidden;
  return (
    <CommandItem
      value={chipKey(item)}
      aria-posinset={index + 1}
      aria-setsize={count}
      data-testid="relay-picker-row"
      data-kind={item.kind}
      style={style}
      className="absolute top-0 left-0 w-full"
      onSelect={() => onSelect(item)}
    >
      <span className="shrink-0 text-xs text-muted-foreground">
        {t(CHIP_KIND_LABEL_KEYS[item.kind])}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{item.label}</span>
        {item.detail ? (
          <span className="truncate text-xs text-muted-foreground">
            {item.detail}
          </span>
        ) : null}
      </span>
      {note ? (
        <span
          data-testid="relay-picker-values-hidden"
          className="ml-auto shrink-0 text-xs text-muted-foreground"
        >
          {t("valuesHidden")}
        </span>
      ) : null}
    </CommandItem>
  );
}

const launcherRowIcon = ({ target }: LauncherRow): LucideIcon => {
  if (target.type === "recent") return CHIP_KIND_ICONS[target.chip.kind];
  if (target.type === "action") return SLASH_COMMAND_ICONS[target.command.id];
  if (target.attach === "pasteCurl") return ClipboardPasteIcon;
  return CHIP_KIND_ICONS[
    target.attach === "currentTab" ? "tab" : target.attach
  ];
};

type LauncherRowItemProps = {
  row: LauncherRow;
  onSelect: (row: LauncherRow) => void;
};

/** One launcher row: icon, name, muted description and a chevron when it opens a sub-list. */
export function LauncherRowItem({ row, onSelect }: LauncherRowItemProps) {
  const Icon = launcherRowIcon(row);
  return (
    <CommandItem
      value={row.key}
      keywords={[row.value]}
      disabled={row.disabled}
      showCheck={false}
      data-testid="relay-launcher-row"
      data-section={row.section}
      data-row={row.key}
      className="min-h-11 gap-2.5 py-1.5"
      onSelect={() => onSelect(row)}
    >
      <Icon aria-hidden className="size-4 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium wrap-break-word">{row.name}</span>
        <span className="text-xs text-muted-foreground wrap-break-word">
          {row.description}
        </span>
      </span>
      {row.opensList ? (
        <ChevronRightIcon
          aria-hidden
          data-testid="relay-launcher-chevron"
          className="size-4 text-muted-foreground"
        />
      ) : null}
    </CommandItem>
  );
}
