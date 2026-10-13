"use client";

import { useTranslations } from "next-intl";
import type { KeyboardEvent, Ref } from "react";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { RELAY_MIN_TOUCH_TARGET_PX } from "@/lib/relay/constants";

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
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea
        ref={textareaRef}
        rows={2}
        value={value}
        disabled={!online}
        aria-label={t("composerLabel")}
        placeholder={t("composerPlaceholder")}
        data-testid="relay-composer"
        style={touchStyle}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <PromptInputFooter>
        {online ? (
          <span />
        ) : (
          <p
            role="status"
            data-testid="relay-offline-notice"
            className="text-xs text-muted-foreground"
          >
            {t("offlineNotice")}
          </p>
        )}
        <PromptInputSubmit
          generating={generating}
          sendLabel={t("send")}
          stopLabel={t("stop")}
          onStop={onStop}
          disabled={!generating && (!online || trimmed.length === 0)}
          data-testid={generating ? "relay-stop" : "relay-send"}
          style={touchStyle}
        />
      </PromptInputFooter>
    </PromptInput>
  );
}
