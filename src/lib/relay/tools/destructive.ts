import { withoutNodes } from "@/stores/useChainStore";
import type { RequestModel } from "@/types";
import type { Chain } from "@/types/chain";
import { captureTree, commitChange } from "../changeLog";
import type { StoreAccess } from "../storeAccess";
import type { ConfirmPreview, ToolImpl, ToolOutcome } from "./registry";
import { PREVIEW_TARGETS_MAX } from "./schemas";

/**
 * Destructive tools (SPEC section 5). The registry refuses to run any of them
 * without an Approve token (FR-42), and every delete is logged with the state
 * it removed so the Change Card can bring it back (FR-41).
 */

const fail = (error: string): ToolOutcome => ({ ok: false, error });

const unique = (ids: readonly string[]): string[] => [...new Set(ids)];

function findRequests(store: StoreAccess, ids: readonly string[]) {
  return unique(ids)
    .map((id) => store.requests().find((request) => request.id === id))
    .filter((request): request is RequestModel => request !== undefined);
}

function treeName(store: StoreAccess, id: string): string | null {
  const collection = store.collections().find((item) => item.id === id);
  return (
    collection?.name ??
    store.folders().find((folder) => folder.id === id)?.name ??
    null
  );
}

/** Items inside the tree that deleting it would take along. */
function treeChildCount(store: StoreAccess, id: string): number {
  const tree = captureTree(store, id);
  if (!tree) return 0;
  // A folder snapshot lists the folder itself first; it is not its own child.
  const ownFolders = tree.collection ? 0 : 1;
  return tree.folders.length - ownFolders + tree.requests.length;
}

const deleteRequest: ToolImpl<"delete_request"> = {
  name: "delete_request",
  refs: ({ ids }) => ids.map((id) => ({ kind: "request" as const, id })),
  describe: ({ ids }, store): ConfirmPreview => {
    const requests = findRequests(store, ids);
    return {
      action: "delete",
      severity: "danger",
      targets: requests.slice(0, PREVIEW_TARGETS_MAX).map((r) => r.name),
      count: requests.length,
    };
  },
  run: async ({ ids }, { store, write }) => {
    const requests = findRequests(store, ids);
    const label =
      requests.length === 1
        ? `Deleted request "${requests[0].name}"`
        : `Deleted ${requests.length} requests`;
    return commitChange(
      write,
      {
        entity: "requests",
        entityId: requests.map((request) => request.id).join(","),
        summary: label,
        before: requests,
        mutate: () => {
          for (const request of requests) {
            write?.writer.remove("request", request.id);
          }
        },
      },
      { deletedIds: requests.map((request) => request.id) },
    );
  },
};

const deleteCollection: ToolImpl<"delete_collection"> = {
  name: "delete_collection",
  describe: ({ ids }, store): ConfirmPreview => {
    const roots = unique(ids).filter((id) => treeName(store, id) !== null);
    return {
      action: "delete",
      severity: "danger",
      targets: roots
        .slice(0, PREVIEW_TARGETS_MAX)
        .map((id) => treeName(store, id) ?? id),
      count: roots.length,
      childCount: roots.reduce(
        (total, id) => total + treeChildCount(store, id),
        0,
      ),
    };
  },
  run: async ({ ids }, { store, write }) => {
    const missing = unique(ids).find((id) => treeName(store, id) === null);
    if (missing) return fail(`collection not found: ${missing}`);

    const changes: Record<string, unknown>[] = [];
    const deletedIds: string[] = [];
    for (const id of unique(ids)) {
      // An earlier id may have been inside this one's parent and taken it along.
      const name = treeName(store, id);
      const tree = captureTree(store, id);
      if (name === null || tree === null) continue;
      const isCollection = tree.collection !== null;
      const outcome = await commitChange(write, {
        entity: "tree",
        entityId: id,
        summary: `Deleted ${isCollection ? "collection" : "folder"} "${name}"`,
        before: tree,
        mutate: () =>
          write?.writer.remove(isCollection ? "collection" : "folder", id),
      });
      if (!outcome.ok) return outcome;
      changes.push(outcome.data);
      deletedIds.push(id);
    }
    if (changes.length === 0) return fail("nothing to delete");
    // The first change drives the card's Undo; "Undo all" covers the rest.
    const [first] = changes;
    return {
      ok: true,
      data: {
        ...first,
        summary:
          changes.length === 1
            ? first.summary
            : `Deleted ${changes.length} collections or folders`,
        changeIds: changes.map((change) => change.changeId),
        deletedIds,
      },
    };
  },
};

const deleteEnvironment: ToolImpl<"delete_environment"> = {
  name: "delete_environment",
  refs: ({ id }) => [{ kind: "environment", id }],
  describe: ({ id }, store): ConfirmPreview => ({
    action: "delete",
    severity: "danger",
    targets: store
      .environments()
      .filter((env) => env.id === id)
      .map((env) => env.name),
    count: 1,
  }),
  run: async ({ id }, { store, write }) => {
    const environment = store.environments().find((env) => env.id === id);
    if (!environment) return fail(`environment not found: ${id}`);
    return commitChange(write, {
      entity: "environment",
      entityId: id,
      summary: `Deleted environment "${environment.name}"`,
      before: environment,
      mutate: () => write?.writer.remove("environment", id),
    });
  },
};

const findChain = (store: StoreAccess, id: string): Chain | undefined =>
  store.chains().find((chain) => chain.id === id);

const chainNodeCount = (chain: Chain): number =>
  chain.nodeIds.length + chain.blocks.length;

/** A request node reads as its request's name, a block as its type. */
function chainNodeName(store: StoreAccess, chain: Chain, nodeId: string) {
  const request = store.requests().find((item) => item.id === nodeId);
  if (request && chain.nodeIds.includes(nodeId)) return request.name;
  const block = chain.blocks.find((item) => item.id === nodeId);
  return block
    ? "name" in block && block.name
      ? block.name
      : block.type
    : null;
}

const deleteChain: ToolImpl<"delete_chain"> = {
  name: "delete_chain",
  refs: ({ id }) => [{ kind: "chain", id }],
  describe: ({ id }, store): ConfirmPreview => {
    const chain = findChain(store, id);
    return {
      action: "delete",
      severity: "danger",
      targets: chain ? [chain.name] : [],
      count: 1,
      childCount: chain ? chainNodeCount(chain) : 0,
    };
  },
  run: async ({ id }, { store, write }) => {
    const chain = findChain(store, id);
    if (!chain) return fail(`chain not found: ${id}`);
    return commitChange(write, {
      entity: "chain",
      entityId: id,
      summary: `Deleted chain "${chain.name}"`,
      before: chain,
      mutate: () => write?.writer.remove("chain", id),
    });
  },
};

const deleteChainNode: ToolImpl<"delete_chain_node"> = {
  name: "delete_chain_node",
  refs: ({ chainId }) => [{ kind: "chain", id: chainId }],
  describe: ({ chainId, nodeId }, store): ConfirmPreview => {
    const chain = findChain(store, chainId);
    const name = chain ? chainNodeName(store, chain, nodeId) : null;
    return {
      action: "delete",
      severity: "danger",
      targets: name ? [name] : [],
      count: 1,
      childCount: chain ? chainNodeCount(chain) : 0,
    };
  },
  run: async ({ chainId, nodeId }, { store, write }) => {
    const chain = findChain(store, chainId);
    if (!chain) return fail(`chain not found: ${chainId}`);
    const name = chainNodeName(store, chain, nodeId);
    if (name === null) {
      return fail(`node not found in chain: ${nodeId}`);
    }
    return commitChange(
      write,
      {
        entity: "chain",
        entityId: chainId,
        summary: `Removed "${name}" from chain "${chain.name}"`,
        before: chain,
        mutate: () => write?.writer.put("chain", withoutNodes(chain, [nodeId])),
      },
      { chainId, nodeId },
    );
  },
};

export const destructiveTools = [
  deleteRequest,
  deleteCollection,
  deleteEnvironment,
  deleteChain,
  deleteChainNode,
] as const;
