"use client";

import { ChevronDownIcon, PlusIcon, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toShortcutAlias } from "@/app/settings/constants";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isMac } from "@/lib/platform";
import {
  RELAY_HEADER_PADDING_X_PX,
  RELAY_NEW_CHAT_SHORTCUTS,
  RELAY_SHORTCUTS,
  RELAY_THREAD_OVERLAY_INSET_PX,
  RELAY_THREAD_OVERLAY_SIDE_OFFSET_PX,
  RELAY_TOUCH_TARGET_STYLE,
  type RelayShortcutChord,
} from "@/lib/relay/constants";
import { getThread, subscribeThreadChanges } from "@/lib/relay/threadDb";
import { getAliasKeyParts } from "@/lib/shortcutFormat";
import { useRelayStore } from "@/stores/useRelayStore";
import { CapabilitiesPopover } from "./CapabilitiesPopover";
import { PrunedNotice } from "./PrunedNotice";
import { RelayLogo } from "./RelayLogo";
import { ThreadList } from "./ThreadList";

type RelayHeaderProps = {
  onClose: () => void;
  /** Enlarges the controls to the touch minimum (sheet layout). */
  touchTargets?: boolean;
};

/** Hover and keyboard-focus delay before a header tooltip opens (RP-103). */
const HEADER_TOOLTIP_DELAY_MS = 500;

type HeaderTooltipContentProps = {
  label: string;
  chord?: RelayShortcutChord;
};

function HeaderTooltipContent({ label, chord }: HeaderTooltipContentProps) {
  return (
    <TooltipContent side="bottom">
      {label}
      {chord
        ? getAliasKeyParts(toShortcutAlias(chord), isMac()).map((part) => (
            <Kbd key={part}>{part}</Kbd>
          ))
        : null}
    </TooltipContent>
  );
}

/** Title of the active thread, kept fresh as it is auto-named or renamed. */
function useActiveThreadTitle(activeThreadId: string | null): string | null {
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!activeThreadId) {
      setTitle(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      getThread(activeThreadId)
        .then((thread) => {
          if (!cancelled) setTitle(thread?.title ?? null);
        })
        .catch((error: unknown) => {
          console.error("[relay] reading the thread title failed", {
            threadId: activeThreadId,
            error,
          });
        });
    };
    load();
    const unsubscribe = subscribeThreadChanges(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeThreadId]);

  return title;
}

export function RelayHeader({
  onClose,
  touchTargets = false,
}: RelayHeaderProps) {
  const t = useTranslations("relay");
  const activeThreadId = useRelayStore((state) => state.activeThreadId);
  const activeTitle = useActiveThreadTitle(activeThreadId);
  const [listOpen, setListOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const platformKey = isMac() ? "mac" : "other";
  const touchStyle = touchTargets ? RELAY_TOUCH_TARGET_STYLE : undefined;

  const closeList = () => {
    setListOpen(false);
    triggerRef.current?.focus();
  };

  const handleNewThread = () => {
    setListOpen(false);
    useRelayStore
      .getState()
      .newThread()
      .catch((error: unknown) => {
        console.error("[relay] starting a new thread failed", { error });
      });
  };

  const title = activeThreadId
    ? activeTitle || t("threads.untitled")
    : t("title");

  return (
    <Popover open={listOpen} onOpenChange={setListOpen}>
      <div className="shrink-0">
        <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <TooltipProvider delay={HEADER_TOOLTIP_DELAY_MS}>
            <h2 className="min-w-0 text-sm font-medium text-foreground">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <PopoverTrigger
                      ref={triggerRef}
                      className="flex max-w-full items-center gap-1 rounded-md px-1 py-0.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                      style={touchStyle}
                      data-testid="relay-thread-trigger"
                    />
                  }
                >
                  {activeThreadId ? null : <RelayLogo className="size-3.5" />}
                  <span className="truncate" data-testid="relay-title">
                    {title}
                  </span>
                  <ChevronDownIcon className="size-3.5 shrink-0" aria-hidden />
                </TooltipTrigger>
                <HeaderTooltipContent label={t("threads.listLabel")} />
              </Tooltip>
            </h2>
            <div className="flex shrink-0 items-center gap-1">
              <CapabilitiesPopover style={touchStyle} />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("threads.new")}
                      data-testid="relay-new-thread"
                      style={touchStyle}
                      onClick={handleNewThread}
                    />
                  }
                >
                  <PlusIcon />
                </TooltipTrigger>
                <HeaderTooltipContent
                  label={t("header.newChatShortcut")}
                  chord={RELAY_NEW_CHAT_SHORTCUTS[platformKey]}
                />
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("close")}
                      data-testid="relay-close"
                      style={touchStyle}
                      onClick={onClose}
                    />
                  }
                >
                  <X />
                </TooltipTrigger>
                <HeaderTooltipContent
                  label={t("close")}
                  chord={RELAY_SHORTCUTS[platformKey]}
                />
              </Tooltip>
            </div>
          </TooltipProvider>
        </header>
        <PrunedNotice />
        <PopoverContent
          align="start"
          alignOffset={
            RELAY_THREAD_OVERLAY_INSET_PX - RELAY_HEADER_PADDING_X_PX
          }
          sideOffset={RELAY_THREAD_OVERLAY_SIDE_OFFSET_PX}
          aria-label={t("threads.listLabel")}
          className="w-76 max-w-(--available-width) gap-0 p-0 shadow-lg"
          data-testid="relay-thread-overlay"
        >
          <ThreadList onSelected={closeList} touchTargets={touchTargets} />
        </PopoverContent>
      </div>
    </Popover>
  );
}
