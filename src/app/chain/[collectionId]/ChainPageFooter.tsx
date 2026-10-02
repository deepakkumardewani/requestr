"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { DeclaredNamespace } from "@/lib/chainValueNamespace";
import { getUnresolvedRequestVars } from "@/lib/resolveRequest";
import { useUIStore } from "@/stores/useUIStore";
import type { RequestModel } from "@/types";
import type { ChainEdge, ChainRunState } from "@/types/chain";

type Props = {
  edges?: ChainEdge[];
  runState?: ChainRunState;
  requests?: RequestModel[];
  resolveVariables?: (text: string) => string;
  /** Names the chain defines at run time; keeps them out of the pre-run count. */
  declaredNamespace?: DeclaredNamespace;
  /** True when the chain has no nodes; drops the interaction hints (the canvas overlay explains how to start). */
  isEmpty?: boolean;
};

export function ChainPageFooter({
  edges = [],
  runState = {},
  requests = [],
  resolveVariables,
  declaredNamespace,
  isEmpty = false,
}: Props) {
  const t = useTranslations("tooltips");
  const tChain = useTranslations("chain");
  const isRunLogExpanded = useUIStore((state) => !state.chainRunLogCollapsed);
  const hintsDismissed = useUIStore((state) => state.hintsDismissed);
  const setHintsDismissed = useUIStore((state) => state.setHintsDismissed);

  // Compute total unresolved variable count across all API nodes. Before a node has
  // run, `runState` has no entry yet — fall back to the same dry-run resolve the
  // node pill uses so the footer count never disagrees with what's on the canvas.
  const totalUnresolved = useMemo(() => {
    const requestById = new Map(
      requests.map((request) => [request.id, request]),
    );
    const nodeIds = new Set([...requestById.keys(), ...Object.keys(runState)]);

    let count = 0;
    for (const nodeId of nodeIds) {
      const nodeState = runState[nodeId];
      if (nodeState?.unresolvedVars) {
        count += nodeState.unresolvedVars.length;
        continue;
      }
      const request = requestById.get(nodeId);
      if (request && resolveVariables) {
        count += getUnresolvedRequestVars(
          request,
          resolveVariables,
          declaredNamespace?.chainInputs,
          declaredNamespace?.aliasValues,
        ).length;
      }
    }
    return count;
  }, [requests, runState, resolveVariables, declaredNamespace]);

  // Built in final display order so no hint depends on splice indexes.
  const hints = useMemo(() => {
    // Drag/edge hints are meaningless without nodes (the empty-canvas overlay
    // carries the add-block hint), are noise while the run-log dock is open, and
    // are opt-out via "Hide tips"; in all cases keep only the unresolved count
    // so a warning is never hidden.
    if (isEmpty || isRunLogExpanded || hintsDismissed) {
      return totalUnresolved > 0
        ? [t("unresolvedVariables", { count: totalUnresolved })]
        : [];
    }
    const hasEdges = edges.length > 0;
    const hasUnconfiguredEdge = edges.some(
      (edge) => edge.injections.length === 0,
    );
    return [
      tChain("footerHintDragNodes"),
      tChain("footerHintDrawConnections"),
      t("rightClickNodeForPartialRuns"),
      ...(hasUnconfiguredEdge ? [t("clickEdgeToMapData")] : []),
      // Delete only applies to edges, so the hint is noise on an edge-less canvas.
      ...(hasEdges ? [tChain("footerHintDeleteEdges")] : []),
      ...(totalUnresolved > 0
        ? [t("unresolvedVariables", { count: totalUnresolved })]
        : []),
    ];
  }, [
    edges,
    hintsDismissed,
    isEmpty,
    isRunLogExpanded,
    t,
    tChain,
    totalUnresolved,
  ]);

  if (hintsDismissed && hints.length === 0) return null;

  // "Hide tips" only makes sense while tips are actually showing.
  const canHideTips = !hintsDismissed && !isEmpty && !isRunLogExpanded;

  return (
    <footer className="relative flex h-7 shrink-0 items-center justify-center border-t border-border bg-card/50">
      <p className="text-[10px] text-muted-foreground">{hints.join(" · ")}</p>
      {canHideTips && (
        <button
          type="button"
          onClick={() => setHintsDismissed(true)}
          className="absolute right-2 rounded px-1 text-[10px] text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          {tChain("footerHideTips")}
        </button>
      )}
    </footer>
  );
}
