"use client";

import { useEffect, useState } from "react";

const STATUS_URL = "/api/relay/stt/status";

let pending: Promise<boolean> | null = null;

async function requestConfigured(): Promise<boolean> {
  try {
    const response = await fetch(STATUS_URL, { cache: "no-store" });
    if (!response.ok) return false;
    const body = (await response.json()) as { configured?: unknown };
    return body.configured === true;
  } catch (error) {
    console.warn("[relay] speech status unavailable", { error });
    return false;
  }
}

/** Asked once per session; a failed fetch counts as not configured. Usable outside React. */
export function fetchSttConfigured(): Promise<boolean> {
  pending ??= requestConfigured();
  return pending;
}

/** Test seam: forgets the cached answer. */
export function resetSttConfiguredCache(): void {
  pending = null;
}

/**
 * `null` while the status is loading, or while `enabled` is false. Callers that
 * only need the answer for an opt-in feature pass `enabled` so nothing is
 * requested until then.
 */
export function useSttConfigured(enabled = true): boolean | null {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void fetchSttConfigured().then((value) => {
      if (active) setConfigured(value);
    });
    return () => {
      active = false;
    };
  }, [enabled]);
  return configured;
}
