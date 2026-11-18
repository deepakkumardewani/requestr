"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RELAY_STORAGE_KEYS } from "@/lib/relay/constants";

const STEPS = ["can", "sees", "undo"] as const;
const SEEN_VALUE = "true";

/**
 * Storage can throw (private mode); the coach then shows each session rather
 * than breaking the dock, and the failure is logged with its key.
 */
function hasSeenCoach(): boolean {
  try {
    return localStorage.getItem(RELAY_STORAGE_KEYS.onboarded) === SEEN_VALUE;
  } catch (error) {
    console.warn("[relay] onboarding read failed", { error });
    return false;
  }
}

function markCoachSeen(): void {
  try {
    localStorage.setItem(RELAY_STORAGE_KEYS.onboarded, SEEN_VALUE);
  } catch (error) {
    console.warn("[relay] onboarding write failed", { error });
  }
}

/**
 * Three-step coach shown the first time the dock opens (FR-84). It is marked
 * seen as soon as it appears, so a reload mid-tour does not bring it back.
 */
export function RelayOnboarding() {
  const t = useTranslations("relay.onboarding");
  // The dock only mounts on the client, so reading storage here is safe.
  const [visible, setVisible] = useState(() => !hasSeenCoach());
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (visible) markCoachSeen();
  }, [visible]);

  if (!visible) return null;

  const key = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <section
      aria-label={t("label")}
      data-testid="relay-onboarding"
      className="shrink-0 space-y-2 border-b bg-muted/40 p-3 text-sm"
    >
      <p className="text-xs text-muted-foreground">
        {t("progress", { current: step + 1, total: STEPS.length })}
      </p>
      <h3 className="font-medium">{t(`steps.${key}.title`)}</h3>
      <p className="text-xs text-muted-foreground">
        {t(`steps.${key}.body`)}
        {isLast ? ` ${t("aiNote")}` : null}
      </p>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="relay-onboarding-dismiss"
          onClick={() => setVisible(false)}
        >
          {t("dismiss")}
        </Button>
        <div className="flex gap-2">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="relay-onboarding-back"
              onClick={() => setStep(step - 1)}
            >
              {t("back")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            data-testid="relay-onboarding-next"
            onClick={() => (isLast ? setVisible(false) : setStep(step + 1))}
          >
            {isLast ? t("done") : t("next")}
          </Button>
        </div>
      </div>
    </section>
  );
}
