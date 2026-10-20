"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { RelayLoadError } from "@/components/relay/RelayLoadError";
import { useRelayShortcut } from "@/hooks/useRelayShortcut";
import {
  RELAY_MAX_WIDTH_CSS,
  RELAY_MIN_WIDTH_CSS,
  RELAY_MOBILE_BREAKPOINT_PX,
} from "@/lib/relay/constants";
import { isRelayEnabled } from "@/lib/relay/flag";
import { clampRelayWidth, useRelayStore } from "@/stores/useRelayStore";

/** The landing page is marketing, not the workspace; Relay has no UI there. */
const LANDING_PATH = "/";

const DOCK_OFFSET_VAR = "--relay-dock-offset";

const MOBILE_QUERY = `(max-width: ${RELAY_MOBILE_BREAKPOINT_PX - 1}px)`;

// The dock body is split out of the main bundle and fetched on first open.
// A failed fetch resolves to an inline error so it cannot unmount the app
// (and with it the tab-bar toggle).
const RelayDock = dynamic(
  () =>
    import("./RelayDockWithMessages")
      .then((mod) => mod.RelayDockWithMessages)
      .catch(() => RelayLoadError),
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
      `clamp(${RELAY_MIN_WIDTH_CSS}, ${width}px, ${RELAY_MAX_WIDTH_CSS})`,
    );
    style.paddingRight = `var(${DOCK_OFFSET_VAR})`;
    return () => {
      style.removeProperty(DOCK_OFFSET_VAR);
      style.paddingRight = previousPadding;
    };
  }, [reserve, width]);
}

/** Limits are viewport-relative, so a resize can strand the stored width outside the new range. */
function useClampDockWidthOnResize(active: boolean) {
  useEffect(() => {
    if (!active) return;
    function handleResize() {
      const { width, setWidth } = useRelayStore.getState();
      const clamped = clampRelayWidth(width);
      if (clamped !== width) setWidth(clamped);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [active]);
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
  useClampDockWidthOnResize(active);

  useEffect(() => {
    if (open) setHasOpened(true);
  }, [open]);

  // Kept mounted after the first open so closing can animate out and the
  // draft survives a toggle.
  if (!active || !(open || hasOpened)) return null;

  return <RelayDock variant={isMobile ? "sheet" : "aside"} />;
}
