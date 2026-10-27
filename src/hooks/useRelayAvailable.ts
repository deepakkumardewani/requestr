"use client";

import { isRelayEnabled } from "@/lib/relay/flag";
import { useRelayStore } from "@/stores/useRelayStore";

/**
 * Single gate for every Relay surface (BUG-05): the build flag AND the user's
 * Enable setting. Reactive, so toggling the setting needs no reload.
 */
export function useRelayAvailable(): boolean {
  const enabled = useRelayStore((s) => s.enabled);
  return isRelayEnabled() && enabled;
}
