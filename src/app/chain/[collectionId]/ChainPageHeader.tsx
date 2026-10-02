"use client";

import { MoreHorizontal, PanelBottom, Play, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ClearNodesDialog } from "@/components/chain/dialogs/ClearNodesDialog";
import { RunWithInputsPopover } from "@/components/chain/dialogs/RunWithInputsPopover";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RunBlockReason } from "@/lib/chainRunBlock";
import type { ChainInput } from "@/types/chain";
import { LastRunStatus } from "./LastRunStatus";

const RUN_BLOCK_TITLE_KEYS = {
  empty: "runBlockedEmpty",
  cycle: "resolveCycleToRun",
  invalidMerge: "resolveMergeToRun",
  unpairedLoop: "resolveLoopToRun",
  unresolvedCollect: "resolveCollectToRun",
  loopNesting: "resolveLoopNestingToRun",
  invalidSubChain: "resolveSubChainToRun",
} as const satisfies Partial<Record<RunBlockReason, string>>;

/** Translation key explaining why Run is blocked; `undefined` when runnable. */
export function getRunBlockTitleKey(
  reason: RunBlockReason | null,
):
  | (typeof RUN_BLOCK_TITLE_KEYS)[keyof typeof RUN_BLOCK_TITLE_KEYS]
  | undefined {
  return reason ? RUN_BLOCK_TITLE_KEYS[reason] : undefined;
}

type ChainPageHeaderProps = {
  chainId: string;
  chainTitle: string;
  /** Request nodes plus blocks on the canvas. */
  nodeCount: number;
  edgeCount: number;
  /** True when per-node run badges exist; gates "Clear run results". */
  hasRunResult: boolean;
  isRunning: boolean;
  /** Why Run is disabled (from `getRunBlockReason`); null when the chain can run. */
  runBlockReason: RunBlockReason | null;
  isDockOpen: boolean;
  /** Start block's inputs, when the chain has a Start block. `undefined` hides "Run with inputs" entirely. */
  startInputs?: ChainInput[];
  onToggleDock: () => void;
  /** Called after the user confirms in the Clear nodes dialog. */
  onClearNodes: () => void;
  onClearRunResults: () => void;
  /** Opens the page's clear-edges confirmation. */
  onClearEdges: () => void;
  onStop: () => void;
  onRun: () => void;
  /** Runs the chain with the given Start-input overrides. Only invoked when `startInputs` is defined. */
  onRunWithInputs?: (overrides: Record<string, string>) => void;
};

export function ChainPageHeader({
  chainId,
  chainTitle,
  nodeCount,
  edgeCount,
  hasRunResult,
  isRunning,
  runBlockReason,
  isDockOpen,
  startInputs,
  onToggleDock,
  onClearNodes,
  onClearRunResults,
  onClearEdges,
  onStop,
  onRun,
  onRunWithInputs,
}: ChainPageHeaderProps) {
  const t = useTranslations("chain");
  const [clearNodesOpen, setClearNodesOpen] = useState(false);
  const runBlockTitleKey = getRunBlockTitleKey(runBlockReason);

  const handleConfirmClearNodes = () => {
    onClearNodes();
    setClearNodesOpen(false);
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <h1 className="sr-only">{chainTitle}</h1>
      <AppBreadcrumb
        items={[
          { label: t("breadcrumbHome"), href: "/app" },
          { label: chainTitle },
        ]}
      />
      <span
        data-testid="chain-request-count"
        className="text-xs text-muted-foreground ml-2"
      >
        {t("headerNodeCount", { count: nodeCount })}
      </span>

      <div className="flex-1" />

      <LastRunStatus
        chainId={chainId}
        nodeCount={nodeCount}
        isRunning={isRunning}
      />

      <div className="flex items-center gap-2">
        <Button
          data-testid="toggle-run-log-btn"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          aria-pressed={isDockOpen}
          aria-label={
            isDockOpen ? t("toggleRunLogClose") : t("toggleRunLogOpen")
          }
          onClick={onToggleDock}
        >
          <PanelBottom className="h-3.5 w-3.5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                data-testid="chain-more-actions-btn"
                variant="ghost"
                size="icon-xs"
                aria-label={t("headerMoreActions")}
              />
            }
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              data-testid="clear-nodes-btn"
              disabled={isRunning || nodeCount === 0}
              onClick={() => setClearNodesOpen(true)}
            >
              {t("clearNodesButton")}
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="clear-run-results-btn"
              disabled={isRunning || !hasRunResult}
              onClick={onClearRunResults}
            >
              {t("clearRunResults")}
            </DropdownMenuItem>
            <DropdownMenuItem
              data-testid="clear-edges-btn"
              disabled={isRunning || edgeCount === 0}
              onClick={onClearEdges}
            >
              {t("clearEdgesButton")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {startInputs !== undefined && onRunWithInputs && !isRunning && (
          <RunWithInputsPopover
            inputs={startInputs}
            disabled={runBlockReason !== null}
            onRun={onRunWithInputs}
          />
        )}

        {isRunning ? (
          <Button
            data-testid="stop-chain-btn"
            variant="destructive"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={onStop}
          >
            <Square className="h-3 w-3 fill-current" />
            {t("stopChainButton")}
          </Button>
        ) : (
          <Button
            data-testid="run-chain-btn"
            size="sm"
            className="h-7 gap-1.5 text-xs bg-primary hover:bg-primary/90"
            onClick={onRun}
            disabled={runBlockReason !== null}
            title={runBlockTitleKey ? t(runBlockTitleKey) : undefined}
          >
            <Play className="h-3 w-3 fill-current" />
            {t("runChainButton")}
          </Button>
        )}
      </div>
      <ClearNodesDialog
        open={clearNodesOpen}
        onOpenChange={setClearNodesOpen}
        onConfirm={handleConfirmClearNodes}
      />
    </header>
  );
}
