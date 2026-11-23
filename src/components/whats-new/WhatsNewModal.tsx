"use client";

import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isTrackingActive, track } from "@/lib/analytics/adapter";
import { useAutoPromptGate } from "@/lib/prompts/useAutoPromptGate";
import {
  getHighlights,
  pickLatestWithHighlights,
} from "@/lib/whatsNew/highlights";
import {
  isReturningUser,
  NEXT_PUBLIC_APP_VERSION,
  readLastSeenVersion,
  recordSeenVersion,
} from "@/lib/whatsNew/whatsNewState";
import { usePromptStore } from "@/stores/usePromptStore";

type WhatsNewEvent = "whats_new_shown" | "whats_new_dismissed";

function emit(event: WhatsNewEvent, version: string): void {
  if (isTrackingActive()) track(event, { version });
}

/**
 * Resolves which release's notes this browser still owes the user. A new user
 * is marked as up to date silently; a returning user gets the newest release
 * since their last-seen version that has highlights.
 */
async function resolvePendingVersion(): Promise<string | null> {
  const current = NEXT_PUBLIC_APP_VERSION;
  if (!current) return null;
  const lastSeen = readLastSeenVersion();
  if (lastSeen === current) return null;
  if (lastSeen === null && !(await isReturningUser())) {
    recordSeenVersion(current);
    return null;
  }
  return pickLatestWithHighlights(lastSeen, current);
}

/**
 * Once-per-version "What's New" dialog for returning users (R37). Holds the
 * `whats-new` prompt slot while open, so it waits behind the tour and the
 * analytics notice and is deferred, not dropped, while another prompt shows.
 */
export function WhatsNewModal() {
  const t = useTranslations("common.whatsNew");
  const locale = useLocale();
  const gateOpen = useAutoPromptGate();
  const active = usePromptStore((s) => s.active === "whats-new");
  const [pendingVersion, setPendingVersion] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void resolvePendingVersion().then((version) => {
      if (!cancelled) setPendingVersion(version);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!gateOpen || pendingVersion === null) return;
    requested.current = true;
    usePromptStore.getState().request("whats-new", { auto: true });
    return () => {
      // A granted dialog stays until the user answers it; only an unanswered request is withdrawn.
      if (usePromptStore.getState().active === "whats-new") return;
      requested.current = false;
      usePromptStore.getState().release("whats-new");
    };
  }, [gateOpen, pendingVersion]);

  useEffect(
    () => () => {
      if (requested.current) usePromptStore.getState().release("whats-new");
    },
    [],
  );

  useEffect(() => {
    if (active && pendingVersion !== null)
      emit("whats_new_shown", pendingVersion);
  }, [active, pendingVersion]);

  if (!active || pendingVersion === null) return null;
  const bullets = getHighlights(pendingVersion, locale);

  const handleDismiss = () => {
    recordSeenVersion(NEXT_PUBLIC_APP_VERSION);
    emit("whats_new_dismissed", pendingVersion);
    requested.current = false;
    setPendingVersion(null);
    usePromptStore.getState().release("whats-new");
  };

  return (
    <Dialog open onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent data-testid="whats-new-modal" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="size-4 text-primary" />
            <DialogTitle>{t("title")}</DialogTitle>
          </div>
          <DialogDescription>
            {t("description", { version: pendingVersion })}
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-2 pl-5 text-sm text-foreground marker:text-muted-foreground">
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            className="focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
            data-testid="whats-new-dismiss"
            onClick={handleDismiss}
          >
            {t("dismiss")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
