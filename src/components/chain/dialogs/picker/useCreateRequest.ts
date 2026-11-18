"use client";

import { useCallback } from "react";
import { draftToChainNode } from "@/lib/chainHistoryNode";
import { curlToRequest } from "@/lib/curlToRequest";
import { type AddNodeOptions, useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import type { CollectionModel, HttpMethod, HttpTab } from "@/types";
import type { Chain } from "@/types/chain";
import type { TargetSelection } from "./TargetCollectionPicker";

export type CreateRequestInput =
  | { source: "curl"; text: string; name?: string; target: TargetSelection }
  | {
      source: "blank";
      name: string;
      method: HttpMethod;
      url: string;
      target: TargetSelection;
    };

export type CreateRequestOptions = {
  chainId: string;
  /** Selects the new node and opens its details panel (D14); canvas selection is local state. */
  onNodeAdded?: (nodeId: string) => void;
  placement?: AddNodeOptions;
};

// Session-only memory of the user's last target (PICKER-14): module scope resets on reload.
let rememberedTarget: TargetSelection | null = null;

export function resetRememberedTarget() {
  rememberedTarget = null;
}

/** Collection chain -> its own collection; standalone -> first collection; none -> chain only (D23). */
export function resolveDefaultTarget(
  chain: Pick<Chain, "scope" | "collectionId"> | undefined,
  collections: readonly CollectionModel[],
): TargetSelection {
  const unsaved: TargetSelection = { collectionId: null, folderId: null };
  const exists = (id: string | null | undefined) =>
    !!id && collections.some((c) => c.id === id);

  if (rememberedTarget) {
    const { collectionId } = rememberedTarget;
    if (collectionId === null || exists(collectionId)) return rememberedTarget;
  }
  if (chain?.scope === "collection" && exists(chain.collectionId)) {
    return { collectionId: chain.collectionId ?? null, folderId: null };
  }
  return collections[0]
    ? { collectionId: collections[0].id, folderId: null }
    : unsaved;
}

function buildBlankDraft(
  name: string,
  method: HttpMethod,
  rawUrl: string,
): HttpTab {
  const url = rawUrl.trim();
  return {
    tabId: "",
    requestId: null,
    name: name.trim() || url,
    isDirty: false,
    type: "http",
    method,
    url,
    params: [],
    headers: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
  };
}

/** Throws `CurlToRequestError` for bad cURL, before anything is created. */
function buildDraft(input: CreateRequestInput): HttpTab {
  if (input.source === "blank") {
    return buildBlankDraft(input.name, input.method, input.url);
  }
  const draft = curlToRequest(input.text);
  const name = input.name?.trim();
  return name ? { ...draft, name } : draft;
}

/** A folder deleted since the draft was made falls back to the collection root. */
function validFolderId(
  collectionId: string,
  folderId: string | null,
): string | null {
  if (!folderId) return null;
  const { folders } = useCollectionsStore.getState();
  return folders.some(
    (f) => f.id === folderId && f.collectionId === collectionId,
  )
    ? folderId
    : null;
}

/**
 * Creates a request from the draft and places it on the chain. Returns the new node id.
 * @throws CurlToRequestError when the cURL text is invalid; nothing is created in that case.
 */
export function createRequestInChain(
  input: CreateRequestInput,
  { chainId, onNodeAdded, placement }: CreateRequestOptions,
): string {
  const draft = buildDraft(input);
  const { collections, addRequest } = useCollectionsStore.getState();
  const { addRequestNode, addBlockWithEdge } = useChainStore.getState();
  const { collectionId } = input.target;
  const targetExists =
    !!collectionId && collections.some((c) => c.id === collectionId);

  let nodeId: string;
  if (targetExists) {
    const folderId = validFolderId(collectionId, input.target.folderId);
    nodeId = addRequest(collectionId, draft, folderId).id;
    addRequestNode(chainId, nodeId, placement);
    rememberedTarget = { collectionId, folderId };
  } else {
    const node = draftToChainNode(draft);
    nodeId = node.id;
    addBlockWithEdge(chainId, { ...node, type: "history" }, placement);
    rememberedTarget = { collectionId: null, folderId: null };
  }
  onNodeAdded?.(nodeId);
  return nodeId;
}

export function useCreateRequest(options: CreateRequestOptions) {
  const { chainId, onNodeAdded, placement } = options;
  return useCallback(
    (input: CreateRequestInput) =>
      createRequestInChain(input, { chainId, onNodeAdded, placement }),
    [chainId, onNodeAdded, placement],
  );
}
