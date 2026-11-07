"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FALLBACK_RESPONSE,
  HERO_DEMO_URL,
  type HeroResponse,
} from "../fallbackResponse";
import { HERO_REQUEST_TIMEOUT_MS, withTimeout } from "../withTimeout";

const PROXY_PATH = "/api/proxy";
const TIMING_HEADER = "X-Timing-Total";

export type ResponseSource = "live" | "fallback";

export interface LiveRequestState {
  loading: boolean;
  response: HeroResponse | null;
  source: ResponseSource | null;
}

interface ProxyPayload {
  status: number;
  statusText: string;
  body: string;
}

/** Re-indents JSON bodies for display; non-JSON bodies pass through untouched. */
function prettyBody(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

async function fetchThroughProxy(
  url: string,
  signal: AbortSignal,
): Promise<HeroResponse> {
  const res = await fetch(PROXY_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      method: "GET",
      timeoutMs: HERO_REQUEST_TIMEOUT_MS,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Proxy responded ${res.status}`);
  const payload = (await res.json()) as ProxyPayload;
  return {
    status: payload.status,
    statusText: payload.statusText,
    timingMs: Math.round(Number(res.headers.get(TIMING_HEADER)) || 0),
    body: prettyBody(payload.body),
  };
}

/**
 * Sends one GET through the existing proxy. Any failure (timeout, offline,
 * proxy error) resolves to the recorded fallback so the hero never shows an
 * empty or broken state.
 */
export function useLiveRequest(url: string = HERO_DEMO_URL) {
  const [state, setState] = useState<LiveRequestState>({
    loading: false,
    response: null,
    source: null,
  });
  // Guards against a stale in-flight request overwriting a newer one.
  const requestId = useRef(0);

  useEffect(() => {
    return () => {
      requestId.current += 1;
    };
  }, []);

  const send = useCallback(async () => {
    const id = ++requestId.current;
    setState({ loading: true, response: null, source: null });
    let next: LiveRequestState;
    try {
      const response = await withTimeout((signal) =>
        fetchThroughProxy(url, signal),
      );
      next = { loading: false, response, source: "live" };
    } catch {
      // Expected path offline or on a slow connection; the fallback is the design.
      next = {
        loading: false,
        response: FALLBACK_RESPONSE,
        source: "fallback",
      };
    }
    if (id === requestId.current) setState(next);
  }, [url]);

  return { ...state, send };
}
