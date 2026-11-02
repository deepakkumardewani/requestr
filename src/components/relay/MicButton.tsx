"use client";

import { Loader2Icon, MicIcon, SquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type GrokDictationState,
  useGrokDictation,
} from "@/hooks/useGrokDictation";
import { useMicLevel } from "@/hooks/useMicLevel";
import { useSpeechDictation } from "@/hooks/useSpeechDictation";
import { useSttConfigured } from "@/hooks/useSttConfigured";
import { resolveDictationEngine } from "@/lib/relay/speechEngine";
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

const aiBusy = (state: GrokDictationState) =>
  state === "recording" || state === "transcribing";

/** Renders nothing where neither AI transcription nor the browser can dictate. */
export function MicButton({
  onInsertText,
  disabled = false,
  className,
  style,
}: MicButtonProps) {
  const t = useTranslations("relay.voice");
  const tooltipT = useTranslations("relay.composer.tooltip");
  // Server status is always requested so the engine is picked automatically.
  const sttConfigured = useSttConfigured(true);
  const browser = useSpeechDictation({ onFinalText: onInsertText });
  const ai = useGrokDictation({ onText: onInsertText });
  const resolved = resolveDictationEngine({
    sttConfigured,
    captureSupported: ai.supported,
    browserSupported: browser.supported,
  });
  // An active session keeps its engine, so a late status answer never switches it mid-listen.
  const engine = aiBusy(ai.state)
    ? "ai"
    : browser.state === "listening"
      ? "browser"
      : resolved;
  const isAi = engine === "ai";
  const listening = isAi
    ? ai.state === "recording"
    : browser.state === "listening";
  const transcribing = isAi && ai.state === "transcribing";
  const interim = isAi ? "" : browser.interim;
  const stop = isAi ? ai.stop : browser.stop;
  const start = isAi ? ai.start : browser.start;
  // The AI capture already owns a stream, so only browser mode opens one for the meter.
  const browserAnalyser = useMicLevel(!isAi && listening);
  const analyser = isAi ? ai.analyser : browserAnalyser;
  const errorMessage = isAi
    ? ai.error && t(`aiErrors.${ai.error}`)
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

  if (!engine) return null;

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
      {analyser && listening ? <LevelMeter analyser={analyser} /> : null}
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
      {noteOpen || errorMessage || transcribing || ai.limitReached ? (
        <div className={OVERLAY_CLASS}>
          {noteOpen ? (
            <SpeechPrivacyNote
              engine={engine}
              onDismiss={() => setNoteOpen(false)}
            />
          ) : null}
          {isAi && transcribing ? (
            <p
              role="status"
              data-testid="relay-mic-transcribing"
              className="rounded-lg border bg-popover p-2 text-xs text-muted-foreground shadow-md"
            >
              {t("transcribing")}
            </p>
          ) : null}
          {isAi && ai.limitReached ? (
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
              {isAi && ai.canRetry ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  data-testid="relay-mic-retry"
                  onClick={ai.retry}
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
