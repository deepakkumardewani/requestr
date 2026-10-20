"use client";

import { ChevronLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from "@/components/ui/command";
import { type ContextChip, chipKey } from "@/lib/relay/chips";
import { RELAY_LAUNCHER_LIST_MAX_HEIGHT_PX } from "@/lib/relay/constants";
import {
  buildLauncherSections,
  isListAttach,
  LAUNCHER_LIST_KINDS,
  type LauncherListId,
  type LauncherRow,
  launcherFilter,
} from "@/lib/relay/launcherItems";
import { SLASH_COMMANDS, type SlashCommand } from "@/lib/relay/slashCommands";
import { useRelayRecentStore } from "@/stores/useRelayRecentStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { type MentionKeyHandler, MentionMenu } from "./MentionMenu";
import { LauncherRowItem } from "./RelayPickerRow";

type LauncherView = { type: "root" } | { type: "list"; list: LauncherListId };

const ROOT_VIEW: LauncherView = { type: "root" };

type RelayLauncherProps = {
  /** The `+` button; a press on it is the toggle's job, not an outside click. */
  triggerRef: RefObject<HTMLElement | null>;
  /** Closed without a choice; `restoreFocus` is true for Esc, false for a click elsewhere. */
  onClose: (restoreFocus: boolean) => void;
  onSelectChip: (chip: ContextChip) => void;
  onPasteCurl: () => void;
  onRunCommand: (command: SlashCommand) => void;
};

/**
 * The `+` launcher: Recent, Attach and Actions in one searchable, box-wide
 * panel. Reads in-app stores only, so opening and typing never touch the network.
 */
export function RelayLauncher({
  triggerRef,
  onClose,
  onSelectChip,
  onPasteCurl,
  onRunCommand,
}: RelayLauncherProps) {
  const t = useTranslations("relay");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionKeyRef = useRef<MentionKeyHandler | null>(null);
  const [view, setView] = useState<LauncherView>(ROOT_VIEW);
  const [query, setQuery] = useState("");
  const [optionId, setOptionId] = useState<string | null>(null);
  const recents = useRelayRecentStore((s) => s.items);
  const attachedItems = useRelayStore((s) => s.attachedItems);
  const activeTab = useTabsStore((s) =>
    s.tabs.find((tab) => tab.tabId === s.activeTabId),
  );

  const sections = useMemo(
    () =>
      buildLauncherSections({
        recents,
        attachedKeys: new Set(attachedItems.map(chipKey)),
        hasTab: Boolean(activeTab),
        slashCommands: SLASH_COMMANDS,
        translate: (key) => t(key),
      }),
    [recents, attachedItems, activeTab, t],
  );

  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [onClose, triggerRef]);

  // Opening, stepping into a list and stepping back all hand focus to the search box.
  const viewType = view.type;
  useEffect(() => {
    inputRef.current?.focus();
  }, [viewType]);

  const openView = (next: LauncherView) => {
    setView(next);
    setQuery("");
  };

  const handleSelect = ({ target }: LauncherRow) => {
    if (target.type === "recent") return onSelectChip(target.chip);
    if (target.type === "action") return onRunCommand(target.command);
    if (target.attach === "pasteCurl") return onPasteCurl();
    if (isListAttach(target.attach)) {
      return openView({ type: "list", list: target.attach });
    }
    if (activeTab) {
      onSelectChip({ kind: "tab", id: activeTab.tabId, label: activeTab.name });
    }
  };

  const stepBack = () => {
    if (view.type === "root") return onClose(true);
    openView(ROOT_VIEW);
  };

  const handleCommandKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || event.nativeEvent.isComposing) return;
    // Handled here so the dock's own Esc (blur, then close) does not also run.
    event.preventDefault();
    event.stopPropagation();
    stepBack();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (view.type !== "list") return;
    if (mentionKeyRef.current?.(event)) event.stopPropagation();
  };

  const listKind = view.type === "list" ? LAUNCHER_LIST_KINDS[view.list] : null;
  const inputA11y =
    view.type === "list" && optionId
      ? { "aria-activedescendant": optionId }
      : {};

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={t("launcher.listLabel")}
      data-testid="relay-launcher"
      data-view={view.type}
      className="overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-md"
    >
      <Command
        shouldFilter={view.type === "root"}
        filter={launcherFilter}
        label={t("launcher.listLabel")}
        onKeyDown={handleCommandKeyDown}
        className="size-auto rounded-xl! p-0"
      >
        {view.type === "list" ? (
          <div className="flex items-center gap-1 border-b px-1 py-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t("launcher.back")}
              data-testid="relay-launcher-back"
              onClick={() => openView(ROOT_VIEW)}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <span className="truncate text-sm font-medium">
              {t(`launcher.attach.${view.list}.label`)}
            </span>
          </div>
        ) : null}
        <CommandInput
          ref={inputRef}
          className="placeholder:text-muted-foreground"
          value={query}
          onValueChange={setQuery}
          onKeyDown={handleInputKeyDown}
          aria-label={t("launcher.listLabel")}
          placeholder={
            view.type === "list"
              ? t(`launcher.attach.${view.list}.description`)
              : t("launcher.placeholder")
          }
          data-testid="relay-launcher-search"
          {...inputA11y}
        />
        {listKind ? (
          <MentionMenu
            embedded
            anchor="composer"
            query={query}
            kind={listKind}
            pinCurrentTab={false}
            keyHandlerRef={mentionKeyRef}
            onActiveChange={setOptionId}
            onSelect={onSelectChip}
            onClose={stepBack}
          />
        ) : (
          <CommandList
            data-testid="relay-launcher-list"
            // Keeps focus in the search box so Esc and the arrow keys keep working after a click.
            onMouseDown={(event) => event.preventDefault()}
            style={{ maxHeight: RELAY_LAUNCHER_LIST_MAX_HEIGHT_PX }}
          >
            {sections.map((section) => (
              <CommandGroup
                key={section.id}
                heading={t(`launcher.section.${section.id}`)}
                data-testid={`relay-launcher-section-${section.id}`}
              >
                {section.rows.map((row) => (
                  <LauncherRowItem
                    key={row.key}
                    row={row}
                    onSelect={handleSelect}
                  />
                ))}
              </CommandGroup>
            ))}
            <CommandEmpty data-testid="relay-launcher-empty">
              {t("launcher.empty")}
            </CommandEmpty>
          </CommandList>
        )}
      </Command>
    </div>
  );
}
