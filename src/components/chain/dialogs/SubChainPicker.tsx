"use client";

import { Ban, Workflow } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChainStore } from "@/stores/useChainStore";
import type { Chain } from "@/types/chain";

type SubChainPickerProps = {
  open: boolean;
  onClose: () => void;
  /** The chain hosting the SubChain block being configured — excluded from the list, and used to refuse cyclic picks. */
  currentChainId: string;
  onSelect: (chainId: string) => void;
};

/**
 * True when adding `candidateChainId` as a subchain reference inside
 * `currentChainId` would create a cycle — either a direct self-reference
 * or a transitive one (the candidate, through its own subchain blocks,
 * already reaches back to the current chain).
 */
function wouldCreateCycle(
  chains: Record<string, Chain>,
  currentChainId: string,
  candidateChainId: string,
): boolean {
  if (candidateChainId === currentChainId) return true;

  const visited = new Set<string>();
  function walk(chainId: string): boolean {
    if (chainId === currentChainId) return true;
    if (visited.has(chainId)) return false;
    visited.add(chainId);

    const chain = chains[chainId];
    if (!chain) return false;

    for (const block of chain.blocks) {
      if (block.type !== "subchain") continue;
      if (walk(block.chainId)) return true;
    }
    return false;
  }

  return walk(candidateChainId);
}

export function SubChainPicker({
  open,
  onClose,
  currentChainId,
  onSelect,
}: SubChainPickerProps) {
  const t = useTranslations("chain");
  const { chains } = useChainStore();
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    return Object.values(chains)
      .filter((chain) => chain.id !== currentChainId)
      .filter((chain) =>
        chain.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [chains, currentChainId, search]);

  function handleSelect(chainId: string) {
    if (wouldCreateCycle(chains, currentChainId, chainId)) return;
    onSelect(chainId);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        data-testid="subchain-picker-dialog"
        className="max-w-[calc(100%-2rem)] sm:max-w-md p-0 gap-0 overflow-hidden"
      >
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold tracking-tight">
            {t("subChainPickerTitle")}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("subChainPickerSearchPlaceholder")}
            aria-label={t("subChainPickerSearchPlaceholder")}
            data-testid="subchain-picker-search"
            className="h-8 text-sm"
          />
        </div>

        <ScrollArea className="h-[320px] px-3 pb-3">
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[240px] text-muted-foreground gap-2">
              <Workflow className="h-6 w-6 opacity-50" />
              <p className="text-sm">{t("subChainPickerNoResults")}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {candidates.map((chain) => {
                const refused = wouldCreateCycle(
                  chains,
                  currentChainId,
                  chain.id,
                );
                return (
                  <div
                    key={chain.id}
                    role="button"
                    tabIndex={refused ? -1 : 0}
                    data-testid={`subchain-picker-item-${chain.id}`}
                    aria-disabled={refused}
                    title={
                      refused ? t("subChainPickerCyclicRefused") : undefined
                    }
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                      refused
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer hover:bg-muted/80",
                    )}
                    onClick={() => !refused && handleSelect(chain.id)}
                    onKeyDown={(e) => {
                      if (refused) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelect(chain.id);
                      }
                    }}
                  >
                    {refused ? (
                      <Ban className="h-4 w-4 shrink-0 text-destructive" />
                    ) : (
                      <Workflow className="h-4 w-4 shrink-0 text-cyan-400" />
                    )}
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-[13px] font-medium truncate text-foreground/90 leading-tight">
                        {chain.name}
                      </span>
                      {refused && (
                        <span className="text-[10px] text-destructive leading-tight">
                          {t("subChainPickerCyclicRefused")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
