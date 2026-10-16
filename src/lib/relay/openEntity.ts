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
