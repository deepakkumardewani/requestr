"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { AppSettings } from "@/types";

/** BCP-47 tags the browser recognizer expects, keyed by the app locale. */
export const SPEECH_LANG_BY_LOCALE: Record<AppSettings["locale"], string> = {
  en: "en-US",
  fr: "fr-FR",
  ja: "ja-JP",
};

export type DictationState = "idle" | "listening" | "error";
export type DictationError =
  | "denied"
  | "noSpeech"
  | "noMic"
  | "network"
  | "unknown";

/** Maps the recognizer's `error` codes; anything unlisted is "unknown". */
const ERROR_BY_CODE: Record<string, DictationError> = {
  "not-allowed": "denied",
  "service-not-allowed": "denied",
  "no-speech": "noSpeech",
  "audio-capture": "noMic",
  network: "network",
};

export type DictationTranscript = {
  /** Everything the recognizer has finalized since `start`. */
  final: string;
  /** Still-changing words that may be revised; "" once nothing is pending. */
  interim: string;
};

// Not in lib.dom: the minimal surface this hook relies on.
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;
type SpeechWindow = {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

function getRecognitionConstructor(): RecognitionConstructor | null {
  const w = window as unknown as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Options = {
  /** Called on every recognizer result with the session's cumulative text. Never sends anything. */
  onTranscript: (transcript: DictationTranscript) => void;
};

/**
 * Browser speech-to-text. Detection runs after mount so server and first
 * client render agree (`supported` starts false).
 */
export function useSpeechDictation({ onTranscript }: Options) {
  const locale = useSettingsStore((s) => s.locale);
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<DictationState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<DictationError | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    setSupported(getRecognitionConstructor() !== null);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition || state === "listening") return;
    const recognition = new Recognition();
    recognition.lang = SPEECH_LANG_BY_LOCALE[locale];
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalText = "";
    recognition.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else pending += result[0].transcript;
      }
      setInterim(pending);
      onTranscriptRef.current({ final: finalText, interim: pending });
    };
    recognition.onerror = (event) => {
      setError(ERROR_BY_CODE[event.error] ?? "unknown");
      setState("error");
    };
    // `end` follows `error` too, so this is the path back to idle. A late `end`
    // from a session that was already replaced must not reset the new one.
    recognition.onend = () => {
      const replaced =
        recognitionRef.current !== null &&
        recognitionRef.current !== recognition;
      if (replaced) return;
      recognitionRef.current = null;
      setInterim("");
      setState("idle");
    };

    recognitionRef.current = recognition;
    setError(null);
    setInterim("");
    setState("listening");
    try {
      recognition.start();
    } catch (cause) {
      console.error("[relay] starting dictation failed", { cause });
      recognitionRef.current = null;
      setError("unknown");
      setState("idle");
    }
  }, [locale, state]);

  useEffect(
    () => () => {
      const recognition = recognitionRef.current;
      if (!recognition) return;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    },
    [],
  );

  return { supported, state, interim, start, stop, error };
}
