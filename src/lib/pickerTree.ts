import { EMPTY_MATCH, type SearchMatch, scoreItem } from "@/lib/pickerSearch";
import type {
  CollectionFolderModel,
  CollectionModel,
  RequestModel,
} from "@/types";

/** Rows deeper than this render at this indent and carry a breadcrumb instead. */
export const PICKER_MAX_DEPTH = 8;
export const BREADCRUMB_SEPARATOR = " / ";

export type PickerHeaderType = "collection" | "folder" | "day";

/** The fields a row renders, so request rows and history rows share one row component. */
export type PickerListItem = Pick<RequestModel, "name" | "method" | "url">;

export type PickerCount = { visible: number; total: number };

export type PickerHeaderRow = {
  kind: "header";
  id: string;
  headerType: PickerHeaderType;
  label: string;
  depth: number;
  expandable: boolean;
  expanded: boolean;
  /** `visible` equals `total` unless a filter is active. */
  count: PickerCount;
  breadcrumb?: string;
};

export type PickerItemRow<T = RequestModel> = {
  kind: "item";
  id: string;
  depth: number;
  item: T;
  match: SearchMatch;
  breadcrumb?: string;
};

/** Generic over the item payload so history entries reuse the same row model. */
export type PickerRow<T = RequestModel> = PickerHeaderRow | PickerItemRow<T>;

export type FlattenPickerTreeOptions = {
  /** Collection and folder ids the user has expanded; never mutated, so clearing a filter restores it. */
  expanded: ReadonlySet<string>;
  filter?: string;
};

type TreeNode = {
  entityId: string;
  headerType: "collection" | "folder";
  label: string;
  folders: TreeNode[];
  requests: RequestModel[];
};

/** A folder whose parent is missing, in another collection, or part of a cycle is promoted to the root. */
function resolveParentIds(
  folders: CollectionFolderModel[],
): Map<string, string | null> {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const resolved = new Map(
    folders.map((folder) => [folder.id, folder.parentFolderId]),
  );
  for (const start of folders) {
    const seen = new Set([start.id]);
    let current = start;
    while (resolved.get(current.id) !== null) {
      const parent = byId.get(resolved.get(current.id) as string);
      if (!parent || seen.has(parent.id)) {
        resolved.set(current.id, null);
        break;
      }
      seen.add(parent.id);
      current = parent;
    }
  }
  return resolved;
}

function buildCollectionNode(
  collection: CollectionModel,
  folders: CollectionFolderModel[],
  requests: RequestModel[],
): TreeNode {
  const root: TreeNode = {
    entityId: collection.id,
    headerType: "collection",
    label: collection.name,
    folders: [],
    requests: [],
  };
  const parents = resolveParentIds(folders);
  const nodes = new Map<string, TreeNode>();
  for (const folder of folders) {
    nodes.set(folder.id, {
      entityId: folder.id,
      headerType: "folder",
      label: folder.name,
      folders: [],
      requests: [],
    });
  }
  for (const folder of [...folders].sort((a, b) => a.order - b.order)) {
    const parentId = parents.get(folder.id);
    const parent = parentId ? nodes.get(parentId) : undefined;
    (parent ?? root).folders.push(nodes.get(folder.id) as TreeNode);
  }
  for (const request of requests) {
    const folderNode = request.folderId
      ? nodes.get(request.folderId)
      : undefined;
    (folderNode ?? root).requests.push(request);
  }
  return root;
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function buildTree(
  collections: CollectionModel[],
  folders: CollectionFolderModel[],
  requests: RequestModel[],
): TreeNode[] {
  const foldersByCollection = groupBy(folders, (folder) => folder.collectionId);
  const requestsByCollection = groupBy(
    requests,
    (request) => request.collectionId,
  );
  return collections.map((collection) =>
    buildCollectionNode(
      collection,
      foldersByCollection.get(collection.id) ?? [],
      requestsByCollection.get(collection.id) ?? [],
    ),
  );
}

type TreeCache = WeakMap<
  CollectionModel[],
  WeakMap<CollectionFolderModel[], WeakMap<RequestModel[], TreeNode[]>>
>;

const treeCache: TreeCache = new WeakMap();

function getTree(
  collections: CollectionModel[],
  folders: CollectionFolderModel[],
  requests: RequestModel[],
): TreeNode[] {
  const byFolders = treeCache.get(collections) ?? new WeakMap();
  const byRequests = byFolders.get(folders) ?? new WeakMap();
  treeCache.set(collections, byFolders);
  byFolders.set(folders, byRequests);
  const cached = byRequests.get(requests);
  if (cached) return cached;
  const tree = buildTree(collections, folders, requests);
  byRequests.set(requests, tree);
  return tree;
}

type FlattenContext = {
  expanded: ReadonlySet<string>;
  filtering: boolean;
  matches: Map<string, SearchMatch>;
};

function collectMatches(
  node: TreeNode,
  filter: string,
  matches: Map<string, SearchMatch>,
): void {
  for (const request of node.requests) {
    const match = scoreItem(filter, {
      name: request.name,
      method: request.method,
      url: request.url,
      groupName: node.label,
    });
    if (match) matches.set(request.id, match);
  }
  for (const child of node.folders) collectMatches(child, filter, matches);
}

function countSubtree(node: TreeNode, ctx: FlattenContext): PickerCount {
  const own = ctx.filtering
    ? node.requests.filter((request) => ctx.matches.has(request.id)).length
    : node.requests.length;
  let total = node.requests.length;
  let visible = own;
  for (const child of node.folders) {
    const counts = countSubtree(child, ctx);
    total += counts.total;
    visible += counts.visible;
  }
  return { visible, total };
}

function breadcrumbFor(depth: number, path: string[]): string | undefined {
  return depth > PICKER_MAX_DEPTH ? path.join(BREADCRUMB_SEPARATOR) : undefined;
}

function emitRequests(
  node: TreeNode,
  depth: number,
  path: string[],
  ctx: FlattenContext,
  out: PickerRow[],
): void {
  for (const request of node.requests) {
    const match = ctx.filtering ? ctx.matches.get(request.id) : EMPTY_MATCH;
    if (!match) continue;
    out.push({
      kind: "item",
      id: request.id,
      depth: Math.min(depth, PICKER_MAX_DEPTH),
      item: request,
      match,
      breadcrumb: breadcrumbFor(depth, path),
    });
  }
}

function emitNode(
  node: TreeNode,
  depth: number,
  path: string[],
  ctx: FlattenContext,
  out: PickerRow[],
): void {
  const count = countSubtree(node, ctx);
  if (ctx.filtering && count.visible === 0) return;
  const expandable = node.folders.length > 0 || node.requests.length > 0;
  const expanded =
    expandable && (ctx.filtering || ctx.expanded.has(node.entityId));
  out.push({
    kind: "header",
    id: `${node.headerType}:${node.entityId}`,
    headerType: node.headerType,
    label: node.label,
    depth: Math.min(depth, PICKER_MAX_DEPTH),
    expandable,
    expanded,
    count,
    breadcrumb: breadcrumbFor(depth, path),
  });
  if (!expanded) return;
  const childPath = [...path, node.label];
  for (const child of node.folders)
    emitNode(child, depth + 1, childPath, ctx, out);
  emitRequests(node, depth + 1, childPath, ctx, out);
}

type FlattenCacheEntry = {
  collections: CollectionModel[];
  folders: CollectionFolderModel[];
  requests: RequestModel[];
  expanded: ReadonlySet<string>;
  filter: string;
  rows: PickerRow[];
};

let lastFlatten: FlattenCacheEntry | null = null;

/**
 * Flattens collections into virtualizer-ready rows. Returns the identical array when called again
 * with the same input identities and filter, so memoized consumers skip re-rendering.
 */
export function flattenPickerTree(
  collections: CollectionModel[],
  folders: CollectionFolderModel[],
  requests: RequestModel[],
  { expanded, filter = "" }: FlattenPickerTreeOptions,
): PickerRow[] {
  const trimmed = filter.trim();
  const hit = lastFlatten;
  if (
    hit &&
    hit.collections === collections &&
    hit.folders === folders &&
    hit.requests === requests &&
    hit.expanded === expanded &&
    hit.filter === trimmed
  ) {
    return hit.rows;
  }
  const tree = getTree(collections, folders, requests);
  const ctx: FlattenContext = {
    expanded,
    filtering: trimmed !== "",
    matches: new Map(),
  };
  if (ctx.filtering)
    for (const node of tree) collectMatches(node, trimmed, ctx.matches);
  const rows: PickerRow[] = [];
  for (const node of tree) emitNode(node, 0, [], ctx, rows);
  lastFlatten = {
    collections,
    folders,
    requests,
    expanded,
    filter: trimmed,
    rows,
  };
  return rows;
}

/** Day header for history lists, expressed in the shared row model. */
export function createDayHeaderRow(
  label: string,
  count: number,
): PickerHeaderRow {
  return {
    kind: "header",
    id: `day:${label}`,
    headerType: "day",
    label,
    depth: 0,
    expandable: false,
    expanded: true,
    count: { visible: count, total: count },
  };
}
