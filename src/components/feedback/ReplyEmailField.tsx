"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MAX_SURVEY_EMAIL_LENGTH } from "@/lib/analytics/events";
import { cn } from "@/lib/utils";

type ReplyEmailFieldProps = {
  wantsReply: boolean;
  onWantsReplyChange: (next: boolean) => void;
  email: string;
  onEmailChange: (next: string) => void;
  /** Shows the inline invalid-email error. */
  showError: boolean;
};

/** "Want a reply?" switch that reveals the email field; collapsed, the email is neither validated nor sent. */
export function ReplyEmailField({
  wantsReply,
  onWantsReplyChange,
  email,
  onEmailChange,
  showError,
}: ReplyEmailFieldProps) {
  const t = useTranslations("common.feedback");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = `${id}-error`;

  // Move focus only on the user's toggle, not when the dialog mounts with the switch already on.
  const toggledOn = useRef(false);
  useEffect(() => {
    if (wantsReply && toggledOn.current) inputRef.current?.focus();
    toggledOn.current = false;
  }, [wantsReply]);

  const handleToggle = (next: boolean) => {
    toggledOn.current = next;
    onWantsReplyChange(next);
  };

  return (
    <div className="grid">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`${id}-toggle`} className="font-normal">
          {t("replyToggle")}
        </Label>
        <Switch
          id={`${id}-toggle`}
          checked={wantsReply}
          onCheckedChange={handleToggle}
          data-testid="feedback-reply-toggle"
        />
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
          wantsReply
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        {/* Padding gives the focus ring room inside overflow-hidden; the matching negative margin keeps text aligned with the label. */}
        <div className="-mx-1 grid gap-1.5 overflow-hidden px-1 pb-1">
          <Input
            ref={inputRef}
            id={`${id}-email`}
            type="email"
            className="mt-2"
            value={email}
            disabled={!wantsReply}
            maxLength={MAX_SURVEY_EMAIL_LENGTH}
            placeholder={t("emailPlaceholder")}
            aria-label={t("emailLabel")}
            aria-invalid={showError}
            aria-describedby={showError ? errorId : undefined}
            onChange={(event) => onEmailChange(event.target.value)}
          />
          {showError && (
            <p id={errorId} role="alert" className="text-xs text-destructive">
              {t("emailInvalid")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
