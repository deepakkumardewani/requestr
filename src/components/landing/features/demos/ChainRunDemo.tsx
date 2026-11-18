"use client";

import { PlayIcon } from "lucide-react";
import { useInView } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { type ChainNode, ChainNodeCard } from "./ChainNodeCard";
import { nodeRunState } from "./chainRun";
import { DemoFrame } from "./DemoFrame";

const IN_VIEW_AMOUNT = 0.4;
const STEP_MS = 900;
const NODES: readonly ChainNode[] = [
  {
    id: "login",
    block: "HTTP Request",
    title: "POST {{baseUrl}}/auth/login",
    result: "200 · 142 ms",
    output: '"access_token": "eyJhbGciOiJIUzI1NiJ9…"',
    link: "token ← $.access_token",
  },
  {
    id: "profile",
    block: "HTTP Request",
    title: "GET {{baseUrl}}/me",
    detail: "Authorization: Bearer {{token}}",
    result: "200 · 88 ms",
    output: '"name": "Ada Lovelace", "plan": "pro"',
  },
  {
    id: "check",
    block: "Validate",
    title: "Response matches the user schema",
    result: "valid · 3 ms",
    output: "0 errors",
  },
];

/** Steps a scripted run forward while it is on screen. */
function useChainRun(active: boolean) {
  const [completed, setCompleted] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || !active) return;
    if (completed >= NODES.length) {
      setRunning(false);
      return;
    }
    const timer = window.setTimeout(
      () => setCompleted((count) => count + 1),
      STEP_MS,
    );
    return () => window.clearTimeout(timer);
  }, [running, active, completed]);

  const start = useCallback((instant: boolean) => {
    setCompleted(instant ? NODES.length : 0);
    setRunning(!instant);
  }, []);

  return { completed, running, start };
}

/** A login chain: the token from the first response feeds the next request. */
export function ChainRunDemo() {
  const frameRef = useRef<HTMLElement>(null);
  const inView = useInView(frameRef, { amount: IN_VIEW_AMOUNT });
  const reduced = useReducedMotion();
  const run = useChainRun(inView);
  const [autoStarted, setAutoStarted] = useState(false);

  // Reduced motion shows the finished run straight away, on or off screen.
  useEffect(() => {
    if (reduced) run.start(true);
  }, [reduced, run.start]);

  useEffect(() => {
    if (!inView || autoStarted || reduced) return;
    setAutoStarted(true);
    run.start(false);
  }, [inView, autoStarted, reduced, run.start]);

  return (
    <DemoFrame
      label="Request chain example"
      title="chain · Login flow"
      frameRef={frameRef}
      controls={
        <button
          type="button"
          onClick={() => run.start(reduced)}
          disabled={run.running}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <PlayIcon aria-hidden="true" className="size-3.5" />
          {run.running ? "Running…" : "Run chain"}
        </button>
      }
    >
      <ol aria-label="Chain steps" className="space-y-0 p-4">
        {NODES.map((node, index) => (
          <ChainNodeCard
            key={node.id}
            node={node}
            state={nodeRunState(index, run.completed, run.running)}
            last={index === NODES.length - 1}
          />
        ))}
      </ol>
    </DemoFrame>
  );
}
