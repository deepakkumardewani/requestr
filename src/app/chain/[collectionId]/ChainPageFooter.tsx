"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { DeclaredNamespace } from "@/lib/chainValueNamespace";
import { getUnresolvedRequestVars } from "@/lib/resolveRequest";
import type { RequestModel } from "@/types";
import type { ChainEdge, ChainRunState } from "@/types/chain";

type Props = {
  edges?: ChainEdge[];
  runState?: ChainRunState;
  requests?: RequestModel[];
  resolveVariables?: (text: string) => string;
  /** Names the chain defines at run time; keeps them out of the pre-run count. */
  declaredNamespace?: DeclaredNamespace;
};

export function ChainPageFooter({
  edges = [],
  runState = {},
  requests = [],
  resolveVariables,
  declaredNamespace,
}: Props) {
  const t = useTranslations("tooltips");
  const tChain = useTranslations("chain");

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
  }, [edges, t, tChain, totalUnresolved]);

  return (
    <footer className="flex h-7 shrink-0 items-center justify-center border-t border-border bg-card/50">
      <p className="text-[10px] text-muted-foreground">{hints.join(" · ")}</p>
    </footer>
  );
}
