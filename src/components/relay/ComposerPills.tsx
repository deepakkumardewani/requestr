"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { type ContextChip, chipKey } from "@/lib/relay/chips";
import { redactValue } from "@/lib/relay/redact";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import { isStillAttached } from "@/lib/relay/tools/workspaceRead";
import { cn } from "@/lib/utils";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { ENTITY_ACCENT_CLASS } from "./EntityPill";
import { CHIP_KIND_ICONS } from "./RelayPickerRow";

type StatefulChip = { chip: ContextChip; stale: boolean };

/**
 * Every attached item with whether it still exists. A deleted one stays
 * visible (struck) so the user sees why it will not be sent; the payload
 * builder drops it with the same check. A tab has no live lookup, so its pill
 * stays until removed.
 */
function useAttachedPills(): readonly StatefulChip[] {
  const attachedItems = useRelayStore((s) => s.attachedItems);
  // Subscribed only so the memo recomputes when an attached entity is deleted.
  const collections = useCollectionsStore((s) => s.collections);
  const requests = useCollectionsStore((s) => s.requests);
  const environments = useEnvironmentsStore((s) => s.environments);
  const chains = useChainStore((s) => s.chains);

  return useMemo(() => {
    const store = createZustandStoreAccess();
    return attachedItems.map((chip) => ({
      chip,
      stale: !isStillAttached(store, chip),
    }));
  }, [attachedItems, collections, requests, environments, chains]);
}

type ComposerPillsProps = {
  /** Called after the pill is detached so the composer can strip its `@token`. */
  onRemove: (chip: ContextChip) => void;
  className?: string;
};

export function ComposerPills({ onRemove, className }: ComposerPillsProps) {
  const t = useTranslations("relay");
  const pills = useAttachedPills();
  const removeAttachedItem = useRelayStore((s) => s.removeAttachedItem);

  if (pills.length === 0) return null;

  const handleRemove = (chip: ContextChip) => {
    removeAttachedItem(chipKey(chip));
    onRemove(chip);
  };

  return (
    <ul
      aria-label={t("context.label")}
      data-testid="relay-composer-pills"
      className={cn("flex min-w-0 flex-wrap gap-1.5", className)}
    >
      {pills.map(({ chip, stale }) => {
        const name = redactValue(chip.label);
        const Icon = CHIP_KIND_ICONS[chip.kind];
        const title = stale ? t("composer.pill.stale", { name }) : name;
        return (
          <li
            key={chipKey(chip)}
            data-testid="relay-composer-pill"
            data-kind={chip.kind}
            data-stale={stale}
            title={title}
            className={cn(
              "flex max-w-full items-center gap-1 rounded-full border border-current/30 bg-muted py-0.5 pr-0.5 pl-2 text-xs font-medium",
              stale ? "text-muted-foreground" : ENTITY_ACCENT_CLASS,
            )}
          >
            <Icon aria-hidden className="size-3 shrink-0" />
            <span
              data-testid="relay-composer-pill-label"
              className={cn("truncate", stale && "line-through")}
            >
              {name}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-5 shrink-0 rounded-full"
              aria-label={t("composer.pill.remove", { name })}
              data-testid="relay-composer-pill-remove"
              onClick={() => handleRemove(chip)}
            >
              <XIcon aria-hidden className="size-3" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
