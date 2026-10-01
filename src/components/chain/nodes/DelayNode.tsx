"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useEffect, useRef, useState } from "react";
import type { ChainNodeState } from "@/types/chain";
import { NodeShell } from "./NodeShell";
import { StateIcon } from "./nodeStateStyles";
import { useBlockNodeActions } from "./useNodeToolbarActions";

export type DelayNodeData = {
  nodeId: string;
  delayMs: number;
  state: ChainNodeState;
  error?: string;
  onUpdateDelay?: (id: string, delayMs: number) => void;
  onDeleteNode?: (nodeId: string) => void;
  isKeyboardFocused?: boolean;
};

function DelayNodeInner({ data }: { data: DelayNodeData }) {
  const t = useTranslations("tooltips");
  const tChain = useTranslations("chain");
  const { nodeId, delayMs, state, error, onUpdateDelay, onDeleteNode } = data;
  const toolbar = useBlockNodeActions({
    nodeId,
    onDeleteNode,
    labels: { remove: t("removeDelayFromChain") },
  });
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(delayMs));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(String(delayMs));
  }, [delayMs, isEditing]);

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  function commitEdit() {
    const parsed = parseInt(draft, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      onUpdateDelay?.(nodeId, parsed);
    } else {
      setDraft(String(delayMs));
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") {
      setDraft(String(delayMs));
      setIsEditing(false);
    }
  }

  return (
    <NodeShell
      testId={`delay-node-${nodeId}`}
      state={state}
      error={error}
      isKeyboardFocused={data.isKeyboardFocused}
      toolbar={toolbar}
      cardClassName="min-w-[160px] px-3 py-2"
    >
      <div className="flex items-center gap-2">
        {/* Clock stays amber — Loader2 in StateIcon shows running state */}
        <Clock className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />

        <div className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground text-xs">
            {tChain("delayNodeWait")}
          </span>
          {isEditing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="w-16 rounded border border-border bg-muted px-1 py-0 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              type="number"
              min={0}
              aria-label={tChain("delayNodeDurationAriaLabel")}
            />
          ) : (
            <button
              type="button"
              data-testid="delay-value-btn"
              className="rounded px-0.5 text-xs font-semibold text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              aria-label={tChain("delayNodeEditAriaLabel", { ms: delayMs })}
            >
              {delayMs}
            </button>
          )}
          <span className="text-muted-foreground text-xs">
            {tChain("delayNodeUnitMs")}
          </span>
        </div>

        {state !== "idle" && (
          <div className="ml-auto shrink-0">
            <StateIcon state={state} />
          </div>
        )}
      </div>
    </NodeShell>
  );
}

export const DelayNode = memo(DelayNodeInner);
