import type { ChangeView } from "./changeLog";
import type { OpenTarget } from "./openEntity";
import type { StoreAccess } from "./storeAccess";

export type ChangeOp = "created" | "updated" | "deleted";

/** The wording kinds of the headline; anything without its own noun is an "item". */
export type SummaryKind =
  | "request"
  | "chain"
  | "collection"
  | "environment"
  | "item";

export type OpenDisabledReason = "deleted" | "undone";

/** What the Open button does: act, sit disabled with a reason, or be absent. */
export type OpenState =
  | { enabled: true; target: OpenTarget }
  | { enabled: false; reason: OpenDisabledReason }
  | null;

export type SummaryRow = {
  changeId: string;
  op: ChangeOp;
  kind: SummaryKind;
  label: string;
  open: OpenState;
};

export type HeadlineGroup = { op: ChangeOp; kind: SummaryKind; count: number };

export type ChangesSummary = { rows: SummaryRow[]; groups: HeadlineGroup[] };

const BATCH_ID_SEPARATOR = ",";
const SETTINGS_ENTITY = "settings";
const HEADLINE_SEPARATOR = ", ";
const OPS: readonly ChangeOp[] = ["created", "updated", "deleted"];
const KINDS: readonly SummaryKind[] = [
  "request",
  "chain",
  "collection",
  "environment",
  "item",
];

/** A write that opens or focuses a tab leaves nothing to review or undo as a change. */
const NAVIGATION_ENTITIES: ReadonlySet<string> = new Set(["tab"]);

function opOf(change: ChangeView): ChangeOp {
  if (change.before === null) return "created";
  const after = change.after;
  const gone = Array.isArray(after)
    ? after.every((item) => item === null)
    : after === null;
  return gone ? "deleted" : "updated";
}

type Entity = {
  kind: SummaryKind;
  id: string;
  label: string;
  /** The entity to check for existence and open; folders open their collection. */
  target: OpenTarget | null;
};

/** The name a request snapshot in the change carries, so a deleted or undone row keeps its name. */
function snapshotName(change: ChangeView, id: string): string | undefined {
  for (const snapshot of [change.after, change.before]) {
    const items: unknown[] = Array.isArray(snapshot) ? snapshot : [snapshot];
    for (const item of items) {
      const record = item as { id?: unknown; name?: unknown } | null;
      if (record?.id === id && typeof record.name === "string") {
        return record.name;
      }
    }
  }
  return undefined;
}

function requestEntities(change: ChangeView, store: StoreAccess): Entity[] {
  return change.entityId.split(BATCH_ID_SEPARATOR).map((id) => ({
    kind: "request",
    id,
    label:
      store.requests().find((item) => item.id === id)?.name ??
      snapshotName(change, id) ??
      id,
    target: { kind: "request", id },
  }));
}

function treeEntity(change: ChangeView, store: StoreAccess): Entity {
  const folder = store.folders().find((item) => item.id === change.entityId);
  const collectionId = folder?.collectionId ?? change.entityId;
  return {
    kind: "collection",
    id: change.entityId,
    label: change.summary,
    target: { kind: "collection", id: collectionId },
  };
}

function entitiesOf(change: ChangeView, store: StoreAccess): Entity[] {
  const { entity, entityId, summary } = change;
  const single = (kind: SummaryKind, target: OpenTarget | null): Entity[] => [
    { kind, id: entityId, label: summary, target },
  ];
  switch (entity) {
    case "request":
    case "requests":
      return requestEntities(change, store);
    case "chain":
      return single("chain", { kind: "chain", id: entityId });
    case "environment":
    case "activeEnvironment":
      return single("environment", { kind: "environment", id: entityId });
    case "collection":
    case "folder":
    case "tree":
      return [treeEntity(change, store)];
    case SETTINGS_ENTITY:
      return single("item", { kind: "settings", id: entityId });
    default:
      return single("item", null);
  }
}

/** Settings sections never disappear, so only entities need a live check. */
function targetExists(target: OpenTarget, store: StoreAccess): boolean {
  return target.kind === "settings" || store.exists(target.kind, target.id);
}

/** Open resolves from the change's state first (undone), then from what exists now. */
function resolveOpen(
  change: ChangeView,
  op: ChangeOp,
  target: OpenTarget | null,
  store: StoreAccess,
): OpenState {
  if (!target) return null;
  if (change.status === "undone") return { enabled: false, reason: "undone" };
  if (op === "deleted" || !targetExists(target, store)) {
    return { enabled: false, reason: "deleted" };
  }
  return { enabled: true, target };
}

function groupRows(rows: readonly SummaryRow[]): HeadlineGroup[] {
  return OPS.flatMap((op) =>
    KINDS.flatMap((kind) => {
      const count = rows.filter(
        (row) => row.op === op && row.kind === kind,
      ).length;
      return count > 0 ? [{ op, kind, count }] : [];
    }),
  );
}

/**
 * The pure model behind the Changes summary: one row per changed entity and
 * the counts the headline is built from. Undone changes keep their row (so
 * the reply stays honest) but no longer count toward the headline.
 */
export function buildChangesSummary(
  changes: readonly ChangeView[],
  store: StoreAccess,
): ChangesSummary {
  const rows = changes
    .filter((change) => !NAVIGATION_ENTITIES.has(change.entity))
    .flatMap((change) => {
      const op = opOf(change);
      return entitiesOf(change, store).map(
        (entity): SummaryRow => ({
          changeId: change.id,
          op,
          kind: entity.kind,
          label: entity.label,
          open: resolveOpen(change, op, entity.target, store),
        }),
      );
    });
  const live = rows.filter(
    (row) => !(row.open && !row.open.enabled && row.open.reason === "undone"),
  );
  return { rows, groups: groupRows(live) };
}

type Translate = (
  key: `summary.count.${SummaryKind}` | `summary.run.${ChangeOp}`,
  values: { count: number } | { items: string },
) => string;

/**
 * "Created 2 requests, 1 chain, updated 1 environment": each verb is said once
 * per run of the same op, the counts inside a run are bare nouns. Groups are
 * ordered by op, so a run is a contiguous slice. Only the first letter is capitalised.
 */
export function formatHeadline(
  groups: readonly HeadlineGroup[],
  t: Translate,
): string {
  const text = OPS.flatMap((op) => {
    const run = groups.filter((group) => group.op === op);
    if (run.length === 0) return [];
    const items = run
      .map((group) => t(`summary.count.${group.kind}`, { count: group.count }))
      .join(HEADLINE_SEPARATOR);
    return [t(`summary.run.${op}`, { items })];
  }).join(HEADLINE_SEPARATOR);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
