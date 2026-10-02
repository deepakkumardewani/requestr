"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import type { Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { BLOCK_REGISTRY } from "@/components/chain/blockRegistry";
import { MethodBadge } from "@/components/common/MethodBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FIT_VIEW_OPTIONS } from "./hooks/useAutoLayout";
import { type NodeSearchResult, useNodeSearch } from "./hooks/useNodeSearch";

/** Lists longer than this render through a virtualizer so 500-node chains stay cheap. */
export const FIND_NODE_VIRTUALIZE_ABOVE = 50;
const ROW_HEIGHT = 36;
const OVERSCAN_ROWS = 8;
const LIST_MAX_HEIGHT_PX = 288;
const FIT_DURATION_MS = 200;
const rowDomId = (id: string) => `find-node-option-${id}`;

type FindNodeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: readonly Node[];
  /** Called after the viewport is centered, so the canvas can select and focus the node. */
  onSelectNode: (nodeId: string) => void;
};

function HighlightedLabel({ result }: { result: NodeSearchResult }) {
  const { label, nameRanges } = result;
  if (nameRanges.length === 0) return <>{label}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  nameRanges.forEach(([start, end]) => {
    if (start > cursor) parts.push(label.slice(cursor, start));
    parts.push(
      <mark
        key={`${start}-${end}`}
        className="bg-transparent font-semibold text-foreground"
      >
        {label.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < label.length) parts.push(label.slice(cursor));
  return <>{parts}</>;
}

type RowProps = {
  result: NodeSearchResult;
  active: boolean;
  style?: React.CSSProperties;
  onSelect: (id: string) => void;
  onHover: () => void;
};

function FindNodeRow({ result, active, style, onSelect, onHover }: RowProps) {
  const { icon: Icon, iconClassName } = BLOCK_REGISTRY[result.type];
  return (
    <div
      id={rowDomId(result.id)}
      role="option"
      aria-selected={active}
      data-testid={`find-node-row-${result.id}`}
      style={{ height: ROW_HEIGHT, ...style }}
      onClick={() => onSelect(result.id)}
      onMouseMove={onHover}
      className={cn(
        "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded px-2 text-[13px] text-muted-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      <Icon className={cn("size-4 shrink-0", iconClassName)} />
      {result.method && <MethodBadge method={result.method} />}
      <span className="min-w-0 flex-1 truncate">
        <HighlightedLabel result={result} />
      </span>
    </div>
  );
}

type ResultListProps = {
  results: NodeSearchResult[];
  activeIndex: number;
  onSelect: (id: string) => void;
  onHover: (index: number) => void;
};

function ResultList({
  results,
  activeIndex,
  onSelect,
  onHover,
}: ResultListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualized = results.length > FIND_NODE_VIRTUALIZE_ABOVE;
  const virtualizer = useVirtualizer({
    count: virtualized ? results.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
    getItemKey: (index) => results[index]?.id ?? index,
  });

  useEffect(() => {
    if (virtualized) virtualizer.scrollToIndex(activeIndex);
    else
      document
        .getElementById(rowDomId(results[activeIndex]?.id ?? ""))
        ?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, virtualized, virtualizer, results]);

  return (
    <div
      ref={scrollRef}
      role="listbox"
      id="find-node-listbox"
      data-testid="find-node-list"
      data-virtualized={virtualized}
      style={{ maxHeight: LIST_MAX_HEIGHT_PX }}
      className="overflow-y-auto"
    >
      {virtualized ? (
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <FindNodeRow
              key={virtualRow.key}
              result={results[virtualRow.index]}
              active={virtualRow.index === activeIndex}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              onSelect={onSelect}
              onHover={() => onHover(virtualRow.index)}
            />
          ))}
        </div>
      ) : (
        results.map((result, index) => (
          <FindNodeRow
            key={result.id}
            result={result}
            active={index === activeIndex}
            onSelect={onSelect}
            onHover={() => onHover(index)}
          />
        ))
      )}
    </div>
  );
}

type ContentProps = Omit<FindNodeDialogProps, "open">;

function FindNodeContent({ onOpenChange, nodes, onSelectNode }: ContentProps) {
  const t = useTranslations("chain");
  const { fitView } = useReactFlow();
  const [query, setQuery] = useState("");
  const [rawActiveIndex, setActiveIndex] = useState(0);
  const results = useNodeSearch(nodes, query);
  const activeIndex = Math.min(rawActiveIndex, Math.max(results.length - 1, 0));
  const activeId = results[activeIndex]?.id;

  const selectNode = (id: string) => {
    fitView({
      ...FIT_VIEW_OPTIONS,
      nodes: [{ id }],
      duration: FIT_DURATION_MS,
    });
    onSelectNode(id);
    onOpenChange(false);
  };

  const moveActive = (delta: number) =>
    setActiveIndex(
      (activeIndex + delta + results.length) % Math.max(results.length, 1),
    );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") moveActive(1);
    else if (e.key === "ArrowUp") moveActive(-1);
    else if (e.key === "Home") setActiveIndex(0);
    else if (e.key === "End") setActiveIndex(results.length - 1);
    else if (e.key === "Enter" && activeId) selectNode(activeId);
    else return;
    e.preventDefault();
  };

  const emptyKey = nodes.length === 0 ? "findNodeEmpty" : "findNodeNoResults";

  return (
    <>
      <DialogHeader className="sr-only">
        <DialogTitle>{t("findNodeTitle")}</DialogTitle>
        <DialogDescription>{t("findNodePlaceholder")}</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-2 border-b px-3">
        <SearchIcon className="size-4 shrink-0 opacity-50" />
        <input
          role="combobox"
          aria-expanded
          aria-controls="find-node-listbox"
          aria-activedescendant={activeId ? rowDomId(activeId) : undefined}
          aria-label={t("findNodeTitle")}
          data-testid="find-node-input"
          value={query}
          placeholder={t("findNodePlaceholder")}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="h-10 w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground"
        />
      </div>
      <div className="p-1 pt-0">
        {results.length === 0 ? (
          <p
            role="status"
            data-testid="find-node-empty"
            className="py-6 text-center text-sm text-muted-foreground"
          >
            {t(emptyKey)}
          </p>
        ) : (
          <ResultList
            results={results}
            activeIndex={activeIndex}
            onSelect={selectNode}
            onHover={setActiveIndex}
          />
        )}
      </div>
    </>
  );
}

/** Cmd/Ctrl+F palette: filter canvas nodes, Enter centers the chosen one. Esc restores focus to the canvas. */
export function FindNodeDialog({
  open,
  onOpenChange,
  ...rest
}: FindNodeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-1/3 translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <FindNodeContent onOpenChange={onOpenChange} {...rest} />
      </DialogContent>
    </Dialog>
  );
}
