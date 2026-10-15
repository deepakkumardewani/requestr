"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandInput, CommandList } from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  type PickerItem,
  type PickerKind,
  useRelayPickerItems,
} from "@/hooks/useRelayPickerItems";
import { chipKey } from "@/lib/relay/chips";
import { useRelayStore } from "@/stores/useRelayStore";
import { RelayPickerRow } from "./RelayPickerRow";

/** Two lines (name and detail) per row. */
const ROW_HEIGHT_PX = 44;
const LIST_MAX_HEIGHT_PX = 264;
const OVERSCAN_ROWS = 4;

const KIND_FILTERS = [
  "all",
  "request",
  "collection",
  "environment",
  "chain",
] as const satisfies readonly PickerKind[];

const KIND_FILTER_LABEL_KEYS = {
  all: "picker.kindAll",
  request: "context.kindRequest",
  collection: "context.kindCollection",
  environment: "context.kindEnvironment",
  chain: "context.kindChain",
} as const satisfies Record<PickerKind, string>;

type RelayPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: PickerItem) => void;
  /** The control that opens the picker; the `@` trigger reuses it as the anchor. */
  trigger: ReactElement;
  /** Text already typed after `@`, used as the starting search. */
  initialQuery?: string;
  /** Where focus lands when the picker closes without a choice (NFR-8). */
  returnFocusTo?: RefObject<HTMLElement | null>;
};

export function RelayPicker({
  open,
  onOpenChange,
  onSelect,
  trigger,
  initialQuery = "",
  returnFocusTo,
}: RelayPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        side="top"
        align="start"
        finalFocus={returnFocusTo}
        data-testid="relay-picker"
        className="w-80 gap-0 p-0"
      >
        <PickerBody initialQuery={initialQuery} onSelect={onSelect} />
      </PopoverContent>
    </Popover>
  );
}

/** Mounted only while open, so the search and highlight start fresh every time. */
function PickerBody({
  initialQuery,
  onSelect,
}: {
  initialQuery: string;
  onSelect: (item: PickerItem) => void;
}) {
  const t = useTranslations("relay");
  const [query, setQuery] = useState(initialQuery);
  const [kind, setKind] = useState<PickerKind>("all");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const shareValues = useRelayStore((s) => s.shareValues);
  const { items, truncated } = useRelayPickerItems(query, kind);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: OVERSCAN_ROWS,
    initialRect: { width: 0, height: LIST_MAX_HEIGHT_PX },
    getItemKey: (index) => chipKey(items[index]),
  });

  const found = items.findIndex((item) => chipKey(item) === activeKey);
  const activeIndex = found === -1 ? 0 : found;
  const activeValue = items[activeIndex] ? chipKey(items[activeIndex]) : "";

  const moveTo = (index: number) => {
    const next = items[index];
    if (!next) return;
    setActiveKey(chipKey(next));
    virtualizer.scrollToIndex(index);
  };

  // cmdk only knows about mounted rows, so arrows move through the full list here.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;
    const last = items.length - 1;
    const targets: Record<string, number> = {
      ArrowDown: Math.min(activeIndex + 1, last),
      ArrowUp: Math.max(activeIndex - 1, 0),
      Home: 0,
      End: last,
    };
    if (event.key in targets) {
      event.preventDefault();
      moveTo(targets[event.key]);
      return;
    }
    const fromSearch = event.target === inputRef.current;
    if (event.key === "Enter" && fromSearch) {
      event.preventDefault();
      if (items[activeIndex]) onSelect(items[activeIndex]);
    }
  };

  const handleSearch = (next: string) => {
    setQuery(next);
    setActiveKey(null);
  };

  return (
    <Command
      shouldFilter={false}
      label={t("picker.title")}
      value={activeValue}
      onValueChange={setActiveKey}
      onKeyDown={handleKeyDown}
      className="rounded-lg! p-0"
    >
      <CommandInput
        ref={inputRef}
        value={query}
        onValueChange={handleSearch}
        aria-label={t("picker.searchLabel")}
        placeholder={t("picker.searchPlaceholder")}
        data-testid="relay-picker-search"
      />
      <fieldset
        aria-label={t("picker.kindFilterLabel")}
        className="flex flex-wrap gap-1 border-0 p-1 pb-0"
      >
        {KIND_FILTERS.map((option) => (
          <Button
            key={option}
            type="button"
            size="xs"
            variant={option === kind ? "secondary" : "ghost"}
            aria-pressed={option === kind}
            data-testid={`relay-picker-kind-${option}`}
            onClick={() => setKind(option)}
          >
            {t(KIND_FILTER_LABEL_KEYS[option])}
          </Button>
        ))}
      </fieldset>
      <CommandList
        ref={listRef}
        label={t("picker.listLabel")}
        data-testid="relay-picker-list"
        style={{ maxHeight: LIST_MAX_HEIGHT_PX }}
      >
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((row) => (
            <RelayPickerRow
              key={row.key}
              item={items[row.index]}
              index={row.index}
              count={items.length}
              valuesHidden={!shareValues}
              style={{
                height: row.size,
                transform: `translateY(${row.start}px)`,
              }}
              onSelect={onSelect}
            />
          ))}
        </div>
      </CommandList>
      {items.length === 0 ? (
        <p
          role="status"
          data-testid="relay-picker-empty"
          className="py-6 text-center text-sm text-muted-foreground"
        >
          {t("picker.empty")}
        </p>
      ) : null}
      {truncated ? (
        <p
          data-testid="relay-picker-truncated"
          className="border-t px-2 py-1.5 text-xs text-muted-foreground"
        >
          {t("picker.keepTyping")}
        </p>
      ) : null}
    </Command>
  );
}
