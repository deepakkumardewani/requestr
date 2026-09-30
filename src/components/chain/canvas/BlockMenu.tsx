"use client";

import {
  Braces,
  GitBranch,
  GitMerge,
  Inbox,
  Monitor,
  Plus,
  Repeat2,
  Rocket,
  Search,
  ShieldCheck,
  Timer,
  Workflow,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type BlockItem = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
};

const STATIC_BLOCK_ITEMS: Omit<BlockItem, "name" | "description">[] = [
  {
    id: "api",
    icon: <Zap className="h-5 w-5 text-blue-400" />,
    category: "Primitives",
  },
  {
    id: "condition",
    icon: <GitBranch className="h-5 w-5 text-violet-400" />,
    category: "Logic",
  },
  {
    id: "delay",
    icon: <Timer className="h-5 w-5 text-amber-400" />,
    category: "Logic",
  },
  {
    id: "display",
    icon: <Monitor className="h-5 w-5 text-violet-400" />,
    category: "Logic",
  },
  {
    id: "start",
    icon: <Rocket className="h-5 w-5 text-sky-400" />,
    category: "Primitives",
  },
  {
    id: "evaluate",
    icon: <Braces className="h-5 w-5 text-sky-400" />,
    category: "Logic",
  },
  {
    id: "validate",
    icon: <ShieldCheck className="h-5 w-5 text-emerald-400" />,
    category: "Logic",
  },
  {
    id: "merge",
    icon: <GitMerge className="h-5 w-5 text-violet-400" />,
    category: "Logic",
  },
  {
    id: "loop",
    icon: <Repeat2 className="h-5 w-5 text-amber-400" />,
    category: "Logic",
  },
  {
    id: "collect",
    icon: <Inbox className="h-5 w-5 text-blue-400" />,
    category: "Logic",
  },
  {
    id: "subchain",
    icon: <Workflow className="h-5 w-5 text-emerald-400" />,
    category: "Logic",
  },
];

/**
 * Static English fallback names/descriptions for the non-Start block types.
 * These are not yet routed through i18n (pre-existing gap, out of scope here);
 * the Start entry below is localized via `blockMenuStartName`/`blockMenuStartDescription`.
 */
const BLOCK_TEXT: Record<string, { name: string; description: string }> = {
  api: {
    name: "HTTP Request",
    description: "Create and send an HTTP request",
  },
  condition: {
    name: "Condition",
    description: "Branch data based on an expression",
  },
  delay: {
    name: "Delay",
    description: "Wait for a specified amount of time",
  },
  display: {
    name: "Display",
    description: "Extract and pass data from a source response",
  },
  evaluate: {
    name: "Evaluate",
    description: "Run custom JavaScript against upstream data",
  },
  validate: {
    name: "Validate",
    description: "Validate a response against a JSON Schema",
  },
};

type BlockMenuProps = {
  disabled?: boolean;
  /** Hides the Start entry once the chain already has one — at most one Start per chain. */
  hasStartNode?: boolean;
  onAddApiClick: () => void;
  onEnterGhostMode: (type: "delay" | "condition" | "display") => void;
  onAddStartClick?: () => void;
  onAddEvaluateClick?: () => void;
  onAddValidateClick?: () => void;
  onAddMergeClick?: () => void;
  onAddLoopClick?: () => void;
  onAddCollectClick?: () => void;
  onAddSubChainClick?: () => void;
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
  onAddEvaluateClick,
  onAddValidateClick,
  onAddMergeClick,
  onAddLoopClick,
  onAddCollectClick,
  onAddSubChainClick,
}: BlockMenuProps) {
  const t = useTranslations("chain");
  const blockMenuContentId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const BLOCK_ITEMS: BlockItem[] = STATIC_BLOCK_ITEMS.map((item) => {
    if (item.id === "start") {
      return {
        ...item,
        name: t("blockMenuStartName"),
        description: t("blockMenuStartDescription"),
      };
    }
    if (item.id === "merge") {
      return {
        ...item,
        name: t("blockMenuMergeName"),
        description: t("blockMenuMergeDescription"),
      };
    }
    if (item.id === "loop") {
      return {
        ...item,
        name: t("blockMenuLoopName"),
        description: t("blockMenuLoopDescription"),
      };
    }
    if (item.id === "collect") {
      return {
        ...item,
        name: t("blockMenuCollectName"),
        description: t("blockMenuCollectDescription"),
      };
    }
    if (item.id === "subchain") {
      return {
        ...item,
        name: t("blockMenuSubChainName"),
        description: t("blockMenuSubChainDescription"),
      };
    }
    return { ...item, ...BLOCK_TEXT[item.id] };
  });

  const filtered = BLOCK_ITEMS.filter(
    (item) =>
      fuzzyMatch(item.name, search) && !(item.id === "start" && hasStartNode),
  );

  const categories = Array.from(new Set(filtered.map((i) => i.category)));

  function handleSelect(item: BlockItem) {
    setOpen(false);
    setSearch("");
    setActiveIndex(0);
    if (item.id === "api") {
      onAddApiClick();
    } else if (item.id === "start") {
      onAddStartClick?.();
    } else if (item.id === "evaluate") {
      onAddEvaluateClick?.();
    } else if (item.id === "validate") {
      onAddValidateClick?.();
    } else if (item.id === "merge") {
      onAddMergeClick?.();
    } else if (item.id === "loop") {
      onAddLoopClick?.();
    } else if (item.id === "collect") {
      onAddCollectClick?.();
    } else if (item.id === "subchain") {
      onAddSubChainClick?.();
    } else if (
      item.id === "delay" ||
      item.id === "condition" ||
      item.id === "display"
    ) {
      onEnterGhostMode(item.id);
    }
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
        Block
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
          {categories.map((category) => (
            <div key={category}>
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {category}
              </p>
              {filtered
                .filter((i) => i.category === category)
                .map((item) => {
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
                        {item.icon}
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
