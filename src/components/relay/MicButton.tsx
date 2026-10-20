"use client";

import { MicIcon, SquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type DictationTranscript,
  useSpeechDictation,
} from "@/hooks/useSpeechDictation";
import { ComposerTip } from "./ComposerTip";
import { SpeechPrivacyNote } from "./SpeechPrivacyNote";

const ESCAPE_KEY = "Escape";
/** Anchored to the composer wrapper (which is `relative`), above the box, like the slash menu. */
const OVERLAY_CLASS =
  "absolute inset-x-0 bottom-full z-10 mb-1 flex flex-col gap-1";

/** Dictated words go after the draft that was there when dictation started. */
function mergeWithDraft(base: string, dictated: string): string {
  const text = dictated.trim();
  if (!base || !text) return base || text;
  return /\s$/.test(base) ? `${base}${text}` : `${base} ${text}`;
}

type MicButtonProps = {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/** Renders nothing where the browser has no speech recognition. */
export function MicButton({
  value,
  onValueChange,
  disabled = false,
  className,
  style,
}: MicButtonProps) {
  const t = useTranslations("relay.voice");
  const tooltipT = useTranslations("relay.composer.tooltip");
  const baseRef = useRef("");
  // The last text this button wrote; anything else in the box is a user edit.
  const writtenRef = useRef<string | null>(null);

  const { supported, state, start, stop, error } = useSpeechDictation({
    onTranscript: ({ final, interim }: DictationTranscript) => {
      const next = mergeWithDraft(baseRef.current, `${final}${interim}`);
      writtenRef.current = next;
      onValueChange(next);
    },
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

  // Typing while listening would be overwritten by the next result, so end dictation instead.
  useEffect(() => {
    if (
      listening &&
      writtenRef.current !== null &&
      value !== writtenRef.current
    )
      stop();
  }, [listening, value, stop]);

  if (!supported) return null;

  const handleClick = () => {
    if (listening) {
      stop();
      return;
    }
    baseRef.current = value;
    writtenRef.current = null;
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
