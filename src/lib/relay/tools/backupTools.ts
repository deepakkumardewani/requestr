import type { BackupSection } from "@/lib/backup/constants";
import {
  type BackupOptions,
  collectBackupData,
  prepareBackup,
  toBackupBlob,
} from "@/lib/backup/exporter";
import { restoreBackup } from "@/lib/backup/importer";
import type { BackupData, BackupEnvelope } from "@/lib/backup/schema";
import type { StoreName } from "@/lib/idb";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { type BackupSnapshot, commitChange, type DataKind } from "../changeLog";
import { RELAY_STORAGE_KEYS } from "../constants";
import type { ConfirmPreview, ToolImpl, ToolOutcome } from "./registry";
import type { RelayToolInput } from "./schemas";

/**
 * Backup tools (TOOL-03). Both ask first. The file for an import is chosen on
 * the card and handed over through `stageImportFile`, so its text never
 * reaches the model; the only results are summary counts or "cancelled".
 */

const fail = (error: string): ToolOutcome => ({ ok: false, error });

const NO_FILE_CHOSEN = "no backup file was chosen";
const BACKUP_FILE_PREFIX = "requestr-backup";
const DATE_CHARS = 10;

/** A backup file the user picked on a card, waiting for that card's Approve. */
const stagedImports = new Map<string, BackupEnvelope>();

export function stageImportFile(
  toolCallId: string,
  envelope: BackupEnvelope,
): void {
  stagedImports.set(toolCallId, envelope);
}

export function unstageImportFile(toolCallId: string): void {
  stagedImports.delete(toolCallId);
}

type ExportInput = RelayToolInput<"export_backup">;

/** The exporter's options for a tool call; secrets stay out unless asked for. */
export function backupOptionsFor(input: ExportInput): BackupOptions {
  const selection = {
    ...(input.collectionIds ? { collectionIds: input.collectionIds } : {}),
    ...(input.environmentIds ? { environmentIds: input.environmentIds } : {}),
    ...(input.chainIds ? { chainIds: input.chainIds } : {}),
  };
  return {
    sections: input.sections as BackupSection[],
    includeSecrets: input.includeSecrets === true,
    ...(Object.keys(selection).length > 0 ? { selection } : {}),
  };
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

const exportBackup: ToolImpl<"export_backup"> = {
  name: "export_backup",
  refs: ({ collectionIds, environmentIds, chainIds }) => [
    ...(collectionIds ?? []).map((id) => ({ kind: "collection" as const, id })),
    ...(environmentIds ?? []).map((id) => ({
      kind: "environment" as const,
      id,
    })),
    ...(chainIds ?? []).map((id) => ({ kind: "chain" as const, id })),
  ],
  describe: (input): ConfirmPreview => ({
    action: "change",
    severity: input.includeSecrets === true ? "danger" : "caution",
    targets: [...input.sections],
    count: input.sections.length,
    stepLabel: { key: "activity.tools.export_backup", params: {} },
  }),
  run: async (input) => {
    const prepared = await prepareBackup(backupOptionsFor(input));
    const fileName = `${BACKUP_FILE_PREFIX}-${prepared.envelope.exportedAt.slice(0, DATE_CHARS)}.json`;
    downloadBlob(toBackupBlob(prepared), fileName);
    return {
      ok: true,
      data: {
        summary: "Downloaded a backup",
        fileName,
        counts: prepared.estimate.counts,
        includesSecrets: prepared.envelope.includesSecrets,
      },
    };
  },
};

/** Imports change the stores' source data, so the open stores read it back in. */
async function refreshStores(): Promise<void> {
  await Promise.all([
    useCollectionsStore.getState().hydrate(),
    useEnvironmentsStore.getState().hydrate(),
    useChainStore.getState().hydrate(),
    useSettingsStore.getState().hydrate(),
  ]);
}

/** The workspace lists an import can add to, and the entity kind each holds. */
const IMPORT_LISTS = [
  ["collections", "collection"],
  ["folders", "folder"],
  ["requests", "request"],
  ["chains", "chain"],
  ["environments", "environment"],
] as const satisfies readonly (readonly [keyof BackupData, DataKind])[];

/** Lists a merge also writes: the backup key, the row's key field and its IDB store. */
const EXTRA_LISTS = [
  ["chainConfigs", "collectionId", "chainConfigs"],
  ["history", "id", "history"],
  ["chainRuns", "id", "chainRuns"],
  ["relayThreads", "id", "relay_threads"],
  ["relayChanges", "id", "relay_changes"],
] as const satisfies readonly (readonly [
  keyof BackupData,
  string,
  StoreName,
])[];

type Row = Record<string, unknown>;

const rowsOf = (data: BackupData, key: keyof BackupData): Row[] =>
  (data[key] as Row[] | undefined) ?? [];

const addedKeys = (
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): string[] =>
  Object.keys(after ?? {}).filter((key) => !(key in (before ?? {})));

function diffExtras(before: BackupData, after: BackupData): BackupSnapshot {
  const addedRows: NonNullable<BackupSnapshot["addedRows"]> = [];
  for (const [dataKey, keyField, store] of EXTRA_LISTS) {
    const known = new Set(rowsOf(before, dataKey).map((r) => r[keyField]));
    for (const row of rowsOf(after, dataKey)) {
      if (!known.has(row[keyField])) {
        addedRows.push({ store, key: String(row[keyField]) });
      }
    }
  }
  return {
    added: [],
    overwritten: [],
    addedRows,
    addedSettingKeys: addedKeys(before.settings, after.settings),
    addedPreferenceKeys: addedKeys(before.preferences, after.preferences),
  };
}

/** What a merge added (new ids) and replaced (same id, different content), from two reads of storage. */
export function diffImport(
  before: BackupData,
  after: BackupData,
): BackupSnapshot {
  const snapshot = diffExtras(before, after);
  for (const [key, kind] of IMPORT_LISTS) {
    const previous = new Map(
      rowsOf(before, key).map((r) => [r.id as string, r]),
    );
    for (const record of rowsOf(after, key)) {
      const old = previous.get(record.id as string);
      if (!old) snapshot.added.push({ kind, id: record.id as string });
      else if (JSON.stringify(old) !== JSON.stringify(record)) {
        snapshot.overwritten.push({ kind, record: old });
      }
    }
  }
  return snapshot;
}

const isEmptyDiff = (snapshot: BackupSnapshot): boolean =>
  snapshot.added.length === 0 &&
  snapshot.overwritten.length === 0 &&
  !snapshot.addedRows?.length &&
  !snapshot.addedSettingKeys?.length &&
  !snapshot.addedPreferenceKeys?.length;

const importBackup: ToolImpl<"import_backup"> = {
  name: "import_backup",
  describe: (): ConfirmPreview => ({
    action: "change",
    severity: "caution",
    targets: [],
    count: 0,
    stepLabel: { key: "activity.tools.import_backup", params: {} },
  }),
  run: async (_input, { write }) => {
    const toolCallId = write?.origin.toolCallId;
    const envelope = toolCallId ? stagedImports.get(toolCallId) : undefined;
    if (!toolCallId || !envelope) return fail(NO_FILE_CHOSEN);
    stagedImports.delete(toolCallId);
    const existing = await collectBackupData(envelope.sections);
    // Merge only, and the file can never change the approval mode.
    const { added, skipped, kept, closedTabs } = await restoreBackup(
      envelope,
      "merge",
      { skipPreferenceKeys: [RELAY_STORAGE_KEYS.permission] },
    );
    const merged = diffImport(
      existing,
      await collectBackupData(envelope.sections),
    );
    await refreshStores();
    const summary = `Merged the backup: ${added} added, ${skipped} already there`;
    const counts = { added, skipped, kept, closedTabs };
    if (isEmptyDiff(merged)) {
      return { ok: true, data: { summary, ...counts } };
    }
    // The import already ran; recording it lets Undo take exactly its entities back.
    return commitChange(
      write,
      {
        entity: "backup",
        entityId: toolCallId,
        summary,
        before: merged,
        action: "created",
        mutate: () => undefined,
      },
      counts,
    );
  },
};

export const backupTools = [exportBackup, importBackup] as const;
