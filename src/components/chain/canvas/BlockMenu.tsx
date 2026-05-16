"use client";

import { GitBranch, Monitor, Plus, Timer, Zap } from "lucide-react";
import { useId, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type BlockItem = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
};

const BLOCK_ITEMS: BlockItem[] = [
  {
    id: "api",
    name: "HTTP Request",
    description: "Create and send an HTTP request",
    icon: <Zap className="h-5 w-5 text-blue-400" />,
    category: "Primitives",
  },
  {
    id: "condition",
    name: "Condition",
    description: "Branch data based on an expression",
    icon: <GitBranch className="h-5 w-5 text-violet-400" />,
    category: "Logic",
  },
  {
    id: "delay",
    name: "Delay",
    description: "Wait for a specified amount of time",
    icon: <Timer className="h-5 w-5 text-amber-400" />,
    category: "Logic",
  },
  {
    id: "display",
    name: "Display",
    description: "Extract and pass data from a source response",
    icon: <Monitor className="h-5 w-5 text-violet-400" />,
    category: "Logic",
  },
];

type BlockMenuProps = {
  disabled?: boolean;
  onAddApiClick: () => void;
  onEnterGhostMode: (type: "delay" | "condition" | "display") => void;
};

export function BlockMenu({
  disabled,
  onAddApiClick,
  onEnterGhostMode,
}: BlockMenuProps) {
  const blockMenuContentId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = BLOCK_ITEMS.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase()),
  );

  const categories = Array.from(new Set(filtered.map((i) => i.category)));

  function handleSelect(item: BlockItem) {
    setOpen(false);
    setSearch("");
    if (item.id === "api") {
      onAddApiClick();
    } else if (
      item.id === "delay" ||
      item.id === "condition" ||
      item.id === "display"
    ) {
      onEnterGhostMode(item.id);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        {/* hidden for now since we have only limited nodes to add */}
        {/* <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search for blocks or requests"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>
        </div> */}

        <div className="py-1 max-h-80 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No blocks found
            </p>
          )}
          {categories.map((category) => (
            <div key={category}>
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {category}
              </p>
              {filtered
                .filter((i) => i.category === category)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`block-menu-item-${item.id}`}
                    className="flex w-full items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left"
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
                ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
