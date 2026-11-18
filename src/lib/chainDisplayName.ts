import type { CollectionModel } from "@/types";
import type { Chain } from "@/types/chain";

/**
 * Collection chains take their title from the collections store at read time
 * (spec P1.4a) so renaming a collection never desyncs it. The name persisted
 * on the chain record is only a fallback for a collection that is missing.
 */
export function getChainDisplayName(
  chain: Pick<Chain, "id" | "scope" | "name">,
  collections: Pick<CollectionModel, "id" | "name">[],
): string {
  if (chain.scope !== "collection") return chain.name;
  return collections.find((c) => c.id === chain.id)?.name ?? chain.name;
}
