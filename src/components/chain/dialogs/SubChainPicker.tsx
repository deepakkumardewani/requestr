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
import { getChainDisplayName } from "@/lib/chainDisplayName";
import { reaches } from "@/lib/subChainGraph";
import { cn } from "@/lib/utils";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";

type SubChainPickerProps = {
  open: boolean;
  onClose: () => void;
  /** The chain hosting the SubChain block being configured — excluded from the list, and used to refuse cyclic picks. */
  currentChainId: string;
  onSelect: (chainId: string) => void;
};

export function SubChainPicker({
  open,
  onClose,
  currentChainId,
  onSelect,
}: SubChainPickerProps) {
  const t = useTranslations("chain");
  const chains = useChainStore((s) => s.chains);
  const collections = useCollectionsStore((s) => s.collections);
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return Object.values(chains)
      .filter((chain) => chain.id !== currentChainId)
      .map((chain) => ({
        chain,
        label: getChainDisplayName(chain, collections),
      }))
      .filter(({ label }) => label.toLowerCase().includes(query))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [chains, collections, currentChainId, search]);

  function handleSelect(chainId: string) {
    if (reaches(chains, chainId, currentChainId)) return;
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
              {candidates.map(({ chain, label }) => {
                const refused = reaches(chains, chain.id, currentChainId);
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
                        {label}
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
