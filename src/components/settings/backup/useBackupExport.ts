"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BACKUP_SELECTABLE_SECTIONS,
  type BackupSection,
} from "@/lib/backup/constants";
import {
  collectBackupData,
  type PreparedBackup,
  prepareBackup,
  toBackupBlob,
} from "@/lib/backup/exporter";

export type ExportMode = "everything" | "choose";

/** The three kinds of item the user can tick one by one in Choose mode. */
export const ITEM_KINDS = ["collections", "environments", "chains"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export type BackupItem = { id: string; name: string };
export type BackupItems = Record<ItemKind, BackupItem[]>;
export type SelectedIds = Record<ItemKind, ReadonlySet<string>>;

const EMPTY_ITEMS: BackupItems = {
  collections: [],
  environments: [],
  chains: [],
};

/** Conversations can hold values shared with Relay, so they start unticked. */
const DEFAULT_SECTIONS: readonly BackupSection[] =
  BACKUP_SELECTABLE_SECTIONS.filter((section) => section !== "relayThreads");

const BYTES_PER_KB = 1024;
const SIZE_UNITS = ["B", "KB", "MB", "GB"] as const;

/** "1.4 MB"; one decimal above bytes. */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= BYTES_PER_KB && unit < SIZE_UNITS.length - 1) {
    value /= BYTES_PER_KB;
    unit += 1;
  }
  const text = unit === 0 ? String(value) : value.toFixed(1);
  return `${text} ${SIZE_UNITS[unit]}`;
}

function backupFileName(exportedAt: string): string {
  return `requestr-backup-${exportedAt.slice(0, 10)}.json`;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** An unnamed record is listed by its id, so it can still be told apart. */
function toItems(list: unknown[] | undefined): BackupItem[] {
  return (list ?? []).map((raw) => {
    const record = raw as { id?: unknown; name?: unknown };
    const id = String(record.id);
    return {
      id,
      name: typeof record.name === "string" && record.name ? record.name : id,
    };
  });
}

type ExportOptionsState = {
  mode: ExportMode;
  sections: ReadonlySet<BackupSection>;
  includeSecrets: boolean;
  selected: SelectedIds;
};

function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

/** Everything exports every section; Choose narrows by section and by ticked item. */
function buildOptions(state: ExportOptionsState, items: BackupItems) {
  if (state.mode === "everything") {
    return {
      sections: BACKUP_SELECTABLE_SECTIONS,
      includeSecrets: state.includeSecrets,
    };
  }
  const selectionFor = (kind: ItemKind) =>
    state.sections.has(kind) && items[kind].length > 0
      ? [...state.selected[kind]]
      : undefined;
  return {
    sections: [...state.sections],
    includeSecrets: state.includeSecrets,
    selection: {
      collectionIds: selectionFor("collections"),
      environmentIds: selectionFor("environments"),
      chainIds: selectionFor("chains"),
    },
  };
}

export function useBackupExport() {
  const [mode, setMode] = useState<ExportMode>("everything");
  const [sections, setSections] = useState<ReadonlySet<BackupSection>>(
    new Set(DEFAULT_SECTIONS),
  );
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [items, setItems] = useState<BackupItems>(EMPTY_ITEMS);
  const [selected, setSelected] = useState<SelectedIds>({
    collections: new Set(),
    environments: new Set(),
    chains: new Set(),
  });
  const [prepared, setPrepared] = useState<PreparedBackup | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    collectBackupData(ITEM_KINDS)
      .then((data) => {
        if (cancelled) return;
        const loaded: BackupItems = {
          collections: toItems(data.collections),
          environments: toItems(data.environments),
          chains: toItems(data.chains),
        };
        setItems(loaded);
        setSelected({
          collections: new Set(loaded.collections.map((i) => i.id)),
          environments: new Set(loaded.environments.map((i) => i.id)),
          chains: new Set(loaded.chains.map((i) => i.id)),
        });
      })
      .catch((error: unknown) => {
        console.error("Backup export: could not list items", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    () => buildOptions({ mode, sections, includeSecrets, selected }, items),
    [mode, sections, includeSecrets, selected, items],
  );

  useEffect(() => {
    let cancelled = false;
    prepareBackup(options)
      .then((result) => {
        if (!cancelled) {
          setPrepared(result);
          setFailed(false);
        }
      })
      .catch((error: unknown) => {
        console.error("Backup export: could not prepare backup", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [options]);

  const toggleSection = useCallback(
    (section: BackupSection) => setSections((prev) => toggled(prev, section)),
    [],
  );
  const toggleItem = useCallback(
    (kind: ItemKind, id: string) =>
      setSelected((prev) => ({ ...prev, [kind]: toggled(prev[kind], id) })),
    [],
  );

  const download = useCallback(() => {
    if (!prepared) return;
    downloadBlob(
      toBackupBlob(prepared),
      backupFileName(prepared.envelope.exportedAt),
    );
  }, [prepared]);

  const hasContent = options.sections.length > 0;

  return {
    mode,
    setMode,
    sections:
      mode === "everything" ? new Set(BACKUP_SELECTABLE_SECTIONS) : sections,
    toggleSection,
    includeSecrets,
    setIncludeSecrets,
    items,
    selected,
    toggleItem,
    prepared,
    failed,
    canDownload: hasContent && prepared !== null && !failed,
    download,
  };
}
