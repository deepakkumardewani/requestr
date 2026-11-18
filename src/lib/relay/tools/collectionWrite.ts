import { generateId } from "@/lib/utils";
import type { CollectionFolderModel, CollectionModel } from "@/types";
import { commitChange } from "../changeLog";
import type { StoreAccess } from "../storeAccess";
import type { ToolContext, ToolImpl, ToolOutcome } from "./registry";
import { folderIdError } from "./schemas";

/**
 * Collection write tools (SPEC section 5). They auto-apply through the change
 * log, so every one of them can be undone from its Change Card (FR-41).
 */

const fail = (error: string): ToolOutcome => ({ ok: false, error });

export const NAME_REQUIRED = "name must not be empty";

type Parent =
  | { kind: "collection"; collectionId: string; parentFolderId: null }
  | { kind: "folder"; collectionId: string; parentFolderId: string };

/** A collection or folder id as the place something can live in. */
function resolveParent(store: StoreAccess, id: string): Parent | null {
  if (store.exists("collection", id)) {
    return { kind: "collection", collectionId: id, parentFolderId: null };
  }
  const folder = store.folders().find((item) => item.id === id);
  return folder
    ? {
        kind: "folder",
        collectionId: folder.collectionId,
        parentFolderId: folder.id,
      }
    : null;
}

function siblingCount(store: StoreAccess, parent: Parent): number {
  return store
    .folders()
    .filter(
      (folder) =>
        folder.collectionId === parent.collectionId &&
        folder.parentFolderId === parent.parentFolderId,
    ).length;
}

function isInsideFolder(
  folders: readonly CollectionFolderModel[],
  folderId: string,
  ancestorId: string,
): boolean {
  let current = folders.find((folder) => folder.id === folderId);
  while (current) {
    if (current.id === ancestorId) return true;
    const parentId: string | null = current.parentFolderId;
    current = parentId
      ? folders.find((folder) => folder.id === parentId)
      : undefined;
  }
  return false;
}

const createCollection: ToolImpl<"create_collection"> = {
  name: "create_collection",
  run: async ({ name }, { write }) => {
    const label = name.trim();
    if (!label) return fail(NAME_REQUIRED);
    const now = Date.now();
    const id = generateId();
    const collection: CollectionModel = {
      id,
      name: label,
      createdAt: now,
      updatedAt: now,
    };
    return commitChange(
      write,
      {
        entity: "tree",
        entityId: id,
        summary: `Created collection "${label}"`,
        before: null,
        mutate: () => write?.writer.put("collection", collection),
      },
      { collectionId: id, createdIds: [id] },
    );
  },
};

/** Creates a folder in a collection or folder; shared by `create_folder`. */
export async function createFolderIn(
  { parentId, name }: { parentId: string; name: string },
  { store, write }: ToolContext,
): Promise<ToolOutcome> {
  const label = name.trim();
  if (!label) return fail(NAME_REQUIRED);
  const parent = resolveParent(store, parentId);
  if (!parent) return fail(`collection not found: ${parentId}`);
  const id = generateId();
  const folder: CollectionFolderModel = {
    id,
    collectionId: parent.collectionId,
    name: label,
    parentFolderId: parent.parentFolderId,
    order: siblingCount(store, parent),
  };
  return commitChange(
    write,
    {
      entity: "tree",
      entityId: id,
      summary: `Created folder "${label}"`,
      before: null,
      mutate: () => write?.writer.put("folder", folder),
    },
    { folderId: id, collectionId: parent.collectionId, createdIds: [id] },
  );
}

const renameCollection: ToolImpl<"rename_collection"> = {
  name: "rename_collection",
  run: async ({ id, name }, { store, write }) => {
    const label = name.trim();
    if (!label) return fail(NAME_REQUIRED);
    const collection = store.collections().find((item) => item.id === id);
    if (!collection) {
      return fail(
        store.exists("folder", id)
          ? folderIdError(id, "rename_folder")
          : `collection not found: ${id}`,
      );
    }
    return commitChange(write, {
      entity: "collection",
      entityId: id,
      summary: `Renamed "${collection.name}" to "${label}"`,
      before: collection,
      mutate: () =>
        write?.writer.put("collection", { ...collection, name: label }),
    });
  },
};

/** Environments and chains have no folders or ordering in their stores, so they can only be renamed. */
export const MOVE_UNSUPPORTED =
  "environments and chains cannot be moved or reordered: they can only be renamed";

const moveItem: ToolImpl<"move_item"> = {
  name: "move_item",
  run: async ({ id, parentId, index }, { store, write }) => {
    if (store.exists("environment", id) || store.exists("chain", id)) {
      return fail(MOVE_UNSUPPORTED);
    }
    const parent = resolveParent(store, parentId);
    if (!parent) return fail(`collection not found: ${parentId}`);

    const request = store.requests().find((item) => item.id === id);
    if (request) {
      const moved = {
        ...request,
        collectionId: parent.collectionId,
        folderId: parent.parentFolderId,
      };
      return commitChange(write, {
        entity: "request",
        entityId: id,
        summary: `Moved "${request.name}"`,
        before: request,
        mutate: () => write?.writer.put("request", moved),
      });
    }

    const folder = store.folders().find((item) => item.id === id);
    if (!folder) return fail(`item not found: ${id}`);
    if (parent.collectionId !== folder.collectionId) {
      return fail("folders can only move inside their own collection");
    }
    if (
      parent.parentFolderId &&
      isInsideFolder(store.folders(), parent.parentFolderId, id)
    ) {
      return fail("a folder cannot be moved into itself");
    }
    const moved: CollectionFolderModel = {
      ...folder,
      parentFolderId: parent.parentFolderId,
      order: index ?? siblingCount(store, parent),
    };
    return commitChange(write, {
      entity: "folder",
      entityId: id,
      summary: `Moved folder "${folder.name}"`,
      before: folder,
      mutate: () => write?.writer.put("folder", moved),
    });
  },
};

export const collectionWriteTools = [
  createCollection,
  renameCollection,
  moveItem,
] as const;
