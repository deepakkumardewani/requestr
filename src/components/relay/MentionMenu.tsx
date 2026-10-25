"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslations } from "next-intl";
import {
  type CSSProperties,
  type KeyboardEvent,
  type MutableRefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type PickerItem,
  type PickerKind,
  useRelayPickerItems,
} from "@/hooks/useRelayPickerItems";
import { pickerNavReducer } from "@/lib/pickerNav";
import { EMPTY_MATCH } from "@/lib/pickerSearch";
import type { PickerRow } from "@/lib/pickerTree";
import { type ContextChip, chipKey } from "@/lib/relay/chips";
import {
  RELAY_MENTION_MAX_HEIGHT_PX,
  RELAY_PICKER_OVERSCAN_ROWS,
  RELAY_PICKER_ROW_HEIGHT_PX,
} from "@/lib/relay/constants";
import { cn } from "@/lib/utils";
import { useRelayStore } from "@/stores/useRelayStore";
import { CHIP_KIND_ICONS } from "./RelayPickerRow";

/** Lets the composer drive the menu while focus stays in the textarea; true means the key was consumed. */
export type MentionKeyHandler = (event: KeyboardEvent) => boolean;

type MentionMenuProps = {
  /** Text typed after the `@`. */
  query: string;
  /** Limits the results to one kind; null or absent lists every kind. */
  kind?: Exclude<PickerKind, "all"> | null;
  /** One line of guidance above the list, for launchers that preselect a kind. */
  hint?: string;
  /** Offer the open tab as the first row; on by default. */
  pinCurrentTab?: boolean;
  /** The menu sits above the composer box and is as wide as it. */
  anchor: "composer";
  /** Rendered inside another panel (the launcher), so it drops its own border, radius and shadow. */
  embedded?: boolean;
  /** Filled with the key handler the composer calls from its textarea `onKeyDown`. */
  keyHandlerRef: MutableRefObject<MentionKeyHandler | null>;
  /** The DOM id of the highlighted row, for the textarea's `aria-activedescendant`. */
  onActiveChange?: (optionId: string | null) => void;
  onSelect: (chip: ContextChip) => void;
  onClose: () => void;
};

const toChip = ({ kind, id, label }: PickerItem): ContextChip => ({
  kind,
  id,
  label,
});

/** Flat item rows so the shared picker keyboard reducer can move the highlight (it clamps at both ends). */
const toNavRows = (options: PickerItem[]): PickerRow<PickerItem>[] =>
  options.map((option) => ({
    kind: "item",
    id: chipKey(option),
    depth: 0,
    item: option,
    match: EMPTY_MATCH,
  }));

const moveHighlight = (
  options: PickerItem[],
  activeKey: string | null,
  key: "ArrowDown" | "ArrowUp",
): number => {
  const { state } = pickerNavReducer(
    {
      rows: toNavRows(options),
      activeId: activeKey,
      expanded: new Set(),
      selectedIds: new Set(),
      inChainIds: new Set(),
      anchorId: null,
    },
    { key },
  );
  return options.findIndex((option) => chipKey(option) === state.activeId);
};

const matchesQuery = (tab: PickerItem, query: string): boolean =>
  tab.label.toLowerCase().includes(query.trim().toLowerCase());

export function MentionMenu({
  query,
  kind = null,
  hint,
  pinCurrentTab = true,
  embedded = false,
  keyHandlerRef,
  onActiveChange,
  onSelect,
  onClose,
}: MentionMenuProps) {
  const t = useTranslations("relay");
  const listId = useId();
  const attachedItems = useRelayStore((state) => state.attachedItems);
  const attachedKeys = useMemo(
    () => new Set(attachedItems.map(chipKey)),
    [attachedItems],
  );
  const { items, truncated, currentTab } = useRelayPickerItems(
    query,
    kind ?? "all",
  );
  // Typing moves the highlight back to the top, so it is remembered together with its query.
  const [active, setActive] = useState<{ query: string; key: string } | null>(
    null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const showTabSection =
    pinCurrentTab && (!currentTab || matchesQuery(currentTab, query));
  const pinnedTab = showTabSection ? currentTab : null;
  const options = pinnedTab ? [pinnedTab, ...items] : items;
  const pinnedCount = pinnedTab ? 1 : 0;

  const activeKey = active?.query === query ? active.key : null;
  const found = options.findIndex((option) => chipKey(option) === activeKey);
  const attachedIndex = options.findIndex((option) =>
    attachedKeys.has(chipKey(option)),
  );
  const activeIndex =
    found === -1 ? (attachedIndex >= 0 ? attachedIndex : 0) : found;
  const activeOption = options[activeIndex] ?? null;
  const optionId = (item: PickerItem) => `${listId}-${chipKey(item)}`;
  const activeId = activeOption ? optionId(activeOption) : null;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => RELAY_PICKER_ROW_HEIGHT_PX,
    overscan: RELAY_PICKER_OVERSCAN_ROWS,
    initialRect: { width: 0, height: RELAY_MENTION_MAX_HEIGHT_PX },
    getItemKey: (index) => chipKey(items[index]),
  });

  useEffect(() => {
    onActiveChange?.(activeId);
  }, [activeId, onActiveChange]);
  useEffect(() => () => onActiveChange?.(null), [onActiveChange]);

  const highlight = (index: number) => {
    const next = options[index];
    if (!next) return;
    setActive({ query, key: chipKey(next) });
    const resultIndex = index - pinnedCount;
    if (resultIndex >= 0) virtualizer.scrollToIndex(resultIndex);
  };

  // Written in an effect, not during render, so concurrent renders never leak a stale handler.
  useEffect(() => {
    keyHandlerRef.current = (event) => {
      if (event.nativeEvent.isComposing) return false;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return true;
      }
      if (options.length === 0) return false;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        highlight(
          moveHighlight(
            options,
            activeOption && chipKey(activeOption),
            event.key,
          ),
        );
        return true;
      }
      if ((event.key === "Enter" || event.key === "Tab") && activeOption) {
        event.preventDefault();
        onSelect(toChip(activeOption));
        return true;
      }
      return false;
    };
    return () => {
      keyHandlerRef.current = null;
    };
  });

  const renderOption = (
    item: PickerItem,
    position: number,
    style?: CSSProperties,
  ) => (
    <MentionOption
      key={chipKey(item)}
      id={optionId(item)}
      item={item}
      active={activeId === optionId(item)}
      posInSet={position + 1}
      setSize={options.length}
      style={style}
      onHover={() => setActive({ query, key: chipKey(item) })}
      onSelect={() => onSelect(toChip(item))}
    />
  );

  return (
    <div
      role="listbox"
      id={listId}
      aria-label={t("mention.listLabel")}
      data-testid="relay-mention-menu"
      className={cn(
        "flex w-full max-w-full flex-col overflow-hidden bg-popover text-popover-foreground",
        !embedded && "rounded-xl border shadow-md",
      )}
    >
      {hint ? (
        <p className="border-b px-3 py-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {pinCurrentTab && (!currentTab || pinnedTab) ? (
        <div
          role="group"
          aria-label={t("mention.currentTab")}
          className="border-b p-1"
        >
          <SectionLabel>{t("mention.currentTab")}</SectionLabel>
          {pinnedTab ? (
            renderOption(pinnedTab, 0)
          ) : (
            <DisabledTabOption label={t("mention.noTab")} />
          )}
        </div>
      ) : null}
      <div role="group" aria-label={t("mention.results")} className="p-1">
        <SectionLabel>{t("mention.results")}</SectionLabel>
        <div
          ref={scrollRef}
          role="presentation"
          className="overflow-y-auto overscroll-contain"
          style={{ maxHeight: RELAY_MENTION_MAX_HEIGHT_PX }}
        >
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((row) =>
              renderOption(items[row.index], row.index + pinnedCount, {
                height: row.size,
                transform: `translateY(${row.start}px)`,
              }),
            )}
          </div>
        </div>
        {items.length === 0 ? (
          <p
            role="status"
            data-testid="relay-mention-empty"
            className="px-2 py-4 text-center text-sm text-muted-foreground"
          >
            {t("mention.empty")}
          </p>
        ) : null}
      </div>
      {truncated ? (
        <p
          data-testid="relay-mention-truncated"
          className="border-t px-3 py-1.5 text-xs text-muted-foreground"
        >
          {t("mention.keepTyping")}
        </p>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p
      role="presentation"
      className="px-2 pt-1 pb-0.5 text-xs font-medium text-muted-foreground"
    >
      {children}
    </p>
  );
}

function DisabledTabOption({ label }: { label: string }) {
  return (
    <div
      role="option"
      aria-selected={false}
      aria-disabled
      data-testid="relay-mention-option"
      data-kind="tab"
      className="flex min-h-9 items-center px-2 text-sm text-muted-foreground opacity-70"
    >
      {label}
    </div>
  );
}

type MentionOptionProps = {
  id: string;
  item: PickerItem;
  active: boolean;
  posInSet: number;
  setSize: number;
  style?: CSSProperties;
  onHover: () => void;
  onSelect: () => void;
};

function MentionOption({
  id,
  item,
  active,
  posInSet,
  setSize,
  style,
  onHover,
  onSelect,
}: MentionOptionProps) {
  const Icon = CHIP_KIND_ICONS[item.kind];
  const absolute = style !== undefined;
  return (
    <div
      id={id}
      role="option"
      tabIndex={-1}
      aria-selected={active}
      aria-posinset={posInSet}
      aria-setsize={setSize}
      data-testid="relay-mention-option"
      data-kind={item.kind}
      data-active={active}
      style={style}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2 text-sm",
        absolute ? "absolute top-0 left-0 w-full" : "min-h-11",
        active && "bg-accent text-accent-foreground",
      )}
      // Keeps focus in the textarea so the draft and caret survive the click.
      onMouseDown={(event) => event.preventDefault()}
      onMouseMove={active ? undefined : onHover}
      onClick={onSelect}
    >
      <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{item.label}</span>
        {item.detail ? (
          <span className="truncate text-xs text-muted-foreground">
            {item.detail}
          </span>
        ) : null}
      </span>
    </div>
  );
}
