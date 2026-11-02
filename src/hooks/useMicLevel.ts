"use client";

import { useEffect, useState } from "react";
import { createAnalyserFromStream } from "@/lib/relay/stt/createAnalyserFromStream";

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | undefined {
  const scoped = window as unknown as { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? scoped.webkitAudioContext;
}

/**
 * Opens a microphone analyser while `active` so browser-engine dictation can
 * show a level meter. A denied or failed stream yields no meter; dictation
 * itself is unaffected.
 */
export function useMicLevel(active: boolean): AnalyserNode | null {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  useEffect(() => {
    const Ctor = audioContextCtor();
    if (!active || !Ctor || !navigator.mediaDevices?.getUserMedia) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;

    const release = () => {
      for (const track of stream?.getTracks() ?? []) track.stop();
      void context?.close();
      stream = null;
      context = null;
    };

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((opened) => {
        stream = opened;
        if (cancelled) return release();
        context = new Ctor();
        setAnalyser(createAnalyserFromStream(context, opened).analyser);
      })
      .catch((error: unknown) => {
        console.warn("[relay] mic level meter unavailable", { error });
        release();
      });

    return () => {
      cancelled = true;
      release();
      setAnalyser(null);
    };
  }, [active]);

  return active ? analyser : null;
}
