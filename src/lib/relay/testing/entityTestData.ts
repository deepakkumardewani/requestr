import type { CollectionModel, EnvironmentModel, RequestModel } from "@/types";
import type { Chain } from "@/types/chain";
import { CHAIN_SCHEMA_VERSION } from "@/types/chain";

/** Create a minimal valid RequestModel for testing. */
export const createRequest = (
  id: string,
  name: string = "Request",
): RequestModel => ({
  id,
  collectionId: "col1",
  name,
  method: "GET",
  url: "https://api.example.com",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

/** Create a minimal valid CollectionModel for testing. */
export const createCollection = (
  id: string,
  name: string = "Collection",
): CollectionModel => ({
  id,
  name,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

/** Create a minimal valid EnvironmentModel for testing. */
export const createEnvironment = (
  id: string,
  name: string = "Environment",
): EnvironmentModel => ({
  id,
  name,
  variables: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

/** Create a minimal valid Chain for testing. */
export const createChain = (id: string, name: string = "Chain"): Chain => ({
  id,
  scope: "standalone",
  schemaVersion: CHAIN_SCHEMA_VERSION,
  name,
  blocks: [],
  nodeIds: [],
  edges: [],
  nodePositions: {},
});
