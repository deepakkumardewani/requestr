"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { getDB } from "@/lib/idb";
import { generateId } from "@/lib/utils";
import { useTabsStore } from "@/stores/useTabsStore";
import type { CollectionModel, HttpTab, RequestModel } from "@/types";

type CollectionsState = {
  collections: CollectionModel[];
  requests: RequestModel[];
};

type CollectionsActions = {
  createCollection: (name: string) => CollectionModel;
  bulkImportCollection: (
    collection: CollectionModel,
    requests: RequestModel[],
  ) => void;
  renameCollection: (id: string, name: string) => void;
  deleteCollection: (id: string) => void;
  addRequest: (collectionId: string, tab: HttpTab) => RequestModel;
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
  requests: [],

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

  bulkImportCollection(collection, requests) {
    set((state) => ({
      collections: [...state.collections, collection],
      requests: [...state.requests, ...requests],
    }));
    persistCollection(collection);
    for (const request of requests) {
      persistRequest(request);
    }
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

  deleteCollection(id) {
    const requestsToDelete = get().requests.filter(
      (r) => r.collectionId === id,
    );
    set((state) => ({
      collections: state.collections.filter((c) => c.id !== id),
      requests: state.requests.filter((r) => r.collectionId !== id),
    }));
    deleteCollectionFromDB(id);
    for (const r of requestsToDelete) {
      deleteRequestFromDB(r.id);
    }
    useTabsStore
      .getState()
      .closeTabsForRequests(requestsToDelete.map((r) => r.id));
  },

  addRequest(collectionId, tab) {
    const request: RequestModel = {
      id: generateId(),
      collectionId,
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
    const db = getDB();
    if (!db) return;
    try {
      const instance = await db;
      const [collections, requests] = await Promise.all([
        instance.getAll("collections"),
        instance.getAll("requests"),
      ]);
      set({ collections, requests });
    } catch (error) {
      toast.error("Failed to load collections", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
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
