import type { ChainEdge } from "@/types/chain";

/**
 * P2.14 "fixture DAG": the graph whose concurrency = 1 execution order was
 * recorded before the ready-queue scheduler replaced the Kahn walk. Requests
 * are listed in a deliberately non-topological order so the snapshot pins both
 * the Kahn dependency order and the insertion-order tie-break.
 *
 *   root ─┬─> left ──┬─> join ──> tail
 *         └─> right ─┘
 *   side ───────────────^        (independent root feeding join)
 */
export const P214_REQUEST_IDS = [
  "tail",
  "left",
  "side",
  "root",
  "right",
  "join",
];

export const P214_EDGES: ChainEdge[] = [
  {
    id: "e1",
    sourceRequestId: "root",
    targetRequestId: "left",
    injections: [],
  },
  {
    id: "e2",
    sourceRequestId: "root",
    targetRequestId: "right",
    injections: [],
  },
  {
    id: "e3",
    sourceRequestId: "left",
    targetRequestId: "join",
    injections: [],
  },
  {
    id: "e4",
    sourceRequestId: "right",
    targetRequestId: "join",
    injections: [],
  },
  {
    id: "e5",
    sourceRequestId: "side",
    targetRequestId: "join",
    injections: [],
  },
  {
    id: "e6",
    sourceRequestId: "join",
    targetRequestId: "tail",
    injections: [],
  },
];
