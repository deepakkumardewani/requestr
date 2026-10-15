"use client";

import { MessageSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { Button } from "@/components/ui/button";
import { deriveSuggestions, fillSuggestions } from "@/lib/relay/suggestions";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useResponseStore } from "@/stores/useResponseStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useAvailableChips } from "./ContextChips";

type SuggestionContext = "request" | "chain" | "workspace" | "empty";

/** 4 to 6 per context (FR-22). Keys live under `relay.suggestions`. */
export const SUGGESTION_KEYS: Record<SuggestionContext, readonly string[]> = {
  request: [
    "explainResponse",
    "addAssertions",
    "summarizeRequest",
    "checkHeaders",
  ],
  chain: [
    "explainChain",
    "whyChainFailed",
    "summarizeChain",
    "suggestNextStep",
  ],
  workspace: [
    "summarizeWorkspace",
    "listEnvironments",
    "findRequest",
    "whatCanYouDo",
  ],
  empty: ["createSample", "whatCanYouDo", "howToImport", "howToEnvironment"],
};

function useSuggestionContext(): SuggestionContext {
  const chips = useAvailableChips();
  const hasContent = useCollectionsStore(
    (s) => s.requests.length > 0 || s.collections.length > 0,
  );
  if (chips.some((chip) => chip.kind === "chain")) return "chain";
  if (chips.some((chip) => chip.kind === "request")) return "request";
  return hasContent ? "workspace" : "empty";
}

/**
 * Recomputed from the open tab and its last response on every render, so a
 * tab switch or a new conversation never shows stale prompts (FR-123).
 */
function useSuggestionKeys(context: SuggestionContext): readonly string[] {
  const tab = useTabsStore(
    (s) => s.tabs.find((item) => item.tabId === s.activeTabId) ?? null,
  );
  const response = useResponseStore((s) =>
    tab ? (s.responses[tab.tabId] ?? null) : null,
  );
  if (context === "chain") return SUGGESTION_KEYS.chain;
  return fillSuggestions(
    deriveSuggestions(tab, response),
    SUGGESTION_KEYS[context],
  );
}

export function EmptyState() {
  const t = useTranslations("relay");
  const submitPrompt = useRelayStore((s) => s.submitPrompt);
  const [showScope, setShowScope] = useState(false);
  const context = useSuggestionContext();
  const suggestionKeys = useSuggestionKeys(context);

  return (
    <ConversationEmptyState
      data-testid="relay-empty"
      title={t("emptyTitle")}
      description={t("emptyDescription")}
    >
      <MessageSquareIcon className="size-6 text-muted-foreground" aria-hidden />
      <ul
        aria-label={t("suggestions.label")}
        data-testid="relay-suggestions"
        data-context={context}
        className="mt-2 flex flex-wrap justify-center gap-1.5"
      >
        {suggestionKeys.map((key) => (
          <li key={key}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="relay-suggestion"
              onClick={() => submitPrompt(t(`suggestions.${key}`))}
            >
              {t(`suggestions.${key}`)}
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="link"
        size="sm"
        aria-expanded={showScope}
        data-testid="relay-see-what"
        onClick={() => setShowScope((shown) => !shown)}
      >
        {t("context.seeWhat")}
      </Button>
      {showScope ? (
        <p
          className="text-xs text-muted-foreground"
          data-testid="relay-see-what-body"
        >
          {t("context.seeWhatBody")}
        </p>
      ) : null}
    </ConversationEmptyState>
  );
}
