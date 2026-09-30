/**
 * Development-only window helper for seeding chain fixtures.
 * Invoked via browser console or chrome-devtools evaluate_script.
 *
 * Usage:
 *   window.__chainDev.seed('twoApiNodes')  // returns { url: '/chain/fixture-two-api', scenario: 'twoApiNodes' }
 *   window.__chainDev.cleanup()  // removes all seeded fixtures
 *
 * The stores are injected at initialization via exposeChainDevAPI(stores).
 */

import { createAllFixtures } from "@/lib/dev/chainFixtures";
import type { CollectionModel, EnvironmentModel, HttpTab } from "@/types";
import type { ChainBlock, ChainEdge } from "@/types/chain";

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────

export interface ChainDevAPI {
  /**
   * Seed a fixture scenario: creates collection, requests, chain, and (for envVar) environment.
   * @param scenario - One of: twoApiNodes, withDisplay, envVar, unreachable, slow, allNodeTypes
   * @returns { url: string; scenario: string; collectionId: string } — the path to navigate to
   */
  seed: (scenario: string) => Promise<{
    url: string;
    scenario: string;
    collectionId: string;
  }>;

  /**
   * Remove a seeded fixture: deletes chain, requests, and collection.
   */
  cleanup: (chainId?: string) => Promise<void>;

  /**
   * List all available scenarios.
   */
  listScenarios: () => string[];
}

export interface StoreAccessor {
  collectionsStore: {
    createCollection: (name: string) => CollectionModel;
    addRequest: (collectionId: string, tab: HttpTab) => { id: string };
    deleteCollection: (id: string) => void;
    collections: Array<{ id: string }>;
  };
  chainStore: {
    createChain: (name: string) => string;
    addRequestNode: (chainId: string, requestId: string) => void;
    upsertBlock: (chainId: string, block: ChainBlock) => void;
    upsertEdge: (chainId: string, edge: ChainEdge) => void;
    updateNodePosition: (
      chainId: string,
      nodeId: string,
      pos: { x: number; y: number },
    ) => void;
    deleteChain: (chainId: string) => void;
  };
  environmentsStore: {
    createEnv: (name: string) => EnvironmentModel;
    updateEnv: (id: string, patch: Partial<EnvironmentModel>) => void;
    setActiveEnv: (id: string | null) => void;
    deleteEnv: (id: string) => void;
  };
}

/**
 * Create the dev API object with injected stores.
 */
export function createChainDevAPI(stores: StoreAccessor): ChainDevAPI {
  const fixtures = createAllFixtures();
  const fixtureIds = new Set(Object.values(fixtures).map((f) => f.chain.id));
  const fixtureCollectionIds = new Set(
    Object.values(fixtures).map((f) => f.collectionId),
  );
  const fixtureEnvIds = new Set<string>();

  return {
    async seed(scenario: string) {
      const fixture = fixtures[scenario];
      if (!fixture) {
        throw new Error(
          `Unknown scenario: ${scenario}. Available: ${Object.keys(fixtures).join(", ")}`,
        );
      }

      const { chain, requests } = fixture;

      // 1. Create collection
      const collection = stores.collectionsStore.createCollection(
        `Fixture: ${scenario}`,
      );
      fixtureCollectionIds.add(collection.id);

      // 2. Create requests and map old IDs to new IDs
      const idMapping = new Map<string, string>();
      const requestIds: string[] = [];
      for (const request of requests) {
        const tab = {
          tabId: "",
          requestId: null,
          name: request.name,
          isDirty: false,
          type: "http" as const,
          url: request.url,
          method: request.method,
          headers: request.headers,
          params: request.params,
          auth: request.auth,
          body: request.body,
          preScript: request.preScript,
          postScript: request.postScript,
          timeoutMs: request.timeoutMs,
        };
        const created = stores.collectionsStore.addRequest(collection.id, tab);
        idMapping.set(request.id, created.id);
        requestIds.push(created.id);
      }

      // 3. Create chain
      const chainId = stores.chainStore.createChain(chain.name);

      // 4. Add request nodes to chain
      for (const newRequestId of requestIds) {
        stores.chainStore.addRequestNode(chainId, newRequestId);
      }

      // 5. Add blocks to chain via store action
      for (const block of chain.blocks) {
        stores.chainStore.upsertBlock(chainId, block);
      }

      // 6. Add edges to chain via store action (map request IDs if needed)
      for (const edge of chain.edges) {
        const mappedEdge = {
          ...edge,
          sourceRequestId:
            idMapping.get(edge.sourceRequestId) || edge.sourceRequestId,
          targetRequestId:
            idMapping.get(edge.targetRequestId) || edge.targetRequestId,
        };
        stores.chainStore.upsertEdge(chainId, mappedEdge);
      }

      // 7. Update node positions via store action (map IDs for request nodes, keep block IDs as-is)
      for (const [nodeId, pos] of Object.entries(chain.nodePositions)) {
        const mappedNodeId = idMapping.get(nodeId) || nodeId;
        stores.chainStore.updateNodePosition(chainId, mappedNodeId, pos);
      }

      // 8. For envVar fixture, create and activate environment
      if (scenario === "envVar") {
        const env = stores.environmentsStore.createEnv("Fixture Environment");
        stores.environmentsStore.updateEnv(env.id, {
          variables: [
            {
              id: "fixture-var-baseurl",
              key: "baseUrl",
              initialValue: "https://httpbin.org",
              currentValue: "https://httpbin.org",
              isSecret: false,
            },
          ],
        });
        stores.environmentsStore.setActiveEnv(env.id);
        fixtureEnvIds.add(env.id);
      }

      return {
        url: `/chain/${chainId}`,
        scenario,
        collectionId: collection.id,
      };
    },

    async cleanup(chainId?: string) {
      if (chainId) {
        // Delete specific chain
        stores.chainStore.deleteChain(chainId);
        // Find and delete associated collection
        for (const collId of fixtureCollectionIds) {
          const collection = stores.collectionsStore.collections.find(
            (c) => c.id === collId,
          );
          if (collection) {
            stores.collectionsStore.deleteCollection(collId);
          }
        }
      } else {
        // Clean up all fixture IDs
        for (const id of fixtureIds) {
          stores.chainStore.deleteChain(id);
        }
        for (const collId of fixtureCollectionIds) {
          stores.collectionsStore.deleteCollection(collId);
        }
        for (const envId of fixtureEnvIds) {
          stores.environmentsStore.deleteEnv(envId);
        }
      }
    },

    listScenarios() {
      return Object.keys(fixtures);
    },
  };
}

/**
 * Expose to window in development mode.
 * Must be called with stores injected.
 */
declare global {
  interface Window {
    __chainDev?: ChainDevAPI;
  }
}

export function exposeChainDevAPI(stores: StoreAccessor): void {
  if (typeof window === "undefined") return;
  window.__chainDev = createChainDevAPI(stores);
}
