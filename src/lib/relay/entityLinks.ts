import { createZustandStoreAccess, type StoreAccess } from "./storeAccess";

/** The entity kinds a `relay://` link may point at (FR-180). */
export const ENTITY_LINK_KINDS = [
  "request",
  "collection",
  "environment",
  "chain",
] as const;

export type EntityLinkKind = (typeof ENTITY_LINK_KINDS)[number];

export type EntityLink = { kind: EntityLinkKind; id: string };

export type ResolvedEntity = EntityLink & {
  name: string;
  /** Only set for requests; drives the pill's method badge. */
  method?: string;
};

const ID_PATTERN = "[A-Za-z0-9_-]{1,128}";
const RELAY_HREF = new RegExp(
  `^relay://(${ENTITY_LINK_KINDS.join("|")})/(${ID_PATTERN})$`,
);

/**
 * Accepts only `relay://<kind>/<id>` for the four known kinds with a strict id.
 * Anything else, including other schemes, returns `null`. Pure string match:
 * nothing in the href is ever evaluated (NFR-2).
 */
export function parseRelayHref(href: string | undefined): EntityLink | null {
  const match = href ? RELAY_HREF.exec(href) : null;
  if (!match) return null;
  return { kind: match[1] as EntityLinkKind, id: match[2] };
}

function findNamed(
  list: readonly { id: string; name: string }[],
  id: string,
): { name: string } | null {
  return list.find((item) => item.id === id) ?? null;
}

/** Looks the link up in the live stores; `null` when it is unknown or deleted (FR-180). */
export function resolveEntity(
  link: EntityLink,
  store: StoreAccess = createZustandStoreAccess(),
): ResolvedEntity | null {
  const { kind, id } = link;
  if (kind === "request") {
    const request = store.requests().find((item) => item.id === id);
    return request
      ? { kind, id, name: request.name, method: request.method }
      : null;
  }
  const lists = {
    collection: store.collections(),
    environment: store.environments(),
    chain: store.chains(),
  };
  const found = findNamed(lists[kind], id);
  return found ? { kind, id, name: found.name } : null;
}
