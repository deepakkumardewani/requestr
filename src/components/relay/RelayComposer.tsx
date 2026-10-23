"use client";

import { PlusIcon, ShieldAlertIcon } from "lucide-react";
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
import {
  type SlashMentionRequest,
  useSlashCommandRunner,
} from "@/hooks/useSlashCommandRunner";
import {
  type ContextChip,
  isRedundantRequestAttach,
  isRedundantTabAttach,
} from "@/lib/relay/chips";
import {
  RELAY_COMPOSER_MAX_HEIGHT_PX,
  RELAY_COMPOSER_MIN_ROWS,
  RELAY_IMPORT_PREFILL,
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
  orderSlashCommands,
  type SlashCommand,
} from "@/lib/relay/slashCommands";
import { findTab } from "@/lib/relay/tools/tabRequests";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayRecentStore } from "@/stores/useRelayRecentStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { ComposerPills } from "./ComposerPills";
import { ComposerTip } from "./ComposerTip";
import { type MentionKeyHandler, MentionMenu } from "./MentionMenu";
import { MicButton } from "./MicButton";
import { PermissionShield } from "./PermissionShield";
import { RelayLauncher } from "./RelayLauncher";
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
  const setPermissionPopoverOpen = useRelayStore(
    (s) => s.setPermissionPopoverOpen,
  );
  const attachedItems = useRelayStore((s) => s.attachedItems);
  const setComposerHasText = useRelayStore((s) => s.setComposerHasText);
  const recordRecent = useRelayRecentStore((s) => s.recordRecent);
  const approvalsOff = useRelayPermissionStore((s) => s.mode === "skip");
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
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
  const [starterMention, setStarterMention] =
    useState<SlashMentionRequest | null>(null);
  const storeMentionRequest = useRelayStore((s) => s.mentionRequest);
  const clearStoreMentionRequest = useRelayStore((s) => s.clearMentionRequest);
  const activeMention = isMentionMenuAllowed(value, caret)
    ? findActiveMention(value, Math.min(caret, value.length))
    : null;

  useEffect(() => {
    if (!activeMention && dismissedMentionStart !== null) {
      setDismissedMentionStart(null);
    }
  }, [activeMention, dismissedMentionStart]);

  // A starter that needs a target asks for the mention menu through the store; it is taken once.
  useEffect(() => {
    if (!storeMentionRequest) return;
    setStarterMention({
      kind: storeMentionRequest.kind,
      hint: t(storeMentionRequest.hintKey),
      pinCurrentTab: true,
    });
    clearStoreMentionRequest();
    innerRef.current?.focus();
  }, [storeMentionRequest, clearStoreMentionRequest, t]);

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
    const tabRequestId =
      chip.kind === "tab" ? (findTab(chip.id)?.requestId ?? null) : null;
    const requestIdsFromAttachedTabs = new Set(
      attachedItems
        .filter((item) => item.kind === "tab")
        .map((item) => findTab(item.id)?.requestId)
        .filter((id): id is string => Boolean(id)),
    );
    const skipAttach =
      isRedundantTabAttach(chip, attachedItems, tabRequestId) ||
      isRedundantRequestAttach(chip, requestIdsFromAttachedTabs);
    if (!skipAttach) {
      addAttachedItem(chip);
    }
    recordRecent(chip);
  };

  const closeLauncher = useCallback((restoreFocus: boolean) => {
    setLauncherOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const handleLauncherChip = (chip: ContextChip) => {
    attach(chip);
    setLauncherOpen(false);
    innerRef.current?.focus();
  };

  const handlePasteCurl = () => {
    onValueChange(RELAY_IMPORT_PREFILL);
    placeCaret(RELAY_IMPORT_PREFILL.length);
    setLauncherOpen(false);
    innerRef.current?.focus();
  };

  const openPermissionPopover = () => {
    setLauncherOpen(false);
    setPermissionPopoverOpen(true);
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

  const {
    runSlashCommand,
    mentionRequest: slashMentionRequest,
    clearMentionRequest: clearSlashMentionRequest,
    completeTargetPick,
  } = useSlashCommandRunner({
    attachedItems,
    threadHasMessages,
    translate: (key) => t(key),
    onDraftChange: onValueChange,
    onCaret: placeCaret,
    onStartNewConversation: startNewConversation,
  });

  const slashQuery = findSlashQuery(value);
  const slashCommands =
    slashQuery === null
      ? []
      : orderSlashCommands(filterSlashCommands(slashQuery, (key) => t(key)));
  const slashOpen =
    slashCommands.length > 0 && !slashDismissed && !confirmingClear;
  const mentionRequest = slashMentionRequest ?? starterMention;
  const clearMentionRequest = () => {
    clearSlashMentionRequest();
    setStarterMention(null);
  };
  const slashMentionOpen = mentionRequest !== null;
  const mentionOpen =
    online &&
    !confirmingClear &&
    (slashMentionOpen ||
      (activeMention !== null &&
        activeMention.start !== dismissedMentionStart));

  const handleSlashSelect = (command: SlashCommand) => {
    setSlashDismissed(true);
    setLauncherOpen(false);
    const result = runSlashCommand(command);
    if (result.type === "clear-confirm") {
      setConfirmingClear(true);
      return;
    }
    innerRef.current?.focus();
  };

  const handleMentionSelect = (chip: ContextChip) => {
    if (slashMentionOpen) {
      attach(chip);
      completeTargetPick();
      setStarterMention(null);
      innerRef.current?.focus();
      return;
    }
    if (!activeMention) return;
    const next = replaceMention(value, activeMention, chip.label);
    placeCaret(next.caret);
    onValueChange(next.text);
    attach(chip);
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
        {mentionOpen ? (
          <div className="absolute inset-x-0 bottom-full z-10 mb-1">
            <MentionMenu
              query={slashMentionOpen ? "" : (activeMention?.query ?? "")}
              kind={slashMentionOpen ? (mentionRequest?.kind ?? null) : null}
              hint={slashMentionOpen ? mentionRequest?.hint : undefined}
              pinCurrentTab={
                slashMentionOpen ? mentionRequest?.pinCurrentTab : true
              }
              anchor="composer"
              keyHandlerRef={mentionKeyRef}
              onActiveChange={setMentionOptionId}
              onSelect={handleMentionSelect}
              onClose={() => {
                if (slashMentionOpen) {
                  clearMentionRequest();
                  return;
                }
                if (activeMention) {
                  setDismissedMentionStart(activeMention.start);
                }
              }}
            />
          </div>
        ) : null}
        {launcherOpen ? (
          <div className="absolute inset-x-0 bottom-full z-10 mb-1">
            <RelayLauncher
              triggerRef={triggerRef}
              onClose={closeLauncher}
              onSelectChip={handleLauncherChip}
              onPasteCurl={handlePasteCurl}
              onRunCommand={handleSlashSelect}
              onOpenPermission={openPermissionPopover}
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
            <ComposerTip label={t("composer.tooltip.add")}>
              <Button
                ref={triggerRef}
                type="button"
                variant="ghost"
                size="icon"
                className={CONTROL_CLASS}
                style={touchStyle}
                disabled={!online}
                aria-label={t("picker.add")}
                aria-expanded={launcherOpen}
                aria-haspopup="dialog"
                data-state={launcherOpen ? "open" : "closed"}
                data-testid="relay-picker-trigger"
                onClick={() => setLauncherOpen((open) => !open)}
              >
                <PlusIcon aria-hidden />
              </Button>
            </ComposerTip>
            <PermissionShield touchTargets={touchTargets} />
            {/* After the shield in the DOM so tab order is `+`, the shield, then the pills, but `order-first` shows them on their own line above the toolbar. */}
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
          {approvalsOff ? (
            <p
              role="status"
              data-testid="relay-permission-notice"
              className="flex items-center gap-1.5 px-3 pb-2 text-xs font-medium text-warning"
            >
              <ShieldAlertIcon aria-hidden className="size-3.5 shrink-0" />
              {t("permission.skipNotice")}
            </p>
          ) : null}
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
