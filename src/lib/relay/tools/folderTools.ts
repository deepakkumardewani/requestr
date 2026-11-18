import { commitChange } from "../changeLog";
import { createFolderIn, NAME_REQUIRED } from "./collectionWrite";
import type { ToolImpl, ToolOutcome } from "./registry";

/**
 * Folder tools (TOOL-04). Collection tools refuse folder ids, so folders have
 * their own entries. Each write is logged with Undo. `delete_folder` lives with
 * the other destructive tools.
 */

const fail = (error: string): ToolOutcome => ({ ok: false, error });

const FOLDER_ONLY = (id: string) =>
  `folder not found: ${id}. Use rename_collection to rename a collection.`;

const createFolder: ToolImpl<"create_folder"> = {
  name: "create_folder",
  run: (input, context) => createFolderIn(input, context),
};

const renameFolder: ToolImpl<"rename_folder"> = {
  name: "rename_folder",
  run: async ({ id, name }, { store, write }) => {
    const label = name.trim();
    if (!label) return fail(NAME_REQUIRED);
    const folder = store.folders().find((item) => item.id === id);
    if (!folder) return fail(FOLDER_ONLY(id));
    return commitChange(write, {
      entity: "folder",
      entityId: id,
      summary: `Renamed "${folder.name}" to "${label}"`,
      before: folder,
      mutate: () => write?.writer.put("folder", { ...folder, name: label }),
    });
  },
};

export const folderTools = [createFolder, renameFolder] as const;
