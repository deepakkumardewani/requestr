"use client";

import { GitBranch, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { EmptyState } from "@/components/common/EmptyState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useChainStore } from "@/stores/useChainStore";

type ChainListProps = {
  isCreating: boolean;
  onCreatingDone: () => void;
};

export function ChainList({ isCreating, onCreatingDone }: ChainListProps) {
  const t = useTranslations();
  const { chains, hydrated, createChain, renameChain, deleteChain } =
    useChainStore();
  const router = useRouter();

  const [newChainName, setNewChainName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const newChainInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isCreating) return;
    const timer = setTimeout(() => newChainInputRef.current?.focus(), 150);
    return () => clearTimeout(timer);
  }, [isCreating]);

  const chainList = Object.values(chains)
    .filter((chain) => chain.scope === "standalone")
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  if (!hydrated && !isCreating) {
    return null;
  }

  const handleCreateConfirm = () => {
    const name = newChainName.trim();
    if (!name) {
      onCreatingDone();
      return;
    }
    const id = createChain(name);
    setNewChainName("");
    onCreatingDone();
    router.push(`/chain/${id}`);
  };

  return (
    <div className="py-1">
      {isCreating && (
        <div className="px-2 pb-1">
          <Input
            ref={newChainInputRef}
            data-testid="new-chain-name-input"
            className="h-7 text-xs"
            value={newChainName}
            placeholder={t("navigation.newChain")}
            onChange={(e) => setNewChainName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateConfirm();
              if (e.key === "Escape") {
                setNewChainName("");
                onCreatingDone();
              }
            }}
            onBlur={() => {
              setNewChainName("");
              onCreatingDone();
            }}
          />
        </div>
      )}

      {chainList.length === 0 && !isCreating ? (
        <div className="px-2 py-4">
          <EmptyState
            title={t("navigation.noChains")}
            description={t("navigation.noChainsDesc")}
          />
        </div>
      ) : (
        <div className="space-y-0.5">
          {chainList.map((chain) => (
            <div
              key={chain.id}
              data-testid={`chain-list-item-${chain.id}`}
              className="group flex items-center gap-1.5 rounded px-2 py-1.5 hover:bg-muted cursor-pointer"
              onClick={() => {
                if (editingId !== chain.id) router.push(`/chain/${chain.id}`);
              }}
            >
              <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

              {editingId === chain.id ? (
                <Input
                  autoFocus
                  data-testid="chain-rename-input"
                  className="h-5 py-0 text-xs flex-1"
                  value={editName}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      renameChain(chain.id, editName.trim() || chain.name);
                      setEditingId(null);
                    }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => {
                    renameChain(chain.id, editName.trim() || chain.name);
                    setEditingId(null);
                  }}
                />
              ) : (
                <span className="flex-1 truncate text-sm">{chain.name}</span>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger
                  data-testid={`chain-list-more-btn-${chain.id}`}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-muted"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" finalFocus={false}>
                  <DropdownMenuItem
                    data-testid="chain-rename-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditName(chain.name);
                      setEditingId(chain.id);
                    }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    {t("common.rename")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    data-testid="chain-delete-btn"
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteId(chain.id);
                    }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title={t("chain.deleteChainConfirmTitle")}
        description={t("chain.deleteChainConfirmDescription", {
          chainName:
            chainList.find((chain) => chain.id === pendingDeleteId)?.name ?? "",
        })}
        confirmLabel={t("chain.deleteChainConfirmButton")}
        onConfirm={() => {
          if (pendingDeleteId) deleteChain(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      />
    </div>
  );
}
