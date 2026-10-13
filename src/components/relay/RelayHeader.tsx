"use client";

import { ChevronDownIcon, PlusIcon, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RELAY_TOUCH_TARGET_STYLE } from "@/lib/relay/constants";
import { getThread, subscribeThreadChanges } from "@/lib/relay/threadDb";
import { useRelayStore } from "@/stores/useRelayStore";
import { PrunedNotice } from "./PrunedNotice";
import { ThreadList } from "./ThreadList";

type RelayHeaderProps = {
  onClose: () => void;
  /** Enlarges the controls to the touch minimum (sheet layout). */
  touchTargets?: boolean;
};

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
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
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
    <div
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && listOpen) closeList();
      }}
    >
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h2 className="min-w-0 text-sm font-medium text-foreground">
          <button
            ref={triggerRef}
            type="button"
            className="flex max-w-full items-center gap-1 rounded-md px-1 py-0.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            style={touchStyle}
            aria-expanded={listOpen}
            aria-controls={listId}
            data-testid="relay-thread-trigger"
            onClick={() => setListOpen((open) => !open)}
          >
            <span className="truncate" data-testid="relay-title">
              {title}
            </span>
            <ChevronDownIcon className="size-3.5 shrink-0" aria-hidden />
          </button>
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("threads.new")}
            data-testid="relay-new-thread"
            style={touchStyle}
            onClick={handleNewThread}
          >
            <PlusIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("close")}
            data-testid="relay-close"
            style={touchStyle}
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </header>
      <PrunedNotice />
      {listOpen ? (
        <section
          id={listId}
          aria-label={t("threads.listLabel")}
          className="absolute inset-x-0 top-full z-20 border-b bg-background shadow-md"
        >
          <ThreadList onSelected={closeList} touchTargets={touchTargets} />
        </section>
      ) : null}
    </div>
  );
}
