import { generateId } from "@/lib/utils";
import { copyChain } from "@/stores/useChainStore";
import type {
  CollectionFolderModel,
  CollectionModel,
  EnvironmentModel,
  RequestModel,
} from "@/types";
import type { Chain } from "@/types/chain";
import { captureTree, commitChange } from "../changeLog";
import type { ToolImpl, ToolOutcome } from "./registry";

/**
 * Duplicate tools (TOOL-04). The manual UI has no copy action for these, so a
 * copy is composed from the same writes Relay uses to create entities. Each is
 * logged as a created entity, which makes Undo delete the copy. A copied
 * collection takes a copy of its chain; a copied chain is standalone (HH-M12).
 */

const fail = (error: string): ToolOutcome => ({ ok: false, error });

const copyName = (name: string): string => `${name} (copy)`;

type TreeCopy = {
  collection: CollectionModel;
  folders: CollectionFolderModel[];
  requests: RequestModel[];
  /** The collection's chain, copied to the new collection's id; null when it had none. */
  chain: Chain | null;
};

/** New ids throughout, with folder and collection references pointing at the copies. */
function copyTree(
  source: NonNullable<ReturnType<typeof captureTree>>,
): TreeCopy {
  const now = Date.now();
  const collection = source.collection as CollectionModel;
  const copiedId = generateId();
  const folderIds = new Map(source.folders.map((f) => [f.id, generateId()]));
  const folderCopyId = (id: string | null | undefined) =>
    (id ? folderIds.get(id) : undefined) ?? null;
  const requests = source.requests.map((request) => ({
    ...request,
    id: generateId(),
    collectionId: copiedId,
    folderId: folderCopyId(request.folderId),
    createdAt: now,
    updatedAt: now,
  }));
  const requestIdMap = new Map(
    source.requests.map((request, index) => [request.id, requests[index].id]),
  );
  return {
    collection: {
      ...collection,
      id: copiedId,
      name: copyName(collection.name),
      createdAt: now,
      updatedAt: now,
    },
    folders: source.folders.map((folder) => ({
      ...folder,
      id: folderIds.get(folder.id) as string,
      collectionId: copiedId,
      parentFolderId: folderCopyId(folder.parentFolderId),
    })),
    requests,
    chain: source.chain
      ? copyChain(source.chain, {
          id: copiedId,
          name: copyName(collection.name),
          scope: "collection",
          collectionId: copiedId,
          requestIdMap,
        })
      : null,
  };
}

const duplicateCollection: ToolImpl<"duplicate_collection"> = {
  name: "duplicate_collection",
  refs: ({ collectionId }) => [{ kind: "collection", id: collectionId }],
  run: ({ collectionId }, { store, write }) => {
    const source = captureTree(store, collectionId);
    if (!source?.collection)
      return fail(`collection not found: ${collectionId}`);
    const copy = copyTree(source);
    const { id } = copy.collection;
    return commitChange(
      write,
      {
        entity: "tree",
        entityId: id,
        summary: `Duplicated collection "${source.collection.name}"`,
        before: null,
        mutate: () => {
          write?.writer.put("collection", copy.collection);
          for (const folder of copy.folders)
            write?.writer.put("folder", folder);
          for (const request of copy.requests) {
            write?.writer.put("request", request);
          }
          if (copy.chain) write?.writer.put("chain", copy.chain);
        },
      },
      { collectionId: id, createdIds: [id] },
    );
  },
};

const duplicateChain: ToolImpl<"duplicate_chain"> = {
  name: "duplicate_chain",
  refs: ({ chainId }) => [{ kind: "chain", id: chainId }],
  run: ({ chainId }, { store, write }) => {
    const source = store.chains().find((chain) => chain.id === chainId);
    if (!source) return fail(`chain not found: ${chainId}`);
    // A copy is always a standalone chain: a collection's chain lives at the collection's id.
    const copy = copyChain(source, {
      id: generateId(),
      name: copyName(source.name),
      scope: "standalone",
    });
    return commitChange(
      write,
      {
        entity: "chain",
        entityId: copy.id,
        summary: `Duplicated chain "${source.name}"`,
        before: null,
        mutate: () => write?.writer.put("chain", copy),
      },
      { chainId: copy.id, createdIds: [copy.id] },
    );
  },
};

/** A secret value stays with its source; the copy asks the user to fill it in. */
function copyEnvironment(source: EnvironmentModel): EnvironmentModel {
  const now = Date.now();
  return {
    ...source,
    id: generateId(),
    name: copyName(source.name),
    variables: source.variables.map((variable) => ({
      ...variable,
      id: generateId(),
      ...(variable.isSecret ? { initialValue: "", currentValue: "" } : {}),
    })),
    createdAt: now,
    updatedAt: now,
  };
}

const duplicateEnvironment: ToolImpl<"duplicate_environment"> = {
  name: "duplicate_environment",
  refs: ({ environmentId }) => [{ kind: "environment", id: environmentId }],
  run: ({ environmentId }, { store, write }) => {
    const source = store.environments().find((env) => env.id === environmentId);
    if (!source) return fail(`environment not found: ${environmentId}`);
    const copy = copyEnvironment(source);
    return commitChange(
      write,
      {
        entity: "environment",
        entityId: copy.id,
        summary: `Duplicated environment "${source.name}"`,
        before: null,
        mutate: () => write?.writer.put("environment", copy),
      },
      { environmentId: copy.id, createdIds: [copy.id] },
    );
  },
};

export const duplicateTools = [
  duplicateCollection,
  duplicateChain,
  duplicateEnvironment,
] as const;
