import { useState } from "react";

/**
 * A key that changes every time the panel opens or its logical target changes.
 * Keying the panel body on it remounts the editors with fresh draft state,
 * so no editor needs an effect that resets itself on (re)open — including
 * reopening the same edge while the previous close animation is still running.
 */
export function useOpenSessionKey(open: boolean, sessionKey: string): string {
  const [wasOpen, setWasOpen] = useState(open);
  const [openCount, setOpenCount] = useState(0);

  // Adjusting state during render (not in an effect) avoids a stale first paint.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpenCount((count) => count + 1);
  }

  return `${openCount}|${sessionKey}`;
}
