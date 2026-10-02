import type { Node } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { BLOCK_REGISTRY } from "@/components/chain/blockRegistry";
import { type HighlightRange, searchItems } from "@/lib/pickerSearch";
import type { HttpMethod } from "@/types";
import { CHAIN_NODE_TYPES, type ChainNodeType } from "@/types/chain";

export type NodeSearchResult = {
  id: string;
  type: ChainNodeType;
  label: string;
  method?: HttpMethod;
  nameRanges: readonly HighlightRange[];
};

type ApiNodeData = { name?: string; method?: HttpMethod; url?: string };

const TYPE_BY_FLOW_NODE_TYPE = new Map<string | undefined, ChainNodeType>(
  CHAIN_NODE_TYPES.map((type) => [BLOCK_REGISTRY[type].flowNodeType, type]),
);

/**
 * Filters canvas nodes by name (API nodes) or block label (every other block),
 * ranked by `pickerSearch`. An empty query keeps canvas order.
 */
export function useNodeSearch(
  nodes: readonly Node[],
  query: string,
): NodeSearchResult[] {
  const t = useTranslations("chain");

  const items = useMemo(
    () =>
      nodes.flatMap((node) => {
        const type = TYPE_BY_FLOW_NODE_TYPE.get(node.type);
        if (!type) return [];
        const data = node.data as ApiNodeData;
        const isApi = type === "api";
        const label = (isApi && data.name) || t(BLOCK_REGISTRY[type].labelKey);
        return [
          {
            id: node.id,
            type,
            name: label,
            method: isApi ? data.method : undefined,
            url: isApi ? data.url : undefined,
          },
        ];
      }),
    [nodes, t],
  );

  return useMemo(
    () =>
      searchItems(query, items).map(({ item, match }) => ({
        id: item.id,
        type: item.type,
        label: item.name,
        method: item.method,
        nameRanges: match.nameRanges,
      })),
    [query, items],
  );
}
