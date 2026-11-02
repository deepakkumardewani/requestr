import type { Chain } from "@/types/chain";
import type { ChangeView } from "./changeLog";

const CHAIN_ENTITY = "chain";

/** Several consecutive edits of one chain, shown as a single card. */
export type ChangeGroup = {
  kind: "group";
  chainId: string;
  /** The group starts with `create_chain`; otherwise it only updated an existing chain. */
  created: boolean;
  chainName: string;
  /** Members in the order they were made (oldest first). */
  changes: ChangeView[];
  changeIds: string[];
  /** Distinct nodes in the chain after the group's own adds and deletes; connects and renames add none. */
  nodeCount: number;
  /** Every member is undone. */
  undone: boolean;
  /** The chain was deleted by a later change in the same list, so there is nothing to open. */
  deletedLater: boolean;
};

export type SingleChange = { kind: "single"; change: ChangeView };

export type ChangeItem = SingleChange | ChangeGroup;

const asChain = (snapshot: unknown): Partial<Chain> | null =>
  snapshot !== null && typeof snapshot === "object"
    ? (snapshot as Partial<Chain>)
    : null;

/** `delete_chain` leaves no chain behind; every other chain write leaves one. */
const isChainDeletion = (change: ChangeView): boolean =>
  change.entity === CHAIN_ENTITY && change.after === null;

const isGroupable = (change: ChangeView): boolean =>
  change.entity === CHAIN_ENTITY && !isChainDeletion(change);

function nodeCountOf(chain: Partial<Chain> | null): number {
  return (chain?.nodeIds?.length ?? 0) + (chain?.blocks?.length ?? 0);
}

function buildGroup(
  members: ChangeView[],
  laterChanges: readonly ChangeView[],
): ChangeGroup {
  const first = members[0];
  const last = members[members.length - 1];
  const finalChain = asChain(last.after);
  return {
    kind: "group",
    chainId: first.entityId,
    created: first.before === null,
    chainName: finalChain?.name ?? asChain(first.before)?.name ?? "",
    changes: members,
    changeIds: members.map((member) => member.id),
    nodeCount: nodeCountOf(finalChain),
    undone: members.every((member) => member.status === "undone"),
    deletedLater: laterChanges.some(
      (change) => isChainDeletion(change) && change.entityId === first.entityId,
    ),
  };
}

/** A change continues the open run only when it edits the same chain in the same turn. */
const continuesRun = (run: ChangeView[], change: ChangeView): boolean =>
  isGroupable(change) &&
  change.entityId === run[0].entityId &&
  change.turnId === run[0].turnId;

/**
 * Collapses consecutive edits of one chain into a group, leaving every other
 * change as it is. A run of one stays a plain change, `delete_chain` is never
 * grouped, and a different chain or any other change ends the run. Pure: the
 * change log is not touched.
 */
export function groupChanges(changes: readonly ChangeView[]): ChangeItem[] {
  const items: ChangeItem[] = [];
  let run: ChangeView[] = [];
  let runEnd = 0;

  const flush = () => {
    if (run.length === 1) items.push({ kind: "single", change: run[0] });
    else if (run.length > 1) items.push(buildGroup(run, changes.slice(runEnd)));
    run = [];
  };

  changes.forEach((change, index) => {
    if (run.length > 0 && !continuesRun(run, change)) flush();
    if (isGroupable(change)) {
      run.push(change);
      runEnd = index + 1;
      return;
    }
    items.push({ kind: "single", change });
  });
  flush();
  return items;
}
