"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type SpeechPrivacyNoteProps = {
  onDismiss: () => void;
  /** Grok sends audio to xAI, so its note says so. */
  engine?: "browser" | "grok";
};

/** Shown the first time dictation starts in a session; the caller owns the "seen" state. */
export function SpeechPrivacyNote({
  onDismiss,
  engine = "browser",
}: SpeechPrivacyNoteProps) {
  const t = useTranslations("relay.voice");
  return (
    <div
      role="status"
      data-testid="relay-speech-note"
      className="flex items-start gap-2 rounded-lg border bg-popover p-2 text-xs text-muted-foreground shadow-md"
    >
      <p className="min-w-0 flex-1">
        {t(engine === "grok" ? "grokPrivacyNote" : "privacyNote")}
      </p>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        data-testid="relay-speech-note-dismiss"
        onClick={onDismiss}
      >
        {t("dismissNote")}
      </Button>
    </div>
  );
}
