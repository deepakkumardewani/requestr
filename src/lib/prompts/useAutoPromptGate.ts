"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isFirstSession } from "@/lib/prompts/sessionTracker";

/** Auto prompts appear only inside the app shell (R45). */
const AUTO_PROMPT_ROUTE_PREFIXES = ["/app", "/chain"] as const;

const MODAL_DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]';

export function isAutoPromptRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return AUTO_PROMPT_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function hasOpenDialog(): boolean {
  return document.querySelector(MODAL_DIALOG_SELECTOR) !== null;
}

/** Tracks whether any modal dialog is mounted; closed dialogs unmount, so presence means open. */
function useModalDialogOpen(): boolean {
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const sync = () => setDialogOpen(hasOpenDialog());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return dialogOpen;
}

type AutoPromptGateOptions = {
  /** The analytics notice may show in session one (R44); every other auto prompt may not. */
  allowFirstSession?: boolean;
};

/** True when an auto prompt may be requested right now (R44, R45). */
export function useAutoPromptGate(
  options: AutoPromptGateOptions = {},
): boolean {
  const pathname = usePathname();
  const dialogOpen = useModalDialogOpen();
  const [firstSession, setFirstSession] = useState(true);

  // Read after mount so server and client markup agree.
  useEffect(() => {
    setFirstSession(isFirstSession());
  }, [pathname]);

  if (!isAutoPromptRoute(pathname) || dialogOpen) return false;
  return options.allowFirstSession === true || !firstSession;
}
