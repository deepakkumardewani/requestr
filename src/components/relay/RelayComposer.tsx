"use client";

import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type Ref,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import type { PickerItem } from "@/hooks/useRelayPickerItems";
import type { ContextChip } from "@/lib/relay/chips";
import {
  RELAY_COMPOSER_MAX_HEIGHT_PX,
  RELAY_COMPOSER_MIN_ROWS,
  RELAY_TOUCH_TARGET_STYLE,
} from "@/lib/relay/constants";
import {
  findActiveMention,
  isMentionMenuAllowed,
  replaceMention,
  stripMentionToken,
} from "@/lib/relay/mentions";
import {
  filterSlashCommands,
  findSlashQuery,
  needsClearConfirm,
  type SlashCommand,
} from "@/lib/relay/slashCommands";
import { useRelayRecentStore } from "@/stores/useRelayRecentStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { ComposerPills } from "./ComposerPills";
import { ComposerTip } from "./ComposerTip";
import { type MentionKeyHandler, MentionMenu } from "./MentionMenu";
import { MicButton } from "./MicButton";
import { RelayPicker } from "./RelayPicker";
import { SlashMenu, type SlashMenuHandle } from "./SlashMenu";

/** 36px (size-9) keeps icon controls tappable at the narrowest dock widths. */
const CONTROL_CLASS = "size-9 shrink-0";
/** The textarea sits inside the box, so the box owns the border and the focus ring. */
const TEXTAREA_CLASS =
  "min-w-0 rounded-none border-0 bg-transparent px-3 pt-3 pb-1 shadow-none focus-visible:ring-0 dark:bg-transparent";

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
  /** The open conversation has messages, so `/clear` asks before starting a new one. */
  threadHasMessages?: boolean;
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
  threadHasMessages = false,
}: RelayComposerProps) {
  const t = useTranslations("relay");
  const trimmed = value.trim();
  const addAttachedItem = useRelayStore((s) => s.addAttachedItem);
  const setComposerHasText = useRelayStore((s) => s.setComposerHasText);
  const recordRecent = useRelayRecentStore((s) => s.recordRecent);
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pendingCaretRef = useRef<number | null>(null);
  const menuRef = useRef<SlashMenuHandle>(null);
  const mentionKeyRef = useRef<MentionKeyHandler | null>(null);
  const [caret, setCaret] = useState(0);
  // Esc closes the menu for that `@` only; typing a new one opens it again.
  const [dismissedMentionStart, setDismissedMentionStart] = useState<
    number | null
  >(null);
  const [mentionOptionId, setMentionOptionId] = useState<string | null>(null);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const slashQuery = findSlashQuery(value);
  const slashCommands =
    slashQuery === null ? [] : filterSlashCommands(slashQuery);
  const slashOpen =
    slashCommands.length > 0 && !slashDismissed && !confirmingClear;
  const activeMention = isMentionMenuAllowed(value, caret)
    ? findActiveMention(value, Math.min(caret, value.length))
    : null;
  const mentionOpen =
    online &&
    !confirmingClear &&
    activeMention !== null &&
    activeMention.start !== dismissedMentionStart;

  useEffect(() => {
    if (!activeMention && dismissedMentionStart !== null) {
      setDismissedMentionStart(null);
    }
  }, [activeMention, dismissedMentionStart]);

  // Follows the value itself, so typing, a prefill and a send (which clears it) all update it.
  const hasText = trimmed.length > 0;
  useEffect(() => {
    setComposerHasText(hasText);
    return () => setComposerHasText(false);
  }, [hasText, setComposerHasText]);

  const setTextarea = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof textareaRef === "function") textareaRef(node);
      else if (textareaRef) textareaRef.current = node;
    },
    [textareaRef],
  );

  // The caret can only be placed once the controlled value has been written back.
  useLayoutEffect(() => {
    const target = pendingCaretRef.current;
    if (target === null) return;
    pendingCaretRef.current = null;
    innerRef.current?.setSelectionRange(target, target);
  }, [value]);

  const placeCaret = (position: number) => {
    pendingCaretRef.current = position;
    setCaret(position);
  };

  const attach = (chip: ContextChip) => {
    addAttachedItem(chip);
    recordRecent(chip);
  };

  const handlePick = (item: PickerItem) => {
    attach({ kind: item.kind, id: item.id, label: item.label });
    setPickerOpen(false);
    innerRef.current?.focus();
  };

  const handleMentionSelect = (chip: ContextChip) => {
    if (!activeMention) return;
    const next = replaceMention(value, activeMention, chip.label);
    placeCaret(next.caret);
    onValueChange(next.text);
    attach(chip);
    innerRef.current?.focus();
  };

  const handlePillRemove = (chip: ContextChip) => {
    onValueChange(stripMentionToken(value, chip.label));
  };

  const startNewConversation = () => {
    setConfirmingClear(false);
    onValueChange("");
    useRelayStore
      .getState()
      .newThread()
      .catch((error: unknown) => {
        console.error("[relay] starting a new thread failed", { error });
      });
    innerRef.current?.focus();
  };

  const cancelClear = () => {
    setConfirmingClear(false);
    innerRef.current?.focus();
  };

  const handleSlashSelect = (command: SlashCommand) => {
    if (command.id === "clear") {
      if (needsClearConfirm(command, threadHasMessages)) {
        setConfirmingClear(true);
        return;
      }
      startNewConversation();
      return;
    }
    const prompt = command.promptKey ? t(command.promptKey) : "";
    placeCaret(prompt.length);
    onValueChange(prompt);
    innerRef.current?.focus();
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onValueChange(event.target.value);
    setCaret(event.target.selectionStart);
    setSlashDismissed(false);
  };

  const handleSelect = (event: SyntheticEvent<HTMLTextAreaElement>) => {
    setCaret(event.currentTarget.selectionStart);
  };

  const handleSubmit = () => {
    if (!online || generating || trimmed.length === 0) return;
    onSend(trimmed);
    onValueChange("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen && menuRef.current?.handleKeyDown(event)) return;
    if (mentionOpen && mentionKeyRef.current?.(event)) return;
    if (event.key !== "ArrowUp" || value !== "" || !lastUserText) return;
    event.preventDefault();
    onValueChange(lastUserText);
  };

  const touchStyle = touchTargets ? RELAY_TOUCH_TARGET_STYLE : undefined;

  return (
    <PromptInput onSubmit={handleSubmit} className="gap-1">
      <div className="relative">
        {slashOpen ? (
          <div className="absolute inset-x-0 bottom-full z-10 mb-1">
            <SlashMenu
              ref={menuRef}
              commands={slashCommands}
              query={slashQuery ?? ""}
              onSelect={handleSlashSelect}
              onDismiss={() => setSlashDismissed(true)}
            />
          </div>
        ) : null}
        {mentionOpen && activeMention ? (
          <div className="absolute inset-x-0 bottom-full z-10 mb-1">
            <MentionMenu
              query={activeMention.query}
              anchor="composer"
              keyHandlerRef={mentionKeyRef}
              onActiveChange={setMentionOptionId}
              onSelect={handleMentionSelect}
              onClose={() => setDismissedMentionStart(activeMention.start)}
            />
          </div>
        ) : null}
        {confirmingClear ? (
          <ClearConfirm
            onConfirm={startNewConversation}
            onCancel={cancelClear}
          />
        ) : null}
        <div
          data-testid="relay-composer-box"
          className="flex flex-col rounded-2xl border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
        >
          <PromptInputTextarea
            ref={setTextarea}
            rows={RELAY_COMPOSER_MIN_ROWS}
            value={value}
            disabled={!online}
            aria-label={t("composerLabel")}
            aria-activedescendant={
              mentionOpen ? (mentionOptionId ?? undefined) : undefined
            }
            placeholder={t("composerPlaceholder")}
            data-testid="relay-composer"
            className={TEXTAREA_CLASS}
            style={{ maxHeight: RELAY_COMPOSER_MAX_HEIGHT_PX }}
            onChange={handleChange}
            onSelect={handleSelect}
            onKeyDown={handleKeyDown}
          />
          <div
            data-testid="relay-composer-toolbar"
            className="flex flex-wrap items-center gap-1 px-2 pb-2"
          >
            <RelayPicker
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              onSelect={handlePick}
              returnFocusTo={innerRef}
              trigger={
                <ComposerTip label={t("composer.tooltip.add")}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={CONTROL_CLASS}
                    style={touchStyle}
                    disabled={!online}
                    aria-label={t("picker.add")}
                    data-testid="relay-picker-trigger"
                  >
                    <PlusIcon aria-hidden />
                  </Button>
                </ComposerTip>
              }
            />
            {/* After `+` in the DOM so tab order is `+` then the pills, but `order-first` shows them on their own line above the toolbar. */}
            <ComposerPills
              onRemove={handlePillRemove}
              className="order-first basis-full"
            />
            <div className="ml-auto flex items-center gap-1">
              <MicButton
                value={value}
                onValueChange={onValueChange}
                disabled={!online}
                className={CONTROL_CLASS}
                style={touchStyle}
              />
              <ComposerTip
                label={
                  generating
                    ? t("composer.tooltip.stop")
                    : t("composer.tooltip.send")
                }
              >
                <PromptInputSubmit
                  generating={generating}
                  sendLabel={t("send")}
                  stopLabel={t("stop")}
                  onStop={onStop}
                  disabled={!generating && (!online || trimmed.length === 0)}
                  data-testid={generating ? "relay-stop" : "relay-send"}
                  title={undefined}
                  className={`${CONTROL_CLASS} rounded-full`}
                  style={touchStyle}
                />
              </ComposerTip>
            </div>
          </div>
        </div>
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

type ClearConfirmProps = { onConfirm: () => void; onCancel: () => void };

/** Inline, so the draft and the conversation stay visible while the user decides. */
function ClearConfirm({ onConfirm, onCancel }: ClearConfirmProps) {
  const t = useTranslations("relay.slash.clearConfirm");
  return (
    <div
      role="alertdialog"
      aria-label={t("message")}
      data-testid="relay-clear-confirm"
      className="absolute inset-x-0 bottom-full z-10 mb-1 flex flex-col gap-2 rounded-lg border bg-popover p-3 text-sm shadow-md"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onCancel();
      }}
    >
      <p>{t("message")}</p>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          data-testid="relay-clear-cancel"
          onClick={onCancel}
        >
          {t("cancel")}
        </Button>
        <Button
          type="button"
          size="sm"
          autoFocus
          data-testid="relay-clear-confirm-button"
          onClick={onConfirm}
        >
          {t("confirm")}
        </Button>
      </div>
    </div>
  );
}
