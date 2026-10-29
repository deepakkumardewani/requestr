import type { BackupData } from "./schema";

/** Ids ticked in Choose mode; an absent list means "all of that kind". */
export type BackupSelection = {
  collectionIds?: string[];
  environmentIds?: string[];
  chainIds?: string[];
};

type Rec = Record<string, unknown>;

const isRec = (value: unknown): value is Rec =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function records(list: unknown[] | undefined): Rec[] {
  return (list ?? []).filter(isRec);
}

function keepWhere(
  list: unknown[] | undefined,
  field: string,
  allowed: ReadonlySet<string>,
): unknown[] | undefined {
  if (!list) return list;
  return records(list).filter((item) => allowed.has(String(item[field])));
}

/**
 * Narrows `data` to the ticked items. A selected collection brings its
 * folders, requests and chainConfigs (keyed by `collectionId`). References to
 * unselected items are kept, never rewritten.
 */
export function applySelection(
  data: BackupData,
  selection: BackupSelection,
): BackupData {
  const next: BackupData = { ...data };
  if (selection.collectionIds) {
    const ids = new Set(selection.collectionIds);
    next.collections = keepWhere(data.collections, "id", ids);
    next.folders = keepWhere(data.folders, "collectionId", ids);
    next.requests = keepWhere(data.requests, "collectionId", ids);
    next.chainConfigs = keepWhere(data.chainConfigs, "collectionId", ids);
  }
  if (selection.environmentIds) {
    const ids = new Set(selection.environmentIds);
    next.environments = keepWhere(data.environments, "id", ids);
  }
  if (selection.chainIds) {
    const ids = new Set(selection.chainIds);
    next.chains = keepWhere(data.chains, "id", ids);
  }
  return dropUndefined(next);
}

/** `keepWhere` yields undefined for an absent section; keys must stay absent. */
function dropUndefined(data: BackupData): BackupData {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as BackupData;
}

function idSet(list: unknown[] | undefined): Set<string> {
  return new Set(records(list).map((item) => String(item.id)));
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
}

function missing(ids: unknown[], known: ReadonlySet<string>): number {
  return ids.filter((id) => typeof id === "string" && !known.has(id)).length;
}

type KnownIds = Record<
  "collections" | "folders" | "requests" | "chains",
  ReadonlySet<string>
>;

function requestReferences(requests: Rec[], known: KnownIds): number {
  return requests.reduce(
    (total, request) =>
      total +
      missing([request.collectionId], known.collections) +
      missing([request.folderId], known.folders),
    0,
  );
}

function folderReferences(folders: Rec[], known: KnownIds): number {
  return folders.reduce(
    (total, folder) =>
      total +
      missing([folder.collectionId], known.collections) +
      missing([folder.parentFolderId], known.folders),
    0,
  );
}

function chainReferences(chains: Rec[], known: KnownIds): number {
  return chains.reduce((total, chain) => {
    const subChainIds = records(chain.blocks as unknown[])
      .filter((block) => block.type === "subchain")
      .map((block) => block.chainId);
    return (
      total +
      missing([chain.collectionId], known.collections) +
      missing(stringList(chain.nodeIds), known.requests) +
      missing(subChainIds, known.chains)
    );
  }, 0);
}

function chainConfigReferences(configs: Rec[], known: KnownIds): number {
  return configs.reduce(
    (total, config) =>
      total +
      missing([config.collectionId], known.collections) +
      missing(stringList(config.nodeIds), known.requests),
    0,
  );
}

/**
 * Counts references in `data` to records `data` does not contain. Used for the
 * export summary (unselected items) and the restore summary (missing items).
 */
export function countDanglingReferences(data: BackupData): number {
  const known: KnownIds = {
    collections: idSet(data.collections),
    folders: idSet(data.folders),
    requests: idSet(data.requests),
    chains: idSet(data.chains),
  };
  const runs = records(data.chainRuns).map((run) => run.chainId);
  const pinned = isRec(data.settings) ? data.settings.pinnedRequestIds : [];
  return (
    requestReferences(records(data.requests), known) +
    folderReferences(records(data.folders), known) +
    chainReferences(records(data.chains), known) +
    chainConfigReferences(records(data.chainConfigs), known) +
    missing(runs, known.chains) +
    missing(stringList(pinned), known.requests)
  );
}
