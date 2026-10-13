"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type AskUserCardProps = {
  question: string;
  options: readonly string[];
  /** Set once answered; the card then shows the choice and no buttons. */
  choice?: string;
  onChoose: (choice: string) => void;
};

/** Lets the user pick one option instead of the model guessing (FR-42). */
export function AskUserCard({
  question,
  options,
  choice,
  onChoose,
}: AskUserCardProps) {
  const t = useTranslations("relay.ask");
  const [picked, setPicked] = useState<string | null>(null);
  const settled = choice ?? picked;

  function pick(option: string) {
    if (settled !== null) return;
    setPicked(option);
    onChoose(option);
  }

  return (
    <div
      role="group"
      aria-label={t("cardLabel", { question })}
      data-testid="relay-ask-card"
      className="my-1.5 space-y-2 rounded-md border bg-card p-2 text-xs"
    >
      <p className="font-medium text-sm break-words">{question}</p>
      {settled !== null ? (
        <p data-testid="relay-ask-answer" className="text-muted-foreground">
          {t("answered", { choice: settled })}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option}
              type="button"
              size="xs"
              variant="outline"
              data-testid="relay-ask-option"
              onClick={() => pick(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
