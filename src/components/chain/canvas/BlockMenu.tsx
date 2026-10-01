"use client";

import { Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ChainNodeType } from "@/types/chain";
import {
  BLOCK_REGISTRY,
  BLOCK_TYPES_IN_MENU_ORDER,
  type BlockCategoryKey,
  type GhostBlockType,
  isGhostBlockType,
} from "../blockRegistry";

type BlockItem = {
  id: ChainNodeType;
  name: string;
  description: string;
  categoryKey: BlockCategoryKey;
};

type BlockMenuProps = {
  disabled?: boolean;
  /** Hides the Start entry once the chain already has one — at most one Start per chain. */
  hasStartNode?: boolean;
  onAddApiClick: () => void;
  onEnterGhostMode: (type: GhostBlockType) => void;
  onAddStartClick?: () => void;
};

/**
 * True if every character of `query` appears in `text`, in order (a
 * subsequence match) — the standard "fuzzy find" heuristic used by command
 * palettes. Case-insensitive; an empty query always matches.
 */
function fuzzyMatch(text: string, query: string): boolean {
  if (query.length === 0) return true;
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  let haystackIndex = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, haystackIndex);
    if (found === -1) return false;
    haystackIndex = found + 1;
  }
  return true;
}

export function BlockMenu({
  disabled,
  hasStartNode,
  onAddApiClick,
  onEnterGhostMode,
  onAddStartClick,
}: BlockMenuProps) {
  const t = useTranslations("chain");
  const blockMenuContentId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const blockItems: BlockItem[] = BLOCK_TYPES_IN_MENU_ORDER.map((id) => ({
    id,
    name: t(BLOCK_REGISTRY[id].labelKey),
    description: t(BLOCK_REGISTRY[id].descKey),
    categoryKey: BLOCK_REGISTRY[id].categoryKey,
  }));

  const filtered = blockItems.filter(
    (item) =>
      fuzzyMatch(item.name, search) && !(item.id === "start" && hasStartNode),
  );

  const categoryKeys = Array.from(new Set(filtered.map((i) => i.categoryKey)));

  function handleSelect(item: BlockItem) {
    setOpen(false);
    setSearch("");
    setActiveIndex(0);
    const { addAction } = BLOCK_REGISTRY[item.id];
    if (addAction === "request") onAddApiClick();
    else if (addAction === "start") onAddStartClick?.();
    else if (isGhostBlockType(item.id)) onEnterGhostMode(item.id);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) handleSelect(item);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSearch("");
      setActiveIndex(0);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        data-testid="block-menu-trigger"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={blockMenuContentId}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {t("blockMenuTrigger")}
      </PopoverTrigger>
      <PopoverContent
        id={blockMenuContentId}
        className="w-72 p-0"
        side="bottom"
        align="start"
        sideOffset={6}
      >
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              data-testid="block-menu-search"
              placeholder={t("blockMenuSearchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        <div className="py-1 max-h-80 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {t("blockMenuNoResults")}
            </p>
          )}
          {categoryKeys.map((categoryKey) => (
            <div key={categoryKey}>
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(categoryKey)}
              </p>
              {filtered
                .filter((i) => i.categoryKey === categoryKey)
                .map((item) => {
                  const Icon = BLOCK_REGISTRY[item.id].icon;
                  const isActive = filtered[activeIndex]?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid={`block-menu-item-${item.id}`}
                      aria-current={isActive}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left",
                        isActive && "bg-muted",
                      )}
                      onClick={() => handleSelect(item)}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted border border-border">
                        <Icon
                          className={cn(
                            "h-5 w-5",
                            BLOCK_REGISTRY[item.id].iconClassName,
                          )}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                          {item.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
