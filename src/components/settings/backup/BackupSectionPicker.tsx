"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BACKUP_SELECTABLE_SECTIONS,
  type BackupSection,
} from "@/lib/backup/constants";
import type { SectionCounts } from "@/lib/backup/sizeEstimate";
import {
  type BackupItems,
  ITEM_KINDS,
  type ItemKind,
  type SelectedIds,
} from "./useBackupExport";

type BackupSectionPickerProps = {
  sections: ReadonlySet<BackupSection>;
  counts: SectionCounts;
  items: BackupItems;
  selected: SelectedIds;
  onToggleSection: (section: BackupSection) => void;
  onToggleItem: (kind: ItemKind, id: string) => void;
};

const isItemKind = (section: BackupSection): section is ItemKind =>
  (ITEM_KINDS as readonly string[]).includes(section);

type ItemListProps = {
  kind: ItemKind;
  items: BackupItems[ItemKind];
  selected: ReadonlySet<string>;
  query: string;
  onToggle: (kind: ItemKind, id: string) => void;
};

function ItemList({ kind, items, selected, query, onToggle }: ItemListProps) {
  const t = useTranslations("settings");
  const needle = query.trim().toLowerCase();
  const visible = items.filter((item) =>
    item.name.toLowerCase().includes(needle),
  );

  if (items.length === 0) return null;
  if (visible.length === 0) {
    return (
      <p className="py-1 pl-6 text-xs text-muted-foreground">
        {t("backup.export.noMatches")}
      </p>
    );
  }
  return (
    <ul
      className="max-h-32 space-y-1 overflow-y-auto pl-6"
      data-testid={`backup-items-${kind}`}
    >
      {visible.map((item) => (
        <li key={item.id}>
          <Label className="gap-2 text-xs font-normal">
            <Checkbox
              checked={selected.has(item.id)}
              onCheckedChange={() => onToggle(kind, item.id)}
              data-testid={`backup-item-${kind}-${item.id}`}
            />
            <span className="truncate">{item.name}</span>
          </Label>
        </li>
      ))}
    </ul>
  );
}

/** Section checkboxes with counts, and searchable item lists for collections, environments and chains. */
export function BackupSectionPicker({
  sections,
  counts,
  items,
  selected,
  onToggleSection,
  onToggleItem,
}: BackupSectionPickerProps) {
  const t = useTranslations("settings");
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-3" data-testid="backup-section-picker">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("backup.export.searchPlaceholder")}
        aria-label={t("backup.export.searchPlaceholder")}
        data-testid="backup-item-search"
      />
      <div className="space-y-2">
        {BACKUP_SELECTABLE_SECTIONS.map((section) => (
          <div key={section} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="gap-2 text-sm">
                <Checkbox
                  checked={sections.has(section)}
                  onCheckedChange={() => onToggleSection(section)}
                  data-testid={`backup-section-${section}`}
                />
                {t(`backup.sections.${section}`)}
              </Label>
              {sections.has(section) && counts[section] !== undefined && (
                <span
                  className="text-xs text-muted-foreground"
                  data-testid={`backup-count-${section}`}
                >
                  {t("backup.export.count", { count: counts[section] ?? 0 })}
                </span>
              )}
            </div>
            {section === "relayThreads" && (
              <p className="pl-6 text-xs text-muted-foreground">
                {t("backup.export.relayThreadsNote")}
              </p>
            )}
            {isItemKind(section) && sections.has(section) && (
              <ItemList
                kind={section}
                items={items[section]}
                selected={selected[section]}
                query={query}
                onToggle={onToggleItem}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
