"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getThanksTone, type ThanksTone } from "./ratingTone";

export const FEEDBACK_TOAST_DURATION_MS = 5000;

const THANKS_KEY: Record<ThanksTone, string> = {
  low: "thanksLow",
  mid: "thanksMid",
  top: "thanksTop",
};

type FeedbackSuccessToastProps = {
  rating: number;
  /** The reply address the user chose to share; omitted when they didn't ask for a reply. */
  email?: string;
};

/** Draw-in check: `pathLength=1` lets one keyframe drive any path; without the animation it renders fully drawn. */
function DrawnCheck() {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground motion-safe:animate-[check-pop_420ms_cubic-bezier(0.22,1,0.36,1)_both]">
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          pathLength={1}
          strokeDasharray={1}
          className="motion-safe:animate-[check-draw_360ms_cubic-bezier(0.65,0,0.35,1)_160ms_both]"
        />
      </svg>
    </span>
  );
}

export function FeedbackSuccessToast({
  rating,
  email,
}: FeedbackSuccessToastProps) {
  const t = useTranslations("common.feedback");
  return (
    // No role here: sonner's toaster section is already a polite live region, so a nested status would double-announce.
    <div
      data-testid="feedback-success-toast"
      className="flex w-[var(--width,356px)] max-w-full items-center gap-3 rounded-lg border bg-popover p-3.5 text-popover-foreground shadow-lg"
    >
      <DrawnCheck />
      <div className="grid min-w-0 gap-0.5">
        <p className="text-sm font-medium">
          {t(THANKS_KEY[getThanksTone(rating)])}
        </p>
        {email && (
          <p className="truncate text-xs text-muted-foreground">
            {t("replyTo", { email })}
          </p>
        )}
      </div>
    </div>
  );
}

export function showFeedbackSuccessToast(
  props: FeedbackSuccessToastProps,
): void {
  toast.custom(() => <FeedbackSuccessToast {...props} />, {
    duration: FEEDBACK_TOAST_DURATION_MS,
  });
}
