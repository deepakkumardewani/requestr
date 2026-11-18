import { useMemo } from "react";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import type { RequestModel } from "@/types";
import type { Chain } from "@/types/chain";

export type ChainRequestsResult = {
  /** requestId -> resolved collection request, for every id in `chain.nodeIds` that still exists. */
  requests: Record<string, RequestModel>;
  /** ids in `chain.nodeIds` with no matching collection request (deleted since the chain last saved). */
  missingIds: string[];
};

/** Resolves a chain's `nodeIds` to their collection request records, memoized on inputs. */
export function useChainRequests(
  chain: Chain | undefined,
): ChainRequestsResult {
  const allRequests = useCollectionsStore((state) => state.requests);

  return useMemo(() => {
    const nodeIds = chain?.nodeIds ?? [];
    const byId = new Map(allRequests.map((r) => [r.id, r]));
    const requests: Record<string, RequestModel> = {};
    const missingIds: string[] = [];

    for (const id of nodeIds) {
      const request = byId.get(id);
      if (request) requests[id] = request;
      else missingIds.push(id);
    }

    return { requests, missingIds };
  }, [chain?.nodeIds, allRequests]);
}
