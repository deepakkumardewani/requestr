import { collectionWriteTools } from "./collectionWrite";
import type { ToolImpl, ToolOutcome } from "./registry";

/**
 * Folder tools (TOOL-04). `create_collection` (with a parent) and
 * `rename_collection` already write folders; these are the folder-only entries
 * to the same code, so the two never drift. Each write is logged with Undo by
 * that code. `delete_folder` lives with the other destructive tools.
 */

const fail = (error: string): ToolOutcome => ({ ok: false, error });

const FOLDER_ONLY = (id: string) =>
  `folder not found: ${id}. Use rename_collection to rename a collection.`;

type CollectionWriteName = "create_collection" | "rename_collection";

function collectionWriteTool<N extends CollectionWriteName>(
  name: N,
): ToolImpl<N> {
  return collectionWriteTools.find(
    (tool) => tool.name === name,
  ) as unknown as ToolImpl<N>;
}

const createCollection = collectionWriteTool("create_collection");
const renameCollection = collectionWriteTool("rename_collection");

const createFolder: ToolImpl<"create_folder"> = {
  name: "create_folder",
  run: ({ parentId, name }, context) =>
    createCollection.run({ name, parentId }, context),
};

const renameFolder: ToolImpl<"rename_folder"> = {
  name: "rename_folder",
  run: ({ id, name }, context) =>
    context.store.folders().some((folder) => folder.id === id)
      ? renameCollection.run({ id, name }, context)
      : fail(FOLDER_ONLY(id)),
};

export const folderTools = [createFolder, renameFolder] as const;
