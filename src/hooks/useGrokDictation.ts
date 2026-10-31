"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STT_MIN_RECORDING_MS } from "@/lib/relay/constants";
import {
  type CaptureSession,
  isCaptureSupported,
  startCapture,
} from "@/lib/relay/stt/audioCapture";
import { transcribeAudio } from "@/lib/relay/stt/client";
import {
  errorFromMicFailure,
  type GrokDictationError,
  SttRequestError,
} from "@/lib/relay/stt/errors";
import { toSttLanguage } from "@/lib/relay/stt/language";
import { useRelayStore } from "@/stores/useRelayStore";
import { useSettingsStore } from "@/stores/useSettingsStore";

export type GrokDictationState =
  | "idle"
  | "recording"
  | "transcribing"
  | "error";

type Options = {
  /** Receives the transcript once; the caller puts it at the caret. Never sends. */
  onText: (text: string) => void;
};

/**
 * Grok dictation: record a WAV, upload it, hand back the text. The microphone
 * is requested first, so a denial uploads nothing. A failed upload keeps the
 * WAV for `retry` until the error is dismissed or a new recording starts.
 */
export function useGrokDictation({ onText }: Options) {
  const locale = useSettingsStore((s) => s.locale);
  const activeThreadId = useRelayStore((s) => s.activeThreadId);
  const relayEnabled = useRelayStore((s) => s.enabled);
  const dockOpen = useRelayStore((s) => s.open);
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<GrokDictationState>("idle");
  const [error, setError] = useState<GrokDictationError | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const sessionRef = useRef<CaptureSession | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const keptBlobRef = useRef<Blob | null>(null);
  // Bumped on every discard so a late result from an abandoned run is ignored.
  const runRef = useRef(0);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    setSupported(isCaptureSupported());
  }, []);

  const fail = useCallback((kind: GrokDictationError) => {
    setError(kind);
    setState("error");
  }, []);

  const upload = useCallback(
    async (blob: Blob) => {
      const run = runRef.current;
      const controller = new AbortController();
      requestRef.current = controller;
      setError(null);
      setState("transcribing");
      try {
        const text = await transcribeAudio(blob, {
          language: toSttLanguage(locale),
          signal: controller.signal,
        });
        if (run !== runRef.current) return;
        keptBlobRef.current = null;
        setState("idle");
        if (text.trim()) onTextRef.current(text.trim());
        else fail("tooShort");
      } catch (cause) {
        if (run !== runRef.current) return;
        keptBlobRef.current = blob;
        fail(cause instanceof SttRequestError ? cause.kind : "unavailable");
      } finally {
        if (requestRef.current === controller) requestRef.current = null;
      }
    },
    [locale, fail],
  );

  const stop = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    setAnalyser(null);
    const run = runRef.current;
    const { blob, durationMs } = await session.stop();
    if (run !== runRef.current) return;
    if (durationMs < STT_MIN_RECORDING_MS) {
      fail("tooShort");
      return;
    }
    await upload(blob);
  }, [fail, upload]);

  const start = useCallback(async () => {
    if (state === "recording" || state === "transcribing") return;
    const run = ++runRef.current;
    keptBlobRef.current = null;
    setError(null);
    setLimitReached(false);
    try {
      const session = await startCapture({
        onLimit: () => {
          setLimitReached(true);
          void stop();
        },
      });
      if (run !== runRef.current) {
        session.abort();
        return;
      }
      sessionRef.current = session;
      setAnalyser(session.analyser);
      setState("recording");
    } catch (cause) {
      if (run !== runRef.current) return;
      fail(errorFromMicFailure(cause));
    }
  }, [state, stop, fail]);

  const retry = useCallback(() => {
    const blob = keptBlobRef.current;
    if (blob) void upload(blob);
  }, [upload]);

  const dismissError = useCallback(() => {
    keptBlobRef.current = null;
    setError(null);
    setState("idle");
  }, []);

  const discard = useCallback(() => {
    runRef.current += 1;
    sessionRef.current?.abort();
    sessionRef.current = null;
    requestRef.current?.abort();
    requestRef.current = null;
    keptBlobRef.current = null;
    setAnalyser(null);
    setError(null);
    setLimitReached(false);
    setState("idle");
  }, []);

  // Thread switch, Relay disabled or dock closed: drop the recording and insert nothing.
  useEffect(() => discard, [activeThreadId, relayEnabled, dockOpen, discard]);

  return {
    supported,
    state,
    error,
    limitReached,
    analyser,
    canRetry: error !== null && keptBlobRef.current !== null,
    start,
    stop,
    retry,
    dismissError,
  };
}
