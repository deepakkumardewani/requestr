"use client";

import { SaveIcon, Trash2Icon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RELAY_COARSE_TOUCH_CLASS } from "@/lib/relay/constants";
import type { CloseDecision, CloseTabsPreview } from "@/lib/relay/tools/tabs";

type CloseTabsConfirmCardProps = {
  preview: CloseTabsPreview;
  onChoose: (decision: CloseDecision) => void;
  onCancel: () => void;
};

type Answer = CloseDecision | "cancel";

/**
 * Asks what to do with unsaved tabs before Relay closes them (FR-131).
 * Cancel holds focus first so a stray Enter never discards work (NFR-8).
 */
export function CloseTabsConfirmCard({
  preview,
  onChoose,
  onCancel,
}: CloseTabsConfirmCardProps) {
  const t = useTranslations("relay.closeTabs");
  const [answered, setAnswered] = useState<Answer | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function answer(choice: Answer) {
    // The model's next step waits on the answer, so a second click must do nothing.
    if (answered) return;
    setAnswered(choice);
    if (choice === "cancel") onCancel();
    else onChoose(choice);
  }

  const busy = answered !== null;
  return (
    <div
      role="group"
      aria-label={t("cardLabel")}
      data-testid="relay-close-tabs-card"
      className="my-1.5 space-y-2 rounded-md border border-amber-500/50 bg-amber-500/5 p-2 text-xs"
    >
      <p className="flex items-center gap-1.5 font-medium text-sm">
        <TriangleAlertIcon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 break-words">
          {t(preview.deleting ? "deleteTitle" : "title", {
            count: preview.dirty.length,
          })}
        </span>
      </p>
      <p role="status" className="sr-only">
        {busy ? "" : t("needed")}
      </p>
      <ul className="list-disc pl-5" data-testid="relay-close-tabs-list">
        {preview.dirty.map((tab) => (
          <li key={tab.tabId} className="break-words">
            {tab.name}
            {tab.hasDestination ? null : (
              <span className="text-muted-foreground">
                {" "}
                ({t("needsDestination")})
              </span>
            )}
          </li>
        ))}
      </ul>
      <p
        role="alert"
        className="font-medium text-amber-700 dark:text-amber-400"
      >
        {t("warning")}
      </p>
      {preview.dirty.some((tab) => !tab.hasDestination) ? (
        <p className="text-muted-foreground">{t("needsDestinationHint")}</p>
      ) : null}
      {preview.pinnedKept > 0 ? (
        <p
          className="text-muted-foreground"
          data-testid="relay-close-tabs-pinned"
        >
          {t("pinnedKept", { count: preview.pinnedKept })}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          ref={cancelRef}
          type="button"
          size="xs"
          variant="outline"
          className={RELAY_COARSE_TOUCH_CLASS}
          disabled={busy}
          data-testid="relay-close-tabs-cancel"
          onClick={() => answer("cancel")}
        >
          <XIcon aria-hidden />
          {t("cancel")}
        </Button>
        <Button
          type="button"
          size="xs"
          className={RELAY_COARSE_TOUCH_CLASS}
          disabled={busy}
          data-testid="relay-close-tabs-save-all"
          onClick={() => answer("save-all")}
        >
          <SaveIcon aria-hidden />
          {answered === "save-all" ? t("working") : t("saveAll")}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="destructive"
          className={RELAY_COARSE_TOUCH_CLASS}
          disabled={busy}
          data-testid="relay-close-tabs-discard"
          onClick={() => answer("discard")}
        >
          <Trash2Icon aria-hidden />
          {answered === "discard" ? t("working") : t("discard")}
        </Button>
      </div>
    </div>
  );
}
