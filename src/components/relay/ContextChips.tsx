"use client";

import { XIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isAutoChip } from "@/lib/relay/chips";
import {
  type ContextChip,
  chainIdFromPathname,
  chipKey,
  computeContextChips,
  selectActiveChips,
} from "@/lib/relay/contextBuilder";
import { redactValue } from "@/lib/relay/redact";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";

const KIND_LABEL_KEYS = {
  request: "kindRequest",
  chain: "kindChain",
  collection: "kindCollection",
  environment: "kindEnvironment",
} as const satisfies Record<ContextChip["kind"], string>;

/**
 * Every chip the workspace offers right now, removed or not. The same
 * function builds the payload, so what is shown is what is sent (AC-14).
 */
export function useAvailableChips(): ContextChip[] {
  const pathname = usePathname();
  // Subscribed only so the memo recomputes when the user changes what is open.
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const tabs = useTabsStore((s) => s.tabs);
  const collections = useCollectionsStore((s) => s.collections);
  const requests = useCollectionsStore((s) => s.requests);
  const activeEnvId = useEnvironmentsStore((s) => s.activeEnvId);
  const environments = useEnvironmentsStore((s) => s.environments);
  const chains = useChainStore((s) => s.chains);
  const attachedItems = useRelayStore((s) => s.attachedItems);

  return useMemo(
    () =>
      computeContextChips(
        createZustandStoreAccess(),
        chainIdFromPathname(pathname),
        attachedItems,
      ),
    [
      attachedItems,
      pathname,
      activeTabId,
      tabs,
      collections,
      requests,
      activeEnvId,
      environments,
      chains,
    ],
  );
}

export function ContextChips() {
  const t = useTranslations("relay.context");
  const available = useAvailableChips();
  const removed = useRelayStore((s) => s.removedChipKeys);
  const attachedItems = useRelayStore((s) => s.attachedItems);
  const removeChip = useRelayStore((s) => s.removeChip);
  const removeAttachedItem = useRelayStore((s) => s.removeAttachedItem);
  const dismissAutoChip = useRelayStore((s) => s.dismissAutoChip);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const chips = useMemo(
    () => selectActiveChips(available, removed, attachedItems),
    [available, removed, attachedItems],
  );
  const attachedKeys = useMemo(
    () => new Set(attachedItems.map(chipKey)),
    [attachedItems],
  );

  if (chips.length === 0) return null;
  return (
    <ul
      aria-label={t("label")}
      data-testid="relay-context-chips"
      className="flex shrink-0 flex-wrap gap-1.5 border-t px-3 pt-2"
    >
      {chips.map((chip) => {
        const label = redactValue(chip.label);
        const attached = attachedKeys.has(chipKey(chip));
        const auto = isAutoChip(chip) && !attached;
        const remove = () =>
          attached
            ? removeAttachedItem(chipKey(chip))
            : auto && chip.kind === "request" && activeTabId
              ? dismissAutoChip(activeTabId, chipKey(chip))
              : removeChip(chipKey(chip));
        return (
          <li
            key={chipKey(chip)}
            data-testid="relay-context-chip"
            data-kind={chip.kind}
            className="flex max-w-full items-center gap-1 rounded-full border bg-muted/50 py-0.5 pr-0.5 pl-2 text-xs"
          >
            {auto ? (
              <AutoChipLabel name={label} />
            ) : (
              <>
                <span className="text-muted-foreground">
                  {t(KIND_LABEL_KEYS[chip.kind])}
                </span>
                <span className="truncate font-medium">{label}</span>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-5 rounded-full"
              aria-label={t("remove", { label })}
              data-testid="relay-context-chip-remove"
              onClick={remove}
            >
              <XIcon aria-hidden className="size-3" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** "Using: <name> · current tab"; focusable so the tooltip is reachable by keyboard (NFR-8). */
function AutoChipLabel({ name }: { name: string }) {
  const t = useTranslations("relay.context");
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            // biome-ignore lint/a11y/noNoninteractiveTabindex: the tooltip trigger must be focusable
            tabIndex={0}
            data-testid="relay-context-chip-label"
            className="truncate rounded-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        {t("autoChip", { name })}
      </TooltipTrigger>
      <TooltipContent side="top">{t("autoChipTooltip")}</TooltipContent>
    </Tooltip>
  );
}
