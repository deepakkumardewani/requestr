"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isTrackingActive, submitSurvey, track } from "@/lib/analytics/adapter";
import {
  MAX_SURVEY_TEXT_LENGTH,
  type SurveyResponse,
} from "@/lib/analytics/events";
import { recordFeedbackSubmit } from "@/lib/feedback/feedbackState";
import { useFeedbackSurveyConfigured } from "@/providers/AppProviders";
import { usePromptStore } from "@/stores/usePromptStore";
import { showFeedbackSuccessToast } from "./FeedbackSuccessToast";
import { ReplyEmailField } from "./ReplyEmailField";
import { getPromptTone, type PromptTone } from "./ratingTone";
import { StarRating } from "./StarRating";

export const FEEDBACK_TEXT_MAX = MAX_SURVEY_TEXT_LENGTH;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PROMPT_KEYS: Record<PromptTone, { label: string; placeholder: string }> =
  {
    none: { label: "textLabel", placeholder: "textPlaceholder" },
    low: { label: "textLabelLow", placeholder: "textPlaceholderLow" },
    neutral: {
      label: "textLabelNeutral",
      placeholder: "textPlaceholderNeutral",
    },
    high: { label: "textLabelHigh", placeholder: "textPlaceholderHigh" },
  };

type FeedbackDialogProps = {
  /** Called when the user closes the dialog without submitting. */
  onDismiss?: () => void;
  /** Called after a successful submit. */
  onSubmitted?: () => void;
};

type Draft = {
  rating: number;
  text: string;
  /** Empty when the user did not ask for a reply. */
  email: string;
};

function buildResponse({ rating, text, email }: Draft): SurveyResponse {
  return {
    rating,
    ...(text ? { text } : {}),
    ...(email ? { email } : {}),
  };
}

function trackSubmitted({ rating, text, email }: Draft): void {
  // Explicit feedback goes out regardless of consent; tracking events only when analytics is on.
  if (!isTrackingActive()) return;
  track("feedback_submitted", {
    rating,
    has_text: text !== "",
    has_email: email !== "",
  });
}

function useFeedbackDraft() {
  const [rating, setRating] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [wantsReply, setWantsReply] = useState(false);
  const [email, setEmail] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [failed, setFailed] = useState(false);

  const replyEmail = wantsReply ? email.trim() : "";
  const emailInvalid = replyEmail !== "" && !EMAIL_PATTERN.test(replyEmail);

  const reset = () => {
    setRating(null);
    setText("");
    setWantsReply(false);
    setEmail("");
    setAttempted(false);
    setFailed(false);
  };

  return {
    fields: { rating, text, wantsReply, email, replyEmail, emailInvalid },
    setters: { setRating, setText, setWantsReply, setEmail },
    status: { attempted, failed, setAttempted, setFailed },
    reset,
  };
}

export function FeedbackDialog({
  onDismiss,
  onSubmitted,
}: FeedbackDialogProps) {
  const t = useTranslations("common.feedback");
  const open = usePromptStore((s) => s.active === "feedback");
  const configured = useFeedbackSurveyConfigured();
  const textId = useId();
  const ratingHintId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { fields, setters, status, reset } = useFeedbackDraft();
  const needsRating = fields.rating === null;
  const [submitting, setSubmitting] = useState(false);
  const prompt = PROMPT_KEYS[getPromptTone(fields.rating)];

  const close = () => usePromptStore.getState().release("feedback");

  const handleOpenChange = (next: boolean) => {
    if (next || submitting) return;
    reset();
    close();
    onDismiss?.();
  };

  const deliver = async (draft: Draft) => {
    setSubmitting(true);
    status.setFailed(false);
    const delivered = await submitSurvey(buildResponse(draft));
    setSubmitting(false);
    if (!delivered) {
      status.setFailed(true);
      return;
    }
    recordFeedbackSubmit();
    trackSubmitted(draft);
    showFeedbackSuccessToast({
      rating: draft.rating,
      email: draft.email || undefined,
    });
    reset();
    close();
    onSubmitted?.();
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    status.setAttempted(true);
    if (fields.rating === null || fields.emailInvalid || !configured) return;
    void deliver({
      rating: fields.rating,
      text: fields.text.trim(),
      email: fields.replyEmail,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Focus the title, not the first star, so opening doesn't flash a focus ring. */}
      <DialogContent data-testid="feedback-dialog" initialFocus={titleRef}>
        <form onSubmit={handleSubmit} noValidate className="grid gap-5">
          <DialogHeader>
            <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">
              {t("title")}
            </DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <StarRating
            value={fields.rating}
            onChange={setters.setRating}
            label={t("ratingLabel")}
            hint={t("ratingHint")}
            valueText={(value) => t(`ratingWord.${value}`)}
            optionLabel={(value) =>
              t("ratingOption", { value, label: t(`ratingWord.${value}`) })
            }
          />

          <div className="grid gap-2">
            <Label htmlFor={textId}>{t(prompt.label)}</Label>
            <Textarea
              id={textId}
              value={fields.text}
              maxLength={FEEDBACK_TEXT_MAX}
              placeholder={t(prompt.placeholder)}
              className="min-h-20 resize-none"
              onChange={(event) => setters.setText(event.target.value)}
            />
          </div>

          <ReplyEmailField
            wantsReply={fields.wantsReply}
            onWantsReplyChange={setters.setWantsReply}
            email={fields.email}
            onEmailChange={setters.setEmail}
            showError={status.attempted && fields.emailInvalid}
          />

          <FeedbackNotes configured={configured} failed={status.failed} />

          <DialogFooter>
            {/* The visible "Pick a rating" sits beside the stars (aria-hidden there); this copy explains the disabled Send. */}
            <span id={ratingHintId} className="sr-only">
              {t("ratingHint")}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!configured || submitting || needsRating}
              aria-busy={submitting}
              aria-describedby={needsRating ? ratingHintId : undefined}
            >
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FeedbackNotes({
  configured,
  failed,
}: {
  configured: boolean;
  failed: boolean;
}) {
  const t = useTranslations("common.feedback");
  return (
    <div className="-mt-1 grid gap-2">
      <p className="text-xs text-muted-foreground">{t("disclosure")}</p>
      {!configured && (
        <p
          data-testid="feedback-unconfigured"
          className="text-xs text-muted-foreground"
        >
          {t("unconfigured")}
        </p>
      )}
      {failed && (
        <p
          role="alert"
          data-testid="feedback-submit-error"
          className="rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
        >
          {t("submitError")}
        </p>
      )}
    </div>
  );
}
