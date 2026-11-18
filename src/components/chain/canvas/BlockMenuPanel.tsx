"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChainNodeType } from "@/types/chain";
import {
  BLOCK_REGISTRY,
  BLOCK_TYPES_IN_MENU_ORDER,
  type BlockCategoryKey,
} from "../blockRegistry";

/** Block types with no target handle: nothing can connect INTO them. */
const NO_TARGET_HANDLE_TYPES: ReadonlySet<ChainNodeType> = new Set(["start"]);

type BlockItem = {
  id: ChainNodeType;
  name: string;
  description: string;
  categoryKey: BlockCategoryKey;
};

type BlockMenuPanelProps = {
  /** Hides the Start entry once the chain already has one — at most one Start per chain. */
  hasStartNode?: boolean;
  /** Hides blocks that cannot receive a connection (used when adding from a dangling edge). */
  hideWithoutTargetHandle?: boolean;
  searchPlaceholder: string;
  onSelect: (type: ChainNodeType) => void;
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

/** Searchable, category-grouped block list shared by the toolbar, pane and connect-drop menus. */
export function BlockMenuPanel({
  hasStartNode,
  hideWithoutTargetHandle,
  searchPlaceholder,
  onSelect,
}: BlockMenuPanelProps) {
  const t = useTranslations("chain");
  // Start stays in the menu when one already exists so choosing it can toast.
  void hasStartNode;
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered: BlockItem[] = BLOCK_TYPES_IN_MENU_ORDER.filter(
    (id) => !(hideWithoutTargetHandle && NO_TARGET_HANDLE_TYPES.has(id)),
  )
    .map((id) => ({
      id,
      name: t(BLOCK_REGISTRY[id].labelKey),
      description: t(BLOCK_REGISTRY[id].descKey),
      categoryKey: BLOCK_REGISTRY[id].categoryKey,
    }))
    .filter((item) => fuzzyMatch(item.name, search));

  const categoryKeys = Array.from(new Set(filtered.map((i) => i.categoryKey)));

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
      if (item) onSelect(item.id);
    }
  }

  return (
    <>
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden
          />
          <Input
            data-testid="block-menu-search"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
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
              .map((item) => (
                <BlockMenuRow
                  key={item.id}
                  item={item}
                  isActive={filtered[activeIndex]?.id === item.id}
                  onSelect={onSelect}
                />
              ))}
          </div>
        ))}
      </div>
    </>
  );
}

function BlockMenuRow({
  item,
  isActive,
  onSelect,
}: {
  item: BlockItem;
  isActive: boolean;
  onSelect: (type: ChainNodeType) => void;
}) {
  const { icon: Icon, iconClassName } = BLOCK_REGISTRY[item.id];
  return (
    <button
      type="button"
      data-testid={`block-menu-item-${item.id}`}
      aria-current={isActive}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left",
        isActive && "bg-muted",
      )}
      onClick={() => onSelect(item.id)}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted border border-border">
        <Icon className={cn("h-5 w-5", iconClassName)} />
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
}
