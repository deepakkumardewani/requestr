"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useCapabilityStarter } from "@/hooks/useCapabilityStarter";
import { getChainDisplayName } from "@/lib/chainDisplayName";
import {
  pickSuggestions,
  type Suggestion,
  type SuggestionContext,
} from "@/lib/relay/suggestions";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { RelayLogo } from "./RelayLogo";

const CHAIN_PATH_PREFIX = "/chain/";

/** What the user has open, most specific first: a chain page, a request tab, the active environment. */
function useSuggestionContext(): SuggestionContext {
  const pathname = usePathname();
  const chainId = pathname?.startsWith(CHAIN_PATH_PREFIX)
    ? decodeURIComponent(pathname.slice(CHAIN_PATH_PREFIX.length))
    : null;
  const collections = useCollectionsStore((s) => s.collections);
  const activeTab = useTabsStore((s) =>
    s.tabs.find((tab) => tab.tabId === s.activeTabId),
  );
  const activeEnv = useEnvironmentsStore((s) =>
    s.environments.find((env) => env.id === s.activeEnvId),
  );

  const chain = useChainStore((s) => (chainId ? s.chains[chainId] : undefined));
  if (chain) {
    const label = getChainDisplayName(chain, collections);
    return { kind: "chain", target: { kind: "chain", id: chain.id, label } };
  }
  if (activeTab) {
    // A saved request is attached as itself; an unsaved draft as the tab.
    const target = activeTab.requestId
      ? {
          kind: "request" as const,
          id: activeTab.requestId,
          label: activeTab.name,
        }
      : { kind: "tab" as const, id: activeTab.tabId, label: activeTab.name };
    return { kind: "request", target };
  }
  if (activeEnv) {
    const target = {
      kind: "environment" as const,
      id: activeEnv.id,
      label: activeEnv.name,
    };
    return { kind: "environment", target };
  }
  return { kind: "none" };
}

/** New-chat state: suggestions matched to what is open, and a quiet way to the full list (EMPTY-01, EMPTY-02). */
export function EmptyState() {
  const t = useTranslations("relay");
  const { runStarter, runTargetSuggestion } = useCapabilityStarter();
  const setCapabilitiesOpen = useRelayStore((s) => s.setCapabilitiesOpen);
  const suggestions = pickSuggestions(useSuggestionContext());

  const run = (suggestion: Suggestion) =>
    suggestion.type === "target"
      ? runTargetSuggestion(suggestion)
      : runStarter(suggestion);

  return (
    // `my-auto` centers short content yet lets tall content scroll from its top.
    <div
      data-testid="relay-empty"
      className="my-auto flex w-full flex-col items-center gap-4 px-4 py-6 text-center"
    >
      <RelayLogo className="size-16 text-foreground" />
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-medium">
          {t("capabilities.empty.title")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("capabilities.empty.description")}
        </p>
      </div>
      <ul className="flex w-full flex-col gap-1.5 text-left">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="relay-suggestion"
              data-suggestion={suggestion.id}
              className="h-auto w-full justify-start py-2 text-left font-normal whitespace-normal"
              onClick={() => run(suggestion)}
            >
              {t(suggestion.labelKey, {
                name:
                  suggestion.type === "target" ? suggestion.target.label : "",
              })}
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="link"
        size="sm"
        data-testid="relay-see-everything"
        className="h-auto p-0 text-xs text-muted-foreground"
        onClick={() => setCapabilitiesOpen(true)}
      >
        {t("capabilities.seeEverything")}
      </Button>
    </div>
  );
}
