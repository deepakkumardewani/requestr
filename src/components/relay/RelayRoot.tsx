"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRelayShortcut } from "@/hooks/useRelayShortcut";
import {
  RELAY_MAX_WIDTH_VW,
  RELAY_MIN_WIDTH_PX,
  RELAY_MOBILE_BREAKPOINT_PX,
} from "@/lib/relay/constants";
import { isRelayEnabled } from "@/lib/relay/flag";
import { useRelayStore } from "@/stores/useRelayStore";

/** The landing page is marketing, not the workspace; Relay has no UI there. */
const LANDING_PATH = "/";

const DOCK_OFFSET_VAR = "--relay-dock-offset";

const MOBILE_QUERY = `(max-width: ${RELAY_MOBILE_BREAKPOINT_PX - 1}px)`;

// The dock body is split out of the main bundle and fetched on first open.
const RelayDock = dynamic(
  () => import("./RelayDock").then((mod) => mod.RelayDock),
  { ssr: false },
);

function subscribeToMobileQuery(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsMobileViewport(): boolean {
  return useSyncExternalStore(
    subscribeToMobileQuery,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

/** Reserves room for the fixed dock so page content is pushed, not covered. */
function useReserveDockSpace(reserve: boolean, width: number) {
  useEffect(() => {
    if (!reserve) return;
    const { style } = document.body;
    const previousPadding = style.paddingRight;
    // Same bounds the dock enforces, so the gap tracks a resizing viewport.
    style.setProperty(
      DOCK_OFFSET_VAR,
      `clamp(${RELAY_MIN_WIDTH_PX}px, ${width}px, ${RELAY_MAX_WIDTH_VW}vw)`,
    );
    style.paddingRight = `var(${DOCK_OFFSET_VAR})`;
    return () => {
      style.removeProperty(DOCK_OFFSET_VAR);
      style.paddingRight = previousPadding;
    };
  }, [reserve, width]);
}

/**
 * Root-level owner of the Relay dock. It lives in the app providers rather
 * than in a page layout so the dock survives route changes (FR-1).
 */
export function RelayRoot() {
  const pathname = usePathname();
  const open = useRelayStore((s) => s.open);
  const width = useRelayStore((s) => s.width);
  const isMobile = useIsMobileViewport();
  const [hasOpened, setHasOpened] = useState(false);

  const active = isRelayEnabled() && pathname !== LANDING_PATH;

  useRelayShortcut({ enabled: active });
  useReserveDockSpace(active && open && !isMobile, width);

  useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  // Kept mounted after the first open so closing can animate out and the
  // draft survives a toggle.
  if (!active || !(open || hasOpened)) return null;

  return <RelayDock variant={isMobile ? "sheet" : "aside"} />;
}
