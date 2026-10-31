"use client";

import { Loader2Icon, MicIcon, SquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGrokDictation } from "@/hooks/useGrokDictation";
import { useSpeechDictation } from "@/hooks/useSpeechDictation";
import { useSttConfigured } from "@/hooks/useSttConfigured";
import { getEffectiveSpeechEngine } from "@/lib/relay/speechEngine";
import { useRelayStore } from "@/stores/useRelayStore";
import { ComposerTip } from "./ComposerTip";
import { LevelMeter } from "./LevelMeter";
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

/** Renders nothing where neither the active engine nor the browser can dictate. */
export function MicButton({
  onInsertText,
  disabled = false,
  className,
  style,
}: MicButtonProps) {
  const t = useTranslations("relay.voice");
  const tooltipT = useTranslations("relay.composer.tooltip");
  const storedEngine = useRelayStore((s) => s.speechEngine);
  // Only a stored Grok choice needs the server status, so opening the dock stays request-free.
  const sttConfigured = useSttConfigured(storedEngine === "grok");
  const browser = useSpeechDictation({ onFinalText: onInsertText });
  const grok = useGrokDictation({ onText: onInsertText });
  // Grok also needs a capture API; without one the stored choice falls back to the browser.
  const engine =
    grok.supported &&
    getEffectiveSpeechEngine(storedEngine, sttConfigured) === "grok"
      ? "grok"
      : "browser";
  const isGrok = engine === "grok";
  const supported = isGrok ? grok.supported : browser.supported;
  const listening = isGrok
    ? grok.state === "recording"
    : browser.state === "listening";
  const transcribing = isGrok && grok.state === "transcribing";
  const interim = isGrok ? "" : browser.interim;
  const stop = isGrok ? grok.stop : browser.stop;
  const start = isGrok ? grok.start : browser.start;
  const errorMessage = isGrok
    ? grok.error && t(`grokErrors.${grok.error}`)
    : browser.error && t(`errors.${browser.error}`);
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
      {isGrok && grok.analyser && listening ? (
        <LevelMeter analyser={grok.analyser} />
      ) : null}
      <ComposerTip
        label={`${listening ? t("stop") : tooltipT("mic")} (${t(`engine.${engine}`)})`}
      >
        <Button
          type="button"
          variant={listening ? "secondary" : "ghost"}
          size="icon"
          className={`relative ${className ?? ""}`}
          style={style}
          disabled={disabled || transcribing}
          aria-pressed={listening}
          aria-label={listening ? t("stop") : t("start")}
          data-testid="relay-mic"
          onClick={handleClick}
        >
          {transcribing ? (
            <Loader2Icon
              aria-hidden
              className="size-4 motion-safe:animate-spin"
            />
          ) : listening ? (
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
      {noteOpen || errorMessage || transcribing || grok.limitReached ? (
        <div className={OVERLAY_CLASS}>
          {noteOpen ? (
            <SpeechPrivacyNote
              engine={engine}
              onDismiss={() => setNoteOpen(false)}
            />
          ) : null}
          {isGrok && transcribing ? (
            <p
              role="status"
              data-testid="relay-mic-transcribing"
              className="rounded-lg border bg-popover p-2 text-xs text-muted-foreground shadow-md"
            >
              {t("transcribing")}
            </p>
          ) : null}
          {isGrok && grok.limitReached ? (
            <p
              role="status"
              data-testid="relay-mic-limit"
              className="rounded-lg border bg-popover p-2 text-xs text-muted-foreground shadow-md"
            >
              {t("limitReached")}
            </p>
          ) : null}
          {errorMessage ? (
            <div
              role="alert"
              data-testid="relay-mic-error"
              className="flex items-start gap-2 rounded-lg border bg-popover p-2 text-xs text-destructive shadow-md"
            >
              <p className="min-w-0 flex-1">{errorMessage}</p>
              {isGrok && grok.canRetry ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  data-testid="relay-mic-retry"
                  onClick={grok.retry}
                >
                  {t("retry")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
