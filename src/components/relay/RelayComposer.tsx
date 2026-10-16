"use client";

import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type Ref,
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
import { RELAY_MIN_TOUCH_TARGET_PX } from "@/lib/relay/constants";
import {
  type ActiveMention,
  findActiveMention,
  replaceMention,
} from "@/lib/relay/mentions";
import {
  filterSlashCommands,
  findSlashQuery,
  needsClearConfirm,
  type SlashCommand,
} from "@/lib/relay/slashCommands";
import { useRelayStore } from "@/stores/useRelayStore";
import { RelayPicker } from "./RelayPicker";
import { SlashMenu, type SlashMenuHandle } from "./SlashMenu";

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
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Set when the picker was opened by typing `@`; the choice then replaces that text.
  const [mention, setMention] = useState<ActiveMention | null>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const menuRef = useRef<SlashMenuHandle>(null);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const slashQuery = findSlashQuery(value);
  const slashCommands =
    slashQuery === null ? [] : filterSlashCommands(slashQuery);
  const slashOpen =
    slashCommands.length > 0 && !slashDismissed && !confirmingClear;

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
    const caret = pendingCaretRef.current;
    if (caret === null) return;
    pendingCaretRef.current = null;
    innerRef.current?.setSelectionRange(caret, caret);
  }, [value]);

  const handlePickerOpenChange = (open: boolean) => {
    setPickerOpen(open);
    if (!open) setMention(null);
  };

  const handlePick = (item: PickerItem) => {
    addAttachedItem({ kind: item.kind, id: item.id, label: item.label });
    if (mention) {
      const next = replaceMention(value, mention, item.label);
      pendingCaretRef.current = next.caret;
      onValueChange(next.text);
    }
    handlePickerOpenChange(false);
    innerRef.current?.focus();
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
    pendingCaretRef.current = prompt.length;
    onValueChange(prompt);
    innerRef.current?.focus();
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    onValueChange(next);
    setSlashDismissed(false);
    const typed = next.length > value.length;
    const active = findActiveMention(next, event.target.selectionStart);
    // Only a freshly typed `@` opens the picker; editing text after it does not.
    if (typed && active?.query === "") {
      setMention(active);
      setPickerOpen(true);
    }
  };

  const handleSubmit = () => {
    if (!online || generating || trimmed.length === 0) return;
    onSend(trimmed);
    onValueChange("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen && menuRef.current?.handleKeyDown(event)) return;
    if (event.key !== "ArrowUp" || value !== "" || !lastUserText) return;
    event.preventDefault();
    onValueChange(lastUserText);
  };

  const touchStyle = touchTargets
    ? { minHeight: RELAY_MIN_TOUCH_TARGET_PX }
    : undefined;

  return (
    <PromptInput onSubmit={handleSubmit} className="gap-1">
      <div
        className="relative flex items-end gap-2"
        data-testid="relay-composer-row"
      >
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
        {confirmingClear ? (
          <ClearConfirm
            onConfirm={startNewConversation}
            onCancel={cancelClear}
          />
        ) : null}
        <div className={SLOT_CLASS} data-testid="relay-composer-leading">
          <RelayPicker
            open={pickerOpen}
            onOpenChange={handlePickerOpenChange}
            onSelect={handlePick}
            initialQuery={mention?.query}
            returnFocusTo={innerRef}
            trigger={
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
            }
          />
        </div>
        <PromptInputTextarea
          ref={setTextarea}
          rows={2}
          value={value}
          disabled={!online}
          aria-label={t("composerLabel")}
          placeholder={t("composerPlaceholder")}
          data-testid="relay-composer"
          className="min-w-0 flex-1"
          style={touchStyle}
          onChange={handleChange}
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
