import { runInTransaction, type StoreName } from "../idb";
import { broadcastRestore } from "./broadcast";
import {
  collectBackupData,
  type ListKey,
  SECTION_LISTS,
  SETTINGS_RECORD_KEY,
  SETTINGS_STORE,
} from "./exporter";
import {
  type ListMergeSpec,
  mergeKeepingExisting,
  mergeList,
  type Rec,
} from "./mergeRules";
import { writePreferences } from "./preferences";
import { reconcileAfterRestore } from "./reconcile";
import {
  dependencyOrder,
  type IdRemap,
  remapPreferences,
  rewriteReferences,
} from "./remap";
import { replaceBackup } from "./replace";
import type { BackupData, BackupEnvelope } from "./schema";

export type RestoreMode = "merge" | "replace";

export type RestoreOptions = {
  /** Preference keys in the file that must not be written, such as the approval mode. */
  skipPreferenceKeys?: readonly string[];
};

export type RestoreSummary = {
  mode: RestoreMode;
  added: number;
  skipped: number;
  kept: number;
  closedTabs: number;
  danglingCount: number;
};

type MergeCounts = Pick<RestoreSummary, "added" | "skipped" | "kept">;

export type MergePlan = {
  lists: Partial<Record<ListKey, Rec[]>>;
  /** The settings record to write, or null when existing settings already cover it. */
  settings: Rec | null;
  preferences: Record<string, string>;
  counts: MergeCounts;
};

type MergeStep = {
  dataKey: ListKey;
  spec: ListMergeSpec;
  /** Puts records a record references ahead of it, so renames are known in time. */
  order?: (records: Rec[]) => Rec[];
};

/** Relay changes restored from a file point at state that may not match, so undo is off. */
const markNotUndoable = (record: Rec): Rec => ({
  ...record,
  status: "blocked",
});

const subChainIds = (chain: Rec): string[] =>
  ((chain.blocks as Rec[] | undefined) ?? [])
    .filter((block) => block.type === "subchain")
    .map((block) => String(block.chainId));

/** Parents before children, requests before the chainConfigs that list them, and so on. */
const MERGE_STEPS: MergeStep[] = [
  { dataKey: "collections", spec: { keyField: "id", named: true } },
  {
    dataKey: "folders",
    spec: { keyField: "id" },
    order: (folders) =>
      dependencyOrder(folders, "id", (folder) => [
        String(folder.parentFolderId),
      ]),
  },
  { dataKey: "requests", spec: { keyField: "id", named: true } },
  {
    dataKey: "chainConfigs",
    spec: { keyField: "collectionId", keepExistingOnCollision: true },
  },
  { dataKey: "environments", spec: { keyField: "id", named: true } },
  {
    dataKey: "chains",
    spec: { keyField: "id", named: true },
    order: (chains) => dependencyOrder(chains, "id", subChainIds),
  },
  { dataKey: "history", spec: { keyField: "id" } },
  { dataKey: "chainRuns", spec: { keyField: "id" } },
  { dataKey: "relayThreads", spec: { keyField: "id" } },
  {
    dataKey: "relayChanges",
    spec: { keyField: "id", finalize: markNotUndoable },
  },
];

const asRecords = (list: unknown[] | undefined): Rec[] => (list ?? []) as Rec[];

function mergeSettings(
  existing: Rec | undefined,
  incoming: Rec | undefined,
  remap: IdRemap,
): Rec | null {
  if (!incoming || Object.keys(incoming).length === 0) return null;
  const remapped = rewriteReferences(incoming, remap);
  if (!existing || Object.keys(existing).length === 0) return remapped;
  const merged = mergeKeepingExisting(existing, remapped);
  return Object.keys(merged).length === Object.keys(existing).length
    ? null
    : merged;
}

/** Existing values win, so only keys absent locally are added. */
function mergePreferences(
  existing: Record<string, string> | undefined,
  incoming: Record<string, string> | undefined,
  remap: IdRemap,
): Record<string, string> {
  const remapped = remapPreferences(incoming ?? {}, remap);
  return Object.fromEntries(
    Object.entries(remapped).filter(([key]) => !(key in (existing ?? {}))),
  );
}

/**
 * Decides what Merge adds, without writing anything. Existing records are
 * never changed; colliding ids keep both records (see `mergeList`).
 */
export function planMerge(
  existing: BackupData,
  incoming: BackupData,
): MergePlan {
  const remap: IdRemap = new Map();
  const plan: MergePlan = {
    lists: {},
    settings: null,
    preferences: {},
    counts: { added: 0, skipped: 0, kept: 0 },
  };

  for (const { dataKey, spec, order } of MERGE_STEPS) {
    if (!incoming[dataKey]) continue;
    const records = asRecords(incoming[dataKey]);
    const result = mergeList(
      asRecords(existing[dataKey]),
      order ? order(records) : records,
      remap,
      spec,
    );
    plan.lists[dataKey] = result.adds;
    plan.counts.added += result.adds.length;
    plan.counts.skipped += result.skipped;
    plan.counts.kept += result.kept;
  }
  plan.settings = mergeSettings(existing.settings, incoming.settings, remap);
  plan.preferences = mergePreferences(
    existing.preferences,
    incoming.preferences,
    remap,
  );
  return plan;
}

const STORE_OF_KEY = new Map<ListKey, StoreName>(
  Object.values(SECTION_LISTS)
    .flat()
    .map(({ dataKey, store }) => [dataKey, store]),
);

async function applyMerge(
  plan: MergePlan,
  skipPreferenceKeys: readonly string[],
): Promise<void> {
  const entries = Object.entries(plan.lists).filter(
    ([, records]) => records && records.length > 0,
  ) as [ListKey, Rec[]][];
  const stores = entries.map(
    ([dataKey]) => STORE_OF_KEY.get(dataKey) as StoreName,
  );
  if (plan.settings) stores.push(SETTINGS_STORE);
  if (stores.length > 0) {
    await runInTransaction(stores, async (tx) => {
      const ops: Promise<unknown>[] = [];
      for (const [dataKey, records] of entries) {
        const store = tx.objectStore(STORE_OF_KEY.get(dataKey) as StoreName);
        for (const record of records) ops.push(store.put(record));
      }
      if (plan.settings) {
        ops.push(
          tx
            .objectStore(SETTINGS_STORE)
            .put(plan.settings, SETTINGS_RECORD_KEY),
        );
      }
      await Promise.all(ops);
    });
  }
  // Preferences follow the commit so a failed merge leaves localStorage alone.
  const preferences = Object.fromEntries(
    Object.entries(plan.preferences).filter(
      ([key]) => !skipPreferenceKeys.includes(key),
    ),
  );
  if (Object.keys(preferences).length > 0) writePreferences(preferences);
}

async function mergeBackup(
  envelope: BackupEnvelope,
  { skipPreferenceKeys = [] }: RestoreOptions,
): Promise<MergeCounts> {
  const existing = await collectBackupData(envelope.sections);
  const plan = planMerge(existing, envelope.data);
  await applyMerge(plan, skipPreferenceKeys);
  return plan.counts;
}

async function replaceCounts(envelope: BackupEnvelope): Promise<MergeCounts> {
  await replaceBackup(envelope);
  const added = Object.values(envelope.data).reduce<number>(
    (total, value) => total + (Array.isArray(value) ? value.length : 0),
    0,
  );
  return { added, skipped: 0, kept: 0 };
}

/**
 * Restores a validated backup, reconciles tabs, and tells other open tabs to
 * reload. The caller shows the summary and then calls `reloadWorkspace()`.
 */
export async function restoreBackup(
  envelope: BackupEnvelope,
  mode: RestoreMode,
  options: RestoreOptions = {},
): Promise<RestoreSummary> {
  const counts =
    mode === "replace"
      ? await replaceCounts(envelope)
      : await mergeBackup(envelope, options);
  const reconciled = await reconcileAfterRestore();
  broadcastRestore();
  return { mode, ...counts, ...reconciled };
}
