"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PICKER_SELECTION_CAP } from "@/lib/chainConstants";
import { usePickerActions, usePickerSelectedIds } from "./PickerContext";

/** Session-scoped (not persisted across browser sessions) dismissal of the first-use keyboard hint. */
const HINT_DISMISSED_KEY = "rq_chain_picker_hint_dismissed";
let hintDismissedInMemory = false;

function isHintDismissed(): boolean {
  if (hintDismissedInMemory) return true;
  try {
    return sessionStorage.getItem(HINT_DISMISSED_KEY) === "1";
  } catch {
    // Blocked storage: fall back to the in-memory flag only.
    return false;
  }
}

function dismissHint(): void {
  hintDismissedInMemory = true;
  try {
    sessionStorage.setItem(HINT_DISMISSED_KEY, "1");
  } catch {
    // Blocked storage: the in-memory flag above still covers this page session.
  }
}

type PickerFooterProps = {
  /** Requests already on the canvas; they never count towards, or get added from, the selection. */
  alreadyAddedIds: ReadonlySet<string>;
  onCancel: () => void;
  onAdd: (requestIds: string[]) => void;
};

/** Sticky selection summary and actions. The shell hides it on the New request tab. */
export function PickerFooter({
  alreadyAddedIds,
  onCancel,
  onAdd,
}: PickerFooterProps) {
  const t = useTranslations("chain");
  const selectedIds = usePickerSelectedIds();
  const { clearSelection } = usePickerActions();
  const [hintVisible, setHintVisible] = useState(() => !isHintDismissed());

  const addableIds = useMemo(
    () => [...selectedIds].filter((id) => !alreadyAddedIds.has(id)),
    [selectedIds, alreadyAddedIds],
  );
  const count = addableIds.length;
  const capReached = selectedIds.size >= PICKER_SELECTION_CAP;
  const showHint = hintVisible && count === 0;

  const handleDismissHint = () => {
    dismissHint();
    setHintVisible(false);
  };

  return (
    <div
      data-testid="picker-footer"
      className="sticky bottom-0 flex min-w-0 shrink-0 flex-col gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-6"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span
            aria-live="polite"
            data-testid="picker-selected-count"
            className="text-sm font-medium"
          >
            {t("apiPickerSelectedCount", { count })}
          </span>
          {count > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              data-testid="picker-clear-selection"
              onClick={clearSelection}
            >
              {t("apiPickerClearSelection")}
            </Button>
          )}
        </div>
        {capReached && (
          <span
            data-testid="picker-cap-note"
            className="text-xs text-muted-foreground"
          >
            {t("apiPickerSelectionCap", { max: PICKER_SELECTION_CAP })}
          </span>
        )}
        {showHint && (
          <span
            data-testid="picker-hint"
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <span className="min-w-0 truncate">{t("apiPickerHint")}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("apiPickerDismissHint")}
              data-testid="picker-hint-dismiss"
              onClick={handleDismissHint}
            >
              <X aria-hidden />
            </Button>
          </span>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="outline"
          data-testid="picker-cancel"
          onClick={onCancel}
        >
          {t("apiPickerCancel")}
        </Button>
        <Button
          type="button"
          data-testid="picker-add-selected"
          disabled={count === 0}
          onClick={() => onAdd(addableIds)}
        >
          {t("apiPickerAddSelected", { count })}
        </Button>
      </div>
    </div>
  );
}
