"use client";

import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { MessageAction } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type UserMessageActionsProps = {
  text: string;
  onResend: (text: string) => void;
};

/** Edit & resend for the last user message: inline edit, then the thread is rewound. */
export function UserMessageActions({
  text,
  onResend,
}: UserMessageActionsProps) {
  const t = useTranslations("relay");
  const [draft, setDraft] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const wasEditing = useRef(false);

  // The edit button is unmounted while editing, so focus returns once it remounts.
  useEffect(() => {
    if (draft === null && wasEditing.current) buttonRef.current?.focus();
    wasEditing.current = draft !== null;
  }, [draft]);

  const close = () => setDraft(null);

  if (draft === null) {
    return (
      <MessageAction
        ref={buttonRef}
        label={t("actions.editResend")}
        data-testid="relay-edit-message"
        onClick={() => setDraft(text)}
      >
        <PencilIcon aria-hidden />
      </MessageAction>
    );
  }

  const trimmed = draft.trim();
  const resend = () => {
    if (!trimmed) return;
    setDraft(null);
    onResend(trimmed);
  };

  return (
    <div className="flex w-full flex-col gap-2" data-testid="relay-edit-form">
      <Textarea
        autoFocus
        value={draft}
        aria-label={t("actions.editInputLabel")}
        data-testid="relay-edit-input"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            close();
          } else if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            resend();
          }
        }}
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          data-testid="relay-edit-cancel"
          onClick={close}
        >
          {t("actions.cancelEdit")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!trimmed}
          data-testid="relay-edit-resend"
          onClick={resend}
        >
          {t("actions.resend")}
        </Button>
      </div>
    </div>
  );
}
