"use client";

import {
  FileTextIcon,
  FolderIcon,
  GlobeIcon,
  type LucideIcon,
  PanelTopIcon,
  WorkflowIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { type ContextChip, chipKey } from "@/lib/relay/chips";
import { redactValue } from "@/lib/relay/redact";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import { isStillAttached } from "@/lib/relay/tools/workspaceRead";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayStore } from "@/stores/useRelayStore";

const KIND_LABEL_KEYS = {
  tab: "kindTab",
  request: "kindRequest",
  chain: "kindChain",
  collection: "kindCollection",
  environment: "kindEnvironment",
} as const satisfies Record<ContextChip["kind"], string>;

const KIND_ICONS = {
  tab: PanelTopIcon,
  request: FileTextIcon,
  chain: WorkflowIcon,
  collection: FolderIcon,
  environment: GlobeIcon,
} as const satisfies Record<ContextChip["kind"], LucideIcon>;

/**
 * The attached items still present in the workspace, matching what the
 * payload sends (AC-14). A tab has no live lookup, so its chip stays until removed.
 */
function useAttachedChips(): readonly ContextChip[] {
  const attachedItems = useRelayStore((s) => s.attachedItems);
  // Subscribed only so the memo recomputes when an attached entity is deleted.
  const collections = useCollectionsStore((s) => s.collections);
  const requests = useCollectionsStore((s) => s.requests);
  const environments = useEnvironmentsStore((s) => s.environments);
  const chains = useChainStore((s) => s.chains);

  return useMemo(() => {
    const store = createZustandStoreAccess();
    return attachedItems.filter((chip) => isStillAttached(store, chip));
  }, [attachedItems, collections, requests, environments, chains]);
}

export function ContextChips() {
  const t = useTranslations("relay.context");
  const chips = useAttachedChips();
  const removeAttachedItem = useRelayStore((s) => s.removeAttachedItem);

  if (chips.length === 0) return null;
  return (
    <ul
      aria-label={t("label")}
      data-testid="relay-context-chips"
      className="flex shrink-0 flex-wrap gap-1.5 border-t px-3 pt-2"
    >
      {chips.map((chip) => {
        const label = redactValue(chip.label);
        const Icon = KIND_ICONS[chip.kind];
        return (
          <li
            key={chipKey(chip)}
            data-testid="relay-context-chip"
            data-kind={chip.kind}
            className="flex max-w-full items-center gap-1 rounded-full border bg-muted/50 py-0.5 pr-0.5 pl-2 text-xs"
          >
            <Icon
              aria-hidden
              className="size-3 shrink-0 text-muted-foreground"
            />
            <span className="text-muted-foreground">
              {t(KIND_LABEL_KEYS[chip.kind])}
            </span>
            <span
              data-testid="relay-context-chip-label"
              className="truncate font-medium"
            >
              {label}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-5 rounded-full"
              aria-label={t("remove", { label })}
              data-testid="relay-context-chip-remove"
              onClick={() => removeAttachedItem(chipKey(chip))}
            >
              <XIcon aria-hidden className="size-3" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
