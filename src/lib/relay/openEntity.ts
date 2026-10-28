import type {
  ChangeSpec,
  CommitOutcome,
  TabSnapshot,
  WorkspaceWriter,
} from "./changeLog";
import type { EntityLinkKind } from "./entityLinks";
import type { StoreAccess } from "./storeAccess";

/**
 * Where each non-request kind lives. Only requests open as tabs; the rest are
 * reached by route, which the caller (a React component) navigates to.
 */
const ENTITY_ROUTES: Record<
  Exclude<EntityLinkKind, "request">,
  (id: string) => string
> = {
  collection: () => "/app",
  environment: () => "/environments",
  chain: (id) => `/chain/${id}`,
};

/** Where Relay-written settings can be reviewed; the section rides along as the hash. */
const SETTINGS_ROUTE = "/settings";

/** What a Changes summary row can open: an entity, or a section of Settings. */
export type OpenTarget =
  | { kind: EntityLinkKind; id: string }
  | { kind: "settings"; id: string };

/** The route for a non-request target; requests open as tabs, so they have none. */
export function routeForTarget(target: OpenTarget): string | null {
  if (target.kind === "request") return null;
  if (target.kind === "settings") {
    return target.id ? `${SETTINGS_ROUTE}#${target.id}` : SETTINGS_ROUTE;
  }
  return ENTITY_ROUTES[target.kind](target.id);
}

/** The entity kind each create tool makes; its id is the first of `createdIds`. */
const CREATED_KIND_BY_TOOL: Readonly<Record<string, EntityLinkKind>> = {
  create_request: "request",
  create_chain: "chain",
  create_collection: "collection",
  create_environment: "environment",
};

/**
 * What a finished create tool made, so its step row can offer Open while the
 * turn is still running. Null for every other tool or an unusable result.
 */
export function createdTarget(
  toolName: string,
  data: unknown,
): OpenTarget | null {
  const kind = CREATED_KIND_BY_TOOL[toolName];
  const createdIds = (data as { createdIds?: unknown } | null)?.createdIds;
  const id = Array.isArray(createdIds) ? createdIds[0] : undefined;
  return kind && typeof id === "string" ? { kind, id } : null;
}

export type OpenEntityDeps = {
  store: StoreAccess;
  /** Absent when no writer is wired up; opening a request then fails like any write. */
  writer: WorkspaceWriter | undefined;
  /** Applies the open: the tool records it in the change log, the pill just runs it. */
  commit: (spec: ChangeSpec) => Promise<CommitOutcome>;
};

/**
 * The one implementation behind the `open_item` tool and the pill click.
 * Requests open (or focus) a tab; other kinds answer with the route to visit.
 */
export async function openEntity(
  kind: EntityLinkKind,
  id: string,
  { store, writer, commit }: OpenEntityDeps,
): Promise<CommitOutcome> {
  if (kind !== "request") {
    if (!store.exists(kind, id)) {
      return { ok: false, error: `${kind} not found: ${id}` };
    }
    return { ok: true, data: { href: ENTITY_ROUTES[kind](id) } };
  }
  const request = store.requests().find((item) => item.id === id);
  if (!request) return { ok: false, error: `request not found: ${id}` };
  const alreadyOpen =
    writer?.tabs().some((tab) => tab.requestId === id) ?? false;
  const before: TabSnapshot = {
    openedForRequestId: alreadyOpen ? null : id,
    activateTabId: writer?.activeTabId() ?? null,
  };
  return commit({
    entity: "tab",
    entityId: id,
    summary: `Opened "${request.name}"`,
    before,
    mutate: () => writer?.openRequest(request),
  });
}
