"use client";

import { useTranslations } from "next-intl";
import type { KeyboardEvent, Ref } from "react";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { RELAY_MIN_TOUCH_TARGET_PX } from "@/lib/relay/constants";

/** 36px (size-9) keeps icon controls tappable at the narrowest dock widths. */
const CONTROL_CLASS = "size-9 shrink-0";
/** Empty until the attach (leading) and mic (trailing) controls fill them; collapses so it adds no gap. */
const SLOT_CLASS = "flex shrink-0 items-center gap-1 empty:hidden";

type RelayComposerProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  /** A reply is in flight; the submit button becomes Stop. */
  generating: boolean;
  online: boolean;
  /** Text recalled by ArrowUp when the draft is empty. */
  lastUserText: string | null;
  textareaRef: Ref<HTMLTextAreaElement>;
  touchTargets?: boolean;
};

export function RelayComposer({
  value,
  onValueChange,
  onSend,
  onStop,
  generating,
  online,
  lastUserText,
  textareaRef,
  touchTargets = false,
}: RelayComposerProps) {
  const t = useTranslations("relay");
  const trimmed = value.trim();

  const handleSubmit = () => {
    if (!online || generating || trimmed.length === 0) return;
    onSend(trimmed);
    onValueChange("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "ArrowUp" || value !== "" || !lastUserText) return;
    event.preventDefault();
    onValueChange(lastUserText);
  };

  const touchStyle = touchTargets
    ? { minHeight: RELAY_MIN_TOUCH_TARGET_PX }
    : undefined;

  return (
    <PromptInput onSubmit={handleSubmit} className="gap-1">
      <div className="flex items-end gap-2" data-testid="relay-composer-row">
        <div className={SLOT_CLASS} data-testid="relay-composer-leading" />
        <PromptInputTextarea
          ref={textareaRef}
          rows={2}
          value={value}
          disabled={!online}
          aria-label={t("composerLabel")}
          placeholder={t("composerPlaceholder")}
          data-testid="relay-composer"
          className="min-w-0 flex-1"
          style={touchStyle}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className={SLOT_CLASS} data-testid="relay-composer-trailing" />
        <PromptInputSubmit
          generating={generating}
          sendLabel={t("send")}
          stopLabel={t("stop")}
          onStop={onStop}
          disabled={!generating && (!online || trimmed.length === 0)}
          data-testid={generating ? "relay-stop" : "relay-send"}
          className={CONTROL_CLASS}
          style={touchStyle}
        />
      </div>
      {online ? null : (
        <p
          role="status"
          data-testid="relay-offline-notice"
          className="text-xs text-muted-foreground"
        >
          {t("offlineNotice")}
        </p>
      )}
      <p
        data-testid="relay-footer"
        className="text-center text-xs text-muted-foreground"
      >
        {t("composerFooter")}
      </p>
    </PromptInput>
  );
}
