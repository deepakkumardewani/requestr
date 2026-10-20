"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { Button } from "@/components/ui/button";
import { STARTER_KEYS } from "@/lib/relay/suggestions";
import { useRelayStore } from "@/stores/useRelayStore";
import { RelayLogo } from "./RelayLogo";

export function EmptyState() {
  const t = useTranslations("relay");
  const submitPrompt = useRelayStore((s) => s.submitPrompt);
  const [showScope, setShowScope] = useState(false);

  return (
    <ConversationEmptyState
      data-testid="relay-empty"
      title={t("emptyTitle")}
      description={t("emptyDescription")}
    >
      <RelayLogo className="size-12 text-foreground" />
      <ul
        aria-label={t("suggestions.label")}
        data-testid="relay-suggestions"
        className="mt-2 flex flex-wrap justify-center gap-1.5"
      >
        {STARTER_KEYS.map((key) => (
          <li key={key}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="relay-suggestion"
              onClick={() => submitPrompt(t(`emptyState.starters.${key}`))}
            >
              {t(`emptyState.starters.${key}`)}
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
