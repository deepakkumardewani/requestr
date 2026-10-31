import type { BackupSection } from "@/lib/backup/constants";
import {
  type BackupOptions,
  prepareBackup,
  toBackupBlob,
} from "@/lib/backup/exporter";
import { restoreBackup } from "@/lib/backup/importer";
import type { BackupEnvelope } from "@/lib/backup/schema";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
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
    // Merge only, and the file can never change the approval mode.
    const { added, skipped, kept, closedTabs } = await restoreBackup(
      envelope,
      "merge",
      { skipPreferenceKeys: [RELAY_STORAGE_KEYS.permission] },
    );
    await refreshStores();
    return {
      ok: true,
      data: {
        summary: `Merged the backup: ${added} added, ${skipped} already there`,
        added,
        skipped,
        kept,
        closedTabs,
      },
    };
  },
};

export const backupTools = [exportBackup, importBackup] as const;
