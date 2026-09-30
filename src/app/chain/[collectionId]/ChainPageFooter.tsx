"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { getUnresolvedRequestVars } from "@/lib/resolveRequest";
import type { RequestModel } from "@/types";
import type { ChainEdge, ChainRunState } from "@/types/chain";

type Props = {
  edges?: ChainEdge[];
  runState?: ChainRunState;
  requests?: RequestModel[];
  resolveVariables?: (text: string) => string;
};

export function ChainPageFooter({
  edges = [],
  runState = {},
  requests = [],
  resolveVariables,
}: Props) {
  const t = useTranslations("tooltips");

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
        count += getUnresolvedRequestVars(request, resolveVariables).length;
      }
    }
    return count;
  }, [requests, runState, resolveVariables]);

  // Determine contextual hints based on canvas state
  const hints = useMemo(() => {
    const parts: string[] = [
      "Drag nodes to reposition",
      "Draw from handle to handle to create connections",
      "Delete/Backspace to remove edges",
    ];

    // Show edge configuration hint if edges exist
    if (edges.length > 0) {
      const unconfiguredEdges = edges.filter(
        (edge) => edge.injections.length === 0,
      );
      if (unconfiguredEdges.length > 0) {
        parts.splice(2, 0, t("clickEdgeToMapData"));
      }
    }

    // Show partial run hint
    parts.splice(2, 0, t("rightClickNodeForPartialRuns"));

    // Show unresolved variable count if any
    if (totalUnresolved > 0) {
      parts.push(t("unresolvedVariables", { count: totalUnresolved }));
    }

    return parts;
  }, [edges, t, totalUnresolved]);

  return (
    <footer className="flex h-7 shrink-0 items-center justify-center border-t border-border bg-card/50">
      <p className="text-[10px] text-muted-foreground">{hints.join(" · ")}</p>
    </footer>
  );
}
