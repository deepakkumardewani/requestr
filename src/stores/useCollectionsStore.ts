"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { getDB } from "@/lib/idb";
import type { ParsedPostmanCollection } from "@/lib/postmanParser";
import { generateId } from "@/lib/utils";
import { useChainStore } from "@/stores/useChainStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type {
  CollectionFolderModel,
  CollectionModel,
  HttpTab,
  RequestModel,
} from "@/types";

type CollectionsState = {
  collections: CollectionModel[];
  folders: CollectionFolderModel[];
  requests: RequestModel[];
  hydrated: boolean;
};

type CollectionsActions = {
  createCollection: (name: string) => CollectionModel;
  bulkImportCollection: (
    collection: CollectionModel,
    requests: RequestModel[],
    folders?: CollectionFolderModel[],
  ) => void;
  importParsedPostmanCollection: (
    parsed: ParsedPostmanCollection,
  ) => CollectionModel;
  renameCollection: (id: string, name: string) => void;
  createFolder: (
    collectionId: string,
    parentFolderId?: string | null,
    name?: string,
  ) => CollectionFolderModel;
  renameFolder: (id: string, name: string) => void;
  duplicateFolder: (id: string) => CollectionFolderModel | null;
  deleteFolder: (id: string) => void;
  deleteCollection: (id: string) => void;
  addRequest: (
    collectionId: string,
    tab: HttpTab,
    folderId?: string | null,
  ) => RequestModel;
  updateRequest: (id: string, patch: Partial<RequestModel>) => void;
  deleteRequest: (id: string) => void;
  moveRequest: (requestId: string, targetCollectionId: string) => void;
  hydrate: () => Promise<void>;
  /** Creates the demo auth-flow chain collection and returns its collectionId. */
  loadDemoChain: () => string;
};

async function persistCollection(collection: CollectionModel) {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.put("collections", collection);
  } catch (error) {
    toast.error("Failed to save collection", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function persistRequest(request: RequestModel) {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.put("requests", request);
  } catch (error) {
    toast.error("Failed to save request", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function deleteCollectionFromDB(id: string) {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.delete("collections", id);
  } catch (error) {
    toast.error("Failed to delete collection", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function persistFolder(folder: CollectionFolderModel) {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.put("folders", folder);
  } catch (error) {
    toast.error("Failed to save folder", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function deleteFolderFromDB(id: string) {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.delete("folders", id);
  } catch (error) {
    toast.error("Failed to delete folder", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function deleteRequestFromDB(id: string) {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.delete("requests", id);
  } catch (error) {
    toast.error("Failed to delete request", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export const useCollectionsStore = create<
  CollectionsState & CollectionsActions
>((set, get) => ({
  collections: [],
  folders: [],
  requests: [],
  hydrated: false,

  createCollection(name) {
    const collection: CollectionModel = {
      id: generateId(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({ collections: [...state.collections, collection] }));
    persistCollection(collection);
    return collection;
  },

  bulkImportCollection(collection, requests, folders = []) {
    set((state) => ({
      collections: [...state.collections, collection],
      folders: [...state.folders, ...folders],
      requests: [...state.requests, ...requests],
    }));
    persistCollection(collection);
    for (const folder of folders) {
      persistFolder(folder);
    }
    for (const request of requests) {
      persistRequest(request);
    }
  },

  importParsedPostmanCollection(parsed) {
    const now = Date.now();
    const collection: CollectionModel = {
      id: generateId(),
      name: parsed.name,
      createdAt: now,
      updatedAt: now,
    };

    const folderIdByTempId = new Map<string, string>();
    const folders: CollectionFolderModel[] = parsed.folders.map((folder) => {
      const id = generateId();
      folderIdByTempId.set(folder.tempId, id);
      return {
        id,
        collectionId: collection.id,
        name: folder.name,
        parentFolderId: folder.parentTempId
          ? (folderIdByTempId.get(folder.parentTempId) ?? null)
          : null,
        order: folder.order,
      };
    });

    const requests: RequestModel[] = parsed.requests.map((req, index) => ({
      id: generateId(),
      collectionId: collection.id,
      folderId: req.folderTempId
        ? (folderIdByTempId.get(req.folderTempId) ?? null)
        : null,
      name: req.name,
      method: req.method,
      url: req.url,
      params: req.params,
      headers: req.headers,
      auth: req.auth,
      body: req.body,
      preScript: "",
      postScript: "",
      createdAt: now + index,
      updatedAt: now + index,
    }));

    get().bulkImportCollection(collection, requests, folders);
    return collection;
  },

  renameCollection(id, name) {
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === id ? { ...c, name, updatedAt: Date.now() } : c,
      ),
    }));
    const updated = get().collections.find((c) => c.id === id);
    if (updated) persistCollection(updated);
  },

  createFolder(collectionId, parentFolderId = null, name = "New Folder") {
    const parentKey = parentFolderId ?? null;
    const folder: CollectionFolderModel = {
      id: generateId(),
      collectionId,
      name,
      parentFolderId: parentKey,
      order: 0,
    };
    const bumpedFolders: CollectionFolderModel[] = [];
    set((state) => ({
      folders: [
        ...state.folders.map((f) => {
          if (
            f.collectionId === collectionId &&
            f.parentFolderId === parentKey
          ) {
            const bumped = { ...f, order: f.order + 1 };
            bumpedFolders.push(bumped);
            return bumped;
          }
          return f;
        }),
        folder,
      ],
    }));
    for (const bumped of bumpedFolders) {
      persistFolder(bumped);
    }
    persistFolder(folder);
    return folder;
  },

  renameFolder(id, name) {
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
    const updated = get().folders.find((f) => f.id === id);
    if (updated) persistFolder(updated);
  },

  duplicateFolder(folderId) {
    const state = get();
    const root = state.folders.find((f) => f.id === folderId);
    if (!root) return null;

    const subtreeIds: string[] = [];
    function collect(id: string) {
      subtreeIds.push(id);
      for (const child of state.folders.filter(
        (f) => f.parentFolderId === id,
      )) {
        collect(child.id);
      }
    }
    collect(folderId);

    const idMap = new Map<string, string>();
    const newFolders: CollectionFolderModel[] = [];
    const bumpedFolders: CollectionFolderModel[] = [];

    for (const oldId of subtreeIds) {
      const old = state.folders.find((f) => f.id === oldId);
      if (!old) continue;

      const newId = generateId();
      idMap.set(oldId, newId);
      const newParentId =
        old.id === folderId
          ? old.parentFolderId
          : (idMap.get(old.parentFolderId ?? "") ?? null);

      newFolders.push({
        id: newId,
        collectionId: old.collectionId,
        name: old.id === folderId ? `${old.name} (copy)` : old.name,
        parentFolderId: newParentId,
        order: old.id === folderId ? 0 : old.order,
      });
    }

    const parentKey = root.parentFolderId;
    const updatedExisting = state.folders.map((f) => {
      if (
        f.collectionId === root.collectionId &&
        f.parentFolderId === parentKey &&
        f.id !== folderId
      ) {
        const bumped = { ...f, order: f.order + 1 };
        bumpedFolders.push(bumped);
        return bumped;
      }
      return f;
    });

    const now = Date.now();
    const newRequests = state.requests
      .filter(
        (r): r is RequestModel & { folderId: string } =>
          typeof r.folderId === "string" && subtreeIds.includes(r.folderId),
      )
      .map((r, index) => ({
        ...r,
        id: generateId(),
        folderId: idMap.get(r.folderId) ?? null,
        createdAt: now + index,
        updatedAt: now + index,
      }));

    set({
      folders: [...updatedExisting, ...newFolders],
      requests: [...state.requests, ...newRequests],
    });

    for (const bumped of bumpedFolders) {
      persistFolder(bumped);
    }
    for (const folder of newFolders) {
      persistFolder(folder);
    }
    for (const request of newRequests) {
      persistRequest(request);
    }

    return newFolders[0] ?? null;
  },

  deleteFolder(folderId) {
    const state = get();
    const subtreeIds: string[] = [];
    function collect(id: string) {
      subtreeIds.push(id);
      for (const child of state.folders.filter(
        (f) => f.parentFolderId === id,
      )) {
        collect(child.id);
      }
    }
    collect(folderId);

    const requestsToDelete = state.requests.filter(
      (r) => r.folderId && subtreeIds.includes(r.folderId),
    );

    set((s) => ({
      folders: s.folders.filter((f) => !subtreeIds.includes(f.id)),
      requests: s.requests.filter(
        (r) => !r.folderId || !subtreeIds.includes(r.folderId),
      ),
    }));

    for (const id of subtreeIds) {
      deleteFolderFromDB(id);
    }
    for (const request of requestsToDelete) {
      deleteRequestFromDB(request.id);
    }
    useTabsStore
      .getState()
      .closeTabsForRequests(requestsToDelete.map((r) => r.id));
  },

  deleteCollection(id) {
    const requestsToDelete = get().requests.filter(
      (r) => r.collectionId === id,
    );
    const foldersToDelete = get().folders.filter((f) => f.collectionId === id);
    set((state) => ({
      collections: state.collections.filter((c) => c.id !== id),
      folders: state.folders.filter((f) => f.collectionId !== id),
      requests: state.requests.filter((r) => r.collectionId !== id),
    }));
    deleteCollectionFromDB(id);
    for (const folder of foldersToDelete) {
      deleteFolderFromDB(folder.id);
    }
    for (const r of requestsToDelete) {
      deleteRequestFromDB(r.id);
    }
    useTabsStore
      .getState()
      .closeTabsForRequests(requestsToDelete.map((r) => r.id));
    // A collection's chain lives at the same id — cascade the delete so no orphan chain remains.
    useChainStore.getState().deleteChain(id);
  },

  addRequest(collectionId, tab, folderId = null) {
    const request: RequestModel = {
      id: generateId(),
      collectionId,
      folderId,
      name: tab.name,
      method: tab.method,
      url: tab.url,
      params: tab.params,
      headers: tab.headers,
      auth: tab.auth,
      body: tab.body,
      preScript: tab.preScript,
      postScript: tab.postScript,
      timeoutMs: tab.timeoutMs,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({ requests: [...state.requests, request] }));
    persistRequest(request);
    return request;
  },

  updateRequest(id, patch) {
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r,
      ),
    }));
    const updated = get().requests.find((r) => r.id === id);
    if (updated) persistRequest(updated);
  },

  deleteRequest(id) {
    set((state) => ({
      requests: state.requests.filter((r) => r.id !== id),
    }));
    deleteRequestFromDB(id);
    useTabsStore.getState().closeTabsForRequest(id);
  },

  moveRequest(requestId, targetCollectionId) {
    set((state) => ({
      requests: state.requests.map((r) =>
        r.id === requestId
          ? { ...r, collectionId: targetCollectionId, updatedAt: Date.now() }
          : r,
      ),
    }));
    const updated = get().requests.find((r) => r.id === requestId);
    if (updated) persistRequest(updated);
  },

  async hydrate() {
    // Snapshot references so a concurrent user action (e.g. creating a
    // collection while this hydration is still in flight) isn't clobbered
    // by stale data read from IDB below.
    const collectionsBeforeHydration = get().collections;
    const foldersBeforeHydration = get().folders;
    const requestsBeforeHydration = get().requests;
    set({ hydrated: false });
    const db = getDB();
    if (!db) {
      set({ hydrated: true });
      return;
    }
    try {
      const instance = await db;
      const [collections, folders, requests] = await Promise.all([
        instance.getAll("collections"),
        instance.getAll("folders"),
        instance.getAll("requests"),
      ]);
      if (
        get().collections !== collectionsBeforeHydration ||
        get().folders !== foldersBeforeHydration ||
        get().requests !== requestsBeforeHydration
      ) {
        set({ hydrated: true });
        return;
      }
      set({ collections, folders, requests, hydrated: true });
    } catch (error) {
      toast.error("Failed to load collections", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      set({ hydrated: true });
    }
  },

  loadDemoChain() {
    const now = Date.now();
    const collectionId = generateId();
    const collection: CollectionModel = {
      id: collectionId,
      name: "Demo Chain — Auth Flow",
      createdAt: now,
      updatedAt: now,
    };

    const loginRequest: RequestModel = {
      id: generateId(),
      collectionId,
      name: "Login",
      method: "POST",
      url: "https://dummyjson.com/auth/login",
      params: [],
      headers: [
        {
          id: generateId(),
          key: "Content-Type",
          value: "application/json",
          enabled: true,
        },
      ],
      auth: { type: "none" },
      body: {
        type: "json",
        content: '{\n  "username": "emilys",\n  "password": "emilyspass"\n}',
      },
      preScript: "",
      postScript: "",
      createdAt: now,
      updatedAt: now,
    };

    const meRequest: RequestModel = {
      id: generateId(),
      collectionId,
      name: "Get Current User",
      method: "GET",
      url: "https://dummyjson.com/auth/me",
      params: [],
      headers: [],
      auth: { type: "bearer", token: "{{token}}" },
      body: { type: "none", content: "" },
      preScript: "",
      postScript: "",
      createdAt: now + 1,
      updatedAt: now + 1,
    };

    set((state) => ({
      collections: [...state.collections, collection],
      requests: [...state.requests, loginRequest, meRequest],
    }));

    persistCollection(collection);
    persistRequest(loginRequest);
    persistRequest(meRequest);

    return collectionId;
  },
}));
