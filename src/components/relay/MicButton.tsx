"use client";

import { MicIcon, SquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSpeechDictation } from "@/hooks/useSpeechDictation";
import { ComposerTip } from "./ComposerTip";
import { SpeechPrivacyNote } from "./SpeechPrivacyNote";

const ESCAPE_KEY = "Escape";
/** Anchored to the composer wrapper (which is `relative`), above the box, like the slash menu. */
const OVERLAY_CLASS =
  "absolute inset-x-0 bottom-full z-10 mb-1 flex flex-col gap-1";

type MicButtonProps = {
  /** Receives each newly finalized phrase; the composer puts it at the caret. */
  onInsertText: (text: string) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/** Renders nothing where the browser has no speech recognition. */
export function MicButton({
  onInsertText,
  disabled = false,
  className,
  style,
}: MicButtonProps) {
  const t = useTranslations("relay.voice");
  const tooltipT = useTranslations("relay.composer.tooltip");
  const { supported, state, interim, start, stop, error } = useSpeechDictation({
    onFinalText: onInsertText,
  });
  const listening = state === "listening";
  // Per-session component state on purpose: nothing is persisted for this note.
  const [noteSeen, setNoteSeen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    if (!listening) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== ESCAPE_KEY) return;
      event.preventDefault();
      stop();
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [listening, stop]);

  if (!supported) return null;

  const handleClick = () => {
    if (listening) {
      stop();
      return;
    }
    if (!noteSeen) {
      setNoteSeen(true);
      setNoteOpen(true);
    }
    start();
  };

  return (
    <>
      <ComposerTip label={listening ? t("stop") : tooltipT("mic")}>
        <Button
          type="button"
          variant={listening ? "secondary" : "ghost"}
          size="icon"
          className={`relative ${className ?? ""}`}
          style={style}
          disabled={disabled}
          aria-pressed={listening}
          aria-label={listening ? t("stop") : t("start")}
          data-testid="relay-mic"
          onClick={handleClick}
        >
          {listening ? (
            <>
              <SquareIcon aria-hidden className="size-4" />
              <span
                aria-hidden
                data-testid="relay-mic-pulse"
                className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive motion-safe:animate-pulse"
              />
            </>
          ) : (
            <MicIcon aria-hidden />
          )}
        </Button>
      </ComposerTip>
      {listening ? (
        <span role="status" className="sr-only">
          {t("listening")}
        </span>
      ) : null}
      {listening && interim ? (
        <p
          data-testid="relay-mic-interim"
          className="sr-only"
          aria-live="polite"
        >
          {interim}
        </p>
      ) : null}
      {noteOpen || error ? (
        <div className={OVERLAY_CLASS}>
          {noteOpen ? (
            <SpeechPrivacyNote onDismiss={() => setNoteOpen(false)} />
          ) : null}
          {error ? (
            <p
              role="alert"
              data-testid="relay-mic-error"
              className="rounded-lg border bg-popover p-2 text-xs text-destructive shadow-md"
            >
              {t(`errors.${error}`)}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
