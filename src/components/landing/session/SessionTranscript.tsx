"use client";

import type { RelaySessionScript } from "../data/sessions";
import { useSessionPlayback } from "../hooks/useSessionPlayback";
import { SessionStepView } from "./SessionStepView";

interface SessionTranscriptProps {
  session: RelaySessionScript;
  animate: boolean;
  /** Called after a finished run has been held on screen; omit to stay put. */
  onFinished?: () => void;
}

function RunStatus({ done, duration }: { done: boolean; duration: string }) {
  if (done) {
    return (
      <p className="text-xs text-muted-foreground">Worked for {duration}</p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className="inline-block size-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-[var(--landing-accent)] motion-reduce:animate-none"
      />
      Working…
    </p>
  );
}

/** One scripted run. Mount with a `key` per session so playback restarts. */
export function SessionTranscript({
  session,
  animate,
  onFinished,
}: SessionTranscriptProps) {
  const { shown, done } = useSessionPlayback({
    stepCount: session.steps.length,
    animate,
    onFinished,
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="ml-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm text-foreground">
        {session.prompt}
      </p>
      <ol className="flex flex-col gap-2">
        {session.steps.slice(0, shown).map((step, index) => (
          <SessionStepView
            key={step.id}
            step={step}
            resolved={index < shown - 1}
          />
        ))}
      </ol>
      <RunStatus done={done} duration={session.duration} />
    </div>
  );
}
