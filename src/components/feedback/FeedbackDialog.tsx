"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isTrackingActive, submitSurvey, track } from "@/lib/analytics/adapter";
import {
  MAX_SURVEY_EMAIL_LENGTH,
  MAX_SURVEY_TEXT_LENGTH,
  type SurveyResponse,
} from "@/lib/analytics/events";
import { recordFeedbackSubmit } from "@/lib/feedback/feedbackState";
import { useFeedbackSurveyConfigured } from "@/providers/AppProviders";
import { usePromptStore } from "@/stores/usePromptStore";

export const FEEDBACK_TEXT_MAX = MAX_SURVEY_TEXT_LENGTH;

const RATING_VALUES = [1, 2, 3, 4, 5] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FeedbackDialogProps = {
  /** Called when the user closes the dialog without submitting. */
  onDismiss?: () => void;
  /** Called after a successful submit. */
  onSubmitted?: () => void;
};

type RatingInputProps = {
  value: number | null;
  onChange: (value: number) => void;
  label: string;
  optionLabel: (value: number) => string;
};

function RatingInput({
  value,
  onChange,
  label,
  optionLabel,
}: RatingInputProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {RATING_VALUES.map((rating) => {
        const selected = value !== null && rating <= value;
        return (
          <Button
            key={rating}
            type="button"
            variant="ghost"
            size="icon"
            role="radio"
            className="focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-checked={value === rating}
            aria-label={optionLabel(rating)}
            data-testid={`feedback-rating-${rating}`}
            onClick={() => onChange(rating)}
          >
            <Star
              className={
                selected ? "fill-primary text-primary" : "text-muted-foreground"
              }
            />
          </Button>
        );
      })}
    </div>
  );
}

function buildResponse(
  rating: number,
  text: string,
  email: string,
): SurveyResponse {
  return {
    rating,
    ...(text ? { text } : {}),
    ...(email ? { email } : {}),
  };
}

export function FeedbackDialog({
  onDismiss,
  onSubmitted,
}: FeedbackDialogProps) {
  const t = useTranslations("common.feedback");
  const open = usePromptStore((s) => s.active === "feedback");
  const configured = useFeedbackSurveyConfigured();
  const fieldId = useId();
  const [rating, setRating] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [email, setEmail] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const trimmedEmail = email.trim();
  const emailInvalid = trimmedEmail !== "" && !EMAIL_PATTERN.test(trimmedEmail);
  const ratingMissing = attempted && rating === null;

  const reset = () => {
    setRating(null);
    setText("");
    setEmail("");
    setAttempted(false);
    setFailed(false);
  };

  const close = () => usePromptStore.getState().release("feedback");

  const handleOpenChange = (next: boolean) => {
    if (next || submitting) return;
    reset();
    close();
    onDismiss?.();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (rating === null || emailInvalid || !configured) return;
    setSubmitting(true);
    setFailed(false);
    const hasText = text.trim() !== "";
    const delivered = await submitSurvey(
      buildResponse(rating, text.trim(), trimmedEmail),
    );
    setSubmitting(false);
    if (!delivered) {
      setFailed(true);
      return;
    }
    recordFeedbackSubmit();
    // Explicit feedback goes out regardless of consent; tracking events only when analytics is on.
    if (isTrackingActive()) {
      track("feedback_submitted", {
        rating,
        has_text: hasText,
        has_email: trimmedEmail !== "",
      });
    }
    reset();
    close();
    onSubmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="feedback-dialog">
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <Label id={`${fieldId}-rating`}>{t("ratingLabel")}</Label>
            <RatingInput
              value={rating}
              onChange={setRating}
              label={t("ratingLabel")}
              optionLabel={(value) => t("ratingOption", { value })}
            />
            {ratingMissing && (
              <p role="alert" className="text-xs text-destructive">
                {t("ratingRequired")}
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${fieldId}-text`}>{t("textLabel")}</Label>
            <Textarea
              id={`${fieldId}-text`}
              value={text}
              maxLength={FEEDBACK_TEXT_MAX}
              placeholder={t("textPlaceholder")}
              onChange={(event) => setText(event.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`${fieldId}-email`}>{t("emailLabel")}</Label>
            <Input
              id={`${fieldId}-email`}
              type="email"
              value={email}
              maxLength={MAX_SURVEY_EMAIL_LENGTH}
              placeholder={t("emailPlaceholder")}
              aria-invalid={attempted && emailInvalid}
              aria-describedby={
                attempted && emailInvalid ? `${fieldId}-email-error` : undefined
              }
              onChange={(event) => setEmail(event.target.value)}
            />
            {attempted && emailInvalid && (
              <p
                id={`${fieldId}-email-error`}
                role="alert"
                className="text-xs text-destructive"
              >
                {t("emailInvalid")}
              </p>
            )}
          </div>

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
            <p role="alert" className="text-xs text-destructive">
              {t("submitError")}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!configured || submitting}>
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
