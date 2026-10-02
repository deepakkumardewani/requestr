"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BREADCRUMB_SEPARATOR } from "@/lib/pickerTree";
import { cn } from "@/lib/utils";
import type { CollectionFolderModel, CollectionModel } from "@/types";

/** The folder search only earns its space once the tree is long. */
export const FOLDER_SEARCH_THRESHOLD = 8;
const INDENT_PX = 14;
// Base UI needs a non-null item value; this stands for "not saved to a collection".
const CHAIN_ONLY_VALUE = "__chain-only__";

export type TargetSelection = {
  /** `null` means "this chain only" (no collection). */
  collectionId: string | null;
  folderId: string | null;
};

type TargetCollectionPickerProps = {
  collections: readonly CollectionModel[];
  folders: readonly CollectionFolderModel[];
  value: TargetSelection;
  onChange: (next: TargetSelection) => void;
  /** Extra "this chain only" option; defaults on because it is the unsaved path. */
  allowChainOnly?: boolean;
};

type FolderRow = {
  folder: CollectionFolderModel;
  depth: number;
  hasChildren: boolean;
};

function groupByParent(folders: readonly CollectionFolderModel[]) {
  const ids = new Set(folders.map((f) => f.id));
  const children = new Map<string | null, CollectionFolderModel[]>();
  for (const folder of folders) {
    // A missing parent is promoted to the root so the folder stays reachable.
    const key =
      folder.parentFolderId && ids.has(folder.parentFolderId)
        ? folder.parentFolderId
        : null;
    children.set(key, [...(children.get(key) ?? []), folder]);
  }
  for (const list of children.values()) list.sort((a, b) => a.order - b.order);
  return children;
}

function collectReachable(
  children: Map<string | null, CollectionFolderModel[]>,
) {
  const reachable = new Set<string>();
  const visit = (folder: CollectionFolderModel) => {
    if (reachable.has(folder.id)) return;
    reachable.add(folder.id);
    (children.get(folder.id) ?? []).forEach(visit);
  };
  (children.get(null) ?? []).forEach(visit);
  return reachable;
}

/** Depth-first rows; folders trapped in a parent cycle are appended at the root so they stay pickable. */
export function buildFolderRows(
  folders: readonly CollectionFolderModel[],
  expanded: ReadonlySet<string>,
): FolderRow[] {
  const children = groupByParent(folders);
  const rows: FolderRow[] = [];
  const walk = (folder: CollectionFolderModel, depth: number) => {
    const kids = children.get(folder.id) ?? [];
    rows.push({ folder, depth, hasChildren: kids.length > 0 });
    if (!expanded.has(folder.id)) return;
    for (const kid of kids) walk(kid, depth + 1);
  };
  for (const root of children.get(null) ?? []) walk(root, 0);
  // Cycle members are unreachable from any root, whatever is expanded; surface them flat.
  const reachable = collectReachable(children);
  for (const folder of folders) {
    if (!reachable.has(folder.id))
      rows.push({ folder, depth: 0, hasChildren: false });
  }
  return rows;
}

/** "Collection / Folder / Sub"; the cycle guard keeps corrupt data from looping. */
export function buildTargetPath(
  collectionName: string,
  folders: readonly CollectionFolderModel[],
  folderId: string | null,
): string {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const segments: string[] = [];
  const seen = new Set<string>();
  let current = folderId ? byId.get(folderId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    segments.unshift(current.name);
    current = current.parentFolderId
      ? byId.get(current.parentFolderId)
      : undefined;
  }
  return [collectionName, ...segments].join(BREADCRUMB_SEPARATOR);
}

function ancestorIds(
  folders: readonly CollectionFolderModel[],
  folderId: string | null,
) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const ids = new Set<string>();
  let current = folderId ? byId.get(folderId) : undefined;
  while (current?.parentFolderId && !ids.has(current.parentFolderId)) {
    ids.add(current.parentFolderId);
    current = byId.get(current.parentFolderId);
  }
  return ids;
}

type FolderTreeProps = {
  folders: readonly CollectionFolderModel[];
  folderId: string | null;
  onSelect: (folderId: string | null) => void;
};

function FolderTree({ folders, folderId, onSelect }: FolderTreeProps) {
  const t = useTranslations("chain");
  const listId = useId();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() =>
    ancestorIds(folders, folderId),
  );
  const query = search.trim().toLowerCase();

  const rows = useMemo<FolderRow[]>(() => {
    if (query) {
      return folders
        .filter((f) => f.name.toLowerCase().includes(query))
        .map((folder) => ({ folder, depth: 0, hasChildren: false }));
    }
    return buildFolderRows(folders, expanded);
  }, [folders, expanded, query]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-1">
      {folders.length > FOLDER_SEARCH_THRESHOLD && (
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t("apiPickerFolder")}
          data-testid="picker-target-folder-search"
          className="h-7"
        />
      )}
      <div
        role="listbox"
        id={listId}
        aria-label={t("apiPickerFolder")}
        className="max-h-40 overflow-y-auto"
      >
        <FolderOption
          selected={folderId === null}
          depth={0}
          onSelect={() => onSelect(null)}
        >
          {t("apiPickerCollectionRoot")}
        </FolderOption>
        {rows.map(({ folder, depth, hasChildren }) => (
          <FolderOption
            key={folder.id}
            selected={folderId === folder.id}
            depth={depth}
            expandable={hasChildren}
            expanded={expanded.has(folder.id)}
            onToggle={() => toggle(folder.id)}
            onSelect={() => onSelect(folder.id)}
            testId={`picker-target-folder-${folder.id}`}
          >
            {folder.name}
          </FolderOption>
        ))}
      </div>
    </div>
  );
}

type FolderOptionProps = {
  selected: boolean;
  depth: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onSelect: () => void;
  testId?: string;
  children: string;
};

function FolderOption({
  selected,
  depth,
  expandable = false,
  expanded = false,
  onToggle,
  onSelect,
  testId,
  children,
}: FolderOptionProps) {
  const Chevron = expanded ? ChevronDownIcon : ChevronRightIcon;
  return (
    <div
      role="presentation"
      className="flex items-center"
      style={{ paddingLeft: depth * INDENT_PX }}
    >
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={children}
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent"
        >
          <Chevron className="size-3.5" aria-hidden />
        </button>
      ) : (
        <span className="size-6 shrink-0" aria-hidden />
      )}
      <button
        type="button"
        role="option"
        aria-selected={selected}
        data-testid={testId}
        onClick={onSelect}
        className={cn(
          "min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
          selected && "bg-accent font-medium",
        )}
      >
        {children}
      </button>
    </div>
  );
}

export function TargetCollectionPicker({
  collections,
  folders,
  value,
  onChange,
  allowChainOnly = true,
}: TargetCollectionPickerProps) {
  const t = useTranslations("chain");
  const [treeOpen, setTreeOpen] = useState(false);
  const panelId = useId();

  const collection =
    collections.find((c) => c.id === value.collectionId) ?? null;
  const collectionFolders = useMemo(
    () =>
      collection ? folders.filter((f) => f.collectionId === collection.id) : [],
    [collection, folders],
  );
  const folderExists =
    !value.folderId || collectionFolders.some((f) => f.id === value.folderId);

  // A deleted folder (or a collection that vanished) must never linger in the draft.
  useEffect(() => {
    if (value.collectionId && !collection)
      onChange({ collectionId: null, folderId: null });
    else if (!folderExists)
      onChange({ collectionId: value.collectionId, folderId: null });
  }, [collection, folderExists, onChange, value.collectionId]);

  if (collections.length === 0) {
    return (
      <p
        data-testid="picker-target-empty"
        className="text-sm text-muted-foreground"
      >
        {t("apiPickerNoCollections")}
      </p>
    );
  }

  const selectedValue = collection ? collection.id : CHAIN_ONLY_VALUE;
  const activeFolderId = folderExists ? value.folderId : null;
  const path = collection
    ? buildTargetPath(collection.name, collectionFolders, activeFolderId)
    : "";
  const labelFor = (id: string | null) =>
    collections.find((c) => c.id === id)?.name ?? t("apiPickerThisChain");

  const handleCollectionChange = (next: string | null) => {
    setTreeOpen(false);
    onChange({
      collectionId: !next || next === CHAIN_ONLY_VALUE ? null : next,
      folderId: null,
    });
  };

  return (
    <div className="flex flex-col gap-2" data-testid="picker-target">
      <span className="text-xs font-medium text-muted-foreground">
        {t("apiPickerSaveTo")}
      </span>
      <Select value={selectedValue} onValueChange={handleCollectionChange}>
        <SelectTrigger
          className="w-full"
          aria-label={t("apiPickerSaveTo")}
          data-testid="picker-target-collection"
        >
          <SelectValue>{labelFor(value.collectionId)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allowChainOnly && (
            <SelectItem value={CHAIN_ONLY_VALUE}>
              {t("apiPickerThisChain")}
            </SelectItem>
          )}
          {collections.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {collection && collectionFolders.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setTreeOpen((open) => !open)}
            aria-expanded={treeOpen}
            aria-controls={panelId}
            aria-label={`${t("apiPickerFolder")}: ${path}`}
            title={path}
            data-testid="picker-target-path"
            className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="truncate">{path}</span>
            <ChevronDownIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
          </button>
          <div id={panelId} hidden={!treeOpen}>
            {treeOpen && (
              <FolderTree
                folders={collectionFolders}
                folderId={activeFolderId}
                onSelect={(folderId) => {
                  onChange({ collectionId: collection.id, folderId });
                  setTreeOpen(false);
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
