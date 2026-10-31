"use client";

import { create } from "zustand";

const STORAGE_KEY = "rq_collapsed_folders";

function readCollapsed(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function writeCollapsed(collapsedFolderIds: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsedFolderIds));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

type FolderExpandState = {
  collapsedFolderIds: string[];
  /** Collections open in the sidebar accordion. In-memory: collections start closed each session. */
  openCollectionIds: string[];
};

type FolderExpandActions = {
  isExpanded: (folderId: string) => boolean;
  setExpanded: (folderId: string, expanded: boolean) => void;
  toggle: (folderId: string) => void;
  setOpenCollectionIds: (collectionIds: string[]) => void;
  openCollection: (collectionId: string) => void;
  expandAll: (folderIds: string[]) => void;
  collapseAll: (folderIds: string[]) => void;
  isAllExpanded: (folderIds: string[]) => boolean;
  toggleAll: (folderIds: string[]) => void;
};

export const useFolderExpandStore = create<
  FolderExpandState & FolderExpandActions
>((set, get) => ({
  collapsedFolderIds: readCollapsed(),
  openCollectionIds: [],

  setOpenCollectionIds(openCollectionIds) {
    set({ openCollectionIds });
  },

  openCollection(collectionId) {
    set((state) =>
      state.openCollectionIds.includes(collectionId)
        ? state
        : { openCollectionIds: [...state.openCollectionIds, collectionId] },
    );
  },

  isExpanded(folderId) {
    return !get().collapsedFolderIds.includes(folderId);
  },

  setExpanded(folderId, expanded) {
    set((state) => {
      const collapsed = new Set(state.collapsedFolderIds);
      if (expanded) {
        collapsed.delete(folderId);
      } else {
        collapsed.add(folderId);
      }
      const collapsedFolderIds = [...collapsed];
      writeCollapsed(collapsedFolderIds);
      return { collapsedFolderIds };
    });
  },

  toggle(folderId) {
    const expanded = get().isExpanded(folderId);
    get().setExpanded(folderId, !expanded);
  },

  expandAll(folderIds) {
    set((state) => {
      const collapsed = new Set(state.collapsedFolderIds);
      for (const id of folderIds) {
        collapsed.delete(id);
      }
      const collapsedFolderIds = [...collapsed];
      writeCollapsed(collapsedFolderIds);
      return { collapsedFolderIds };
    });
  },

  collapseAll(folderIds) {
    set((state) => {
      const collapsed = new Set(state.collapsedFolderIds);
      for (const id of folderIds) {
        collapsed.add(id);
      }
      const collapsedFolderIds = [...collapsed];
      writeCollapsed(collapsedFolderIds);
      return { collapsedFolderIds };
    });
  },

  isAllExpanded(folderIds) {
    if (folderIds.length === 0) return false;
    const collapsed = get().collapsedFolderIds;
    return folderIds.every((id) => !collapsed.includes(id));
  },

  toggleAll(folderIds) {
    if (get().isAllExpanded(folderIds)) {
      get().collapseAll(folderIds);
    } else {
      get().expandAll(folderIds);
    }
  },
}));
