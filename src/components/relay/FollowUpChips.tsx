"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { FollowUpKey } from "@/lib/relay/followUps";
import { useRelayStore } from "@/stores/useRelayStore";

type FollowUpChipsProps = {
  keys: readonly FollowUpKey[];
  onSelect: (prompt: string) => void;
};

/** Under the last answer; hidden once the user starts typing (FR-196). */
export function FollowUpChips({ keys, onSelect }: FollowUpChipsProps) {
  const t = useTranslations("relay.followUps");
  const composerHasText = useRelayStore((s) => s.composerHasText);
  if (keys.length === 0 || composerHasText) return null;
  return (
    <div
      role="group"
      aria-label={t("label")}
      data-testid="relay-follow-ups"
      className="flex flex-wrap gap-2"
    >
      {keys.map((key) => (
        <Button
          key={key}
          type="button"
          size="sm"
          variant="outline"
          data-testid="relay-follow-up"
          onClick={() => onSelect(t(key))}
        >
          {t(key)}
        </Button>
      ))}
    </div>
  );
}
