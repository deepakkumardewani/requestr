"use client";

import type { Editor, JSONContent } from "@tiptap/react";
import { PlusIcon, ShieldAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PromptInput,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { useSlashCommandRunner } from "@/hooks/useSlashCommandRunner";
import {
  type ContextChip,
  chipKey,
  isRedundantRequestAttach,
  isRedundantTabAttach,
} from "@/lib/relay/chips";
import {
  RELAY_IMPORT_PREFILL,
  RELAY_TOUCH_TARGET_STYLE,
} from "@/lib/relay/constants";
import {
  isSendable,
  toOutgoingText,
  withDeletedPills,
} from "@/lib/relay/editorSerializer";
import {
  attachmentPillContent,
  commandPillContent,
  createMentionExtension,
  type TriggerSession,
} from "@/lib/relay/mentionSuggestion";
import {
  filterSlashCommands,
  orderSlashCommands,
  SLASH_COMMANDS,
  type SlashCommand,
} from "@/lib/relay/slashCommands";
import { createSlashExtension } from "@/lib/relay/slashSuggestion";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import { findTab } from "@/lib/relay/tools/tabRequests";
import { isStillAttached } from "@/lib/relay/tools/workspaceRead";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayRecentStore } from "@/stores/useRelayRecentStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { AttachmentPillNode } from "./AttachmentPillNode";
import { CommandPillNode } from "./CommandPillNode";
import { ComposerTip } from "./ComposerTip";
import type {
  PromptEditorHandle,
  PromptSegment,
  SerializedEditor,
} from "./editorTypes";
import { type MentionKeyHandler, MentionMenu } from "./MentionMenu";
import { MicButton } from "./MicButton";
import { PermissionShield } from "./PermissionShield";
import { PromptEditor, segmentsToDoc } from "./PromptEditor";
import { RelayLauncher } from "./RelayLauncher";
import { SlashMenu, type SlashMenuHandle } from "./SlashMenu";

/** 36px (size-9) keeps icon controls tappable at the narrowest dock widths. */
const CONTROL_CLASS = "size-9 shrink-0";
const EMPTY_DOC: SerializedEditor = {
  text: "",
  segments: [],
  attachments: [],
  commands: [],
};

type RelayComposerProps = {
  /** Plain text of the draft; a change that did not come from the editor replaces its content. */
  value: string;
  onValueChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  /** A reply is in flight; the submit button becomes Stop. */
  generating: boolean;
  online: boolean;
  /** Text recalled by ArrowUp when the draft is empty. */
  lastUserText: string | null;
  /** Receives the editable element so the dock can focus it. */
  textareaRef: Ref<HTMLElement>;
  touchTargets?: boolean;
  /** The open conversation has messages, so `/clear` asks before starting a new one. */
  threadHasMessages?: boolean;
};

const EDITABLE_SELECTOR = "input, textarea, [contenteditable='true']";

/**
 * The editor is created after the dock's open-focus effect already ran, so that
 * effect found no element. Focus once it exists, but only for a user-requested
 * open and never while the user is already typing in some other field.
 */
function focusIfOpenedWithoutFocusTarget(ready: Editor | null) {
  const { open, focusRequest } = useRelayStore.getState();
  const active = document.activeElement;
  const typingElsewhere =
    active instanceof HTMLElement && active.matches(EDITABLE_SELECTOR);
  if (ready && open && focusRequest > 0 && !typingElsewhere) {
    ready.commands.focus();
  }
}

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
  const setPermissionPopoverOpen = useRelayStore(
    (s) => s.setPermissionPopoverOpen,
  );
  const setComposerHasText = useRelayStore((s) => s.setComposerHasText);
  const recordRecent = useRelayRecentStore((s) => s.recordRecent);
  const approvalsOff = useRelayPermissionStore((s) => s.mode === "skip");
  const storeMentionRequest = useRelayStore((s) => s.mentionRequest);
  const clearStoreMentionRequest = useRelayStore((s) => s.clearMentionRequest);
  const attachmentResetRequest = useRelayStore((s) => s.attachmentResetRequest);

  const handleRef = useRef<PromptEditorHandle>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<SlashMenuHandle>(null);
  const mentionKeyRef = useRef<MentionKeyHandler | null>(null);
  /** The text the editor last reported, to tell its own changes from outside ones. */
  const reportedTextRef = useRef("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [doc, setDoc] = useState<SerializedEditor>(EMPTY_DOC);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [mentionSession, setMentionSession] = useState<TriggerSession | null>(
    null,
  );
  const [slashSession, setSlashSession] = useState<TriggerSession | null>(null);
  // Esc hides a menu for that trigger only; typing a new one opens it again.
  const [dismissedMentionFrom, setDismissedMentionFrom] = useState<
    number | null
  >(null);
  const [dismissedSlashFrom, setDismissedSlashFrom] = useState<number | null>(
    null,
  );
  const [mentionOptionId, setMentionOptionId] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [starterRequest, setStarterRequest] =
    useState<typeof storeMentionRequest>(null);

  // Stable, so the editor is built once and keeps its caret.
  const extensions = useMemo(
    () => [
      AttachmentPillNode,
      CommandPillNode,
      createMentionExtension(setMentionSession),
      createSlashExtension(setSlashSession),
    ],
    [],
  );

  const focusEditor = useCallback(() => {
    editor?.commands.focus();
  }, [editor]);

  const handleReady = useCallback(
    (ready: Editor | null) => {
      setEditor(ready);
      focusIfOpenedWithoutFocusTarget(ready);
      const dom = ready?.view.dom ?? null;
      if (typeof textareaRef === "function") textareaRef(dom);
      else if (textareaRef) textareaRef.current = dom;
    },
    [textareaRef],
  );

  const replaceSegments = useCallback(
    (segments: readonly PromptSegment[], focusEnd = true) => {
      if (!editor) return;
      editor.commands.setContent(segmentsToDoc(segments), { emitUpdate: true });
      if (focusEnd) editor.commands.focus("end");
    },
    [editor],
  );
  const replaceContent = useCallback(
    (text: string) => replaceSegments([{ type: "text", text }]),
    [replaceSegments],
  );

  // A value the editor did not report (prefill, recalled message) replaces its content.
  useEffect(() => {
    if (value === reportedTextRef.current) return;
    replaceContent(value);
  }, [value, replaceContent]);

  // A draft opened from an entry point keeps its pills; it is taken once.
  const composerDraft = useRelayStore((s) => s.composerDraft);
  useEffect(() => {
    if (!composerDraft || !editor) return;
    useRelayStore.getState().clearComposerDraft();
    // Tiptap renders pill node views with flushSync, which React forbids inside an effect.
    // A draft that comes with a target picker leaves focus to the picker's search field.
    queueMicrotask(() => replaceSegments(composerDraft, !storeMentionRequest));
  }, [composerDraft, editor, replaceSegments, storeMentionRequest]);

  // Starting a new conversation empties the editor, pills included.
  const seenResetRef = useRef(attachmentResetRequest);
  useEffect(() => {
    if (seenResetRef.current === attachmentResetRequest) return;
    seenResetRef.current = attachmentResetRequest;
    handleRef.current?.clear();
  }, [attachmentResetRequest]);

  // The store mirror follows the pills in the editor, never the other way round.
  const handleChange = useCallback(
    (serialized: SerializedEditor) => {
      reportedTextRef.current = serialized.text;
      setDoc(serialized);
      useRelayStore.getState().syncAttachedItems(serialized.attachments);
      onValueChange(serialized.text);
    },
    [onValueChange],
  );

  // A starter that needs a target asks for the picker through the store; it is taken once.
  // The editor is not focused here: Tiptap defers its focus to a frame, which would
  // steal it back from the picker's own search input.
  useEffect(() => {
    if (!storeMentionRequest) return;
    setStarterRequest(storeMentionRequest);
    clearStoreMentionRequest();
  }, [storeMentionRequest, clearStoreMentionRequest]);

  const hasContent = isSendable(doc);
  useEffect(() => {
    setComposerHasText(hasContent);
    return () => setComposerHasText(false);
  }, [hasContent, setComposerHasText]);

  useEffect(() => {
    if (!mentionSession) setDismissedMentionFrom(null);
  }, [mentionSession]);
  useEffect(() => {
    if (!slashSession) setDismissedSlashFrom(null);
  }, [slashSession]);

  /** Puts content where the trigger text was, or at the caret when no trigger is open. */
  const insertContent = (
    content: JSONContent[],
    session: TriggerSession | null,
  ) => {
    if (session) {
      session.insert(content);
      return;
    }
    // Tiptap warns on empty content, and there is no trigger text to remove here.
    if (content.length === 0) editor?.commands.focus();
    else editor?.chain().focus().insertContent(content).run();
  };

  const isRedundantAttach = (chip: ContextChip): boolean => {
    const attached = doc.attachments;
    if (attached.some((item) => chipKey(item) === chipKey(chip))) return true;
    const tabRequestId =
      chip.kind === "tab" ? (findTab(chip.id)?.requestId ?? null) : null;
    const requestIdsFromAttachedTabs = new Set(
      attached
        .filter((item) => item.kind === "tab")
        .map((item) => findTab(item.id)?.requestId)
        .filter((id): id is string => Boolean(id)),
    );
    return (
      isRedundantTabAttach(chip, attached, tabRequestId) ||
      isRedundantRequestAttach(chip, requestIdsFromAttachedTabs)
    );
  };

  const attach = (chip: ContextChip, session: TriggerSession | null) => {
    insertContent(
      isRedundantAttach(chip) ? [] : attachmentPillContent(chip),
      session,
    );
    recordRecent(chip);
  };

  const closeLauncher = useCallback((restoreFocus: boolean) => {
    setLauncherOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const handleLauncherChip = (chip: ContextChip) => {
    attach(chip, null);
    setLauncherOpen(false);
  };

  const handlePasteCurl = () => {
    replaceContent(RELAY_IMPORT_PREFILL);
    setLauncherOpen(false);
  };

  const openPermissionPopover = () => {
    setLauncherOpen(false);
    setPermissionPopoverOpen(true);
  };

  const startNewConversation = () => {
    setConfirmingClear(false);
    handleRef.current?.clear();
    useRelayStore
      .getState()
      .newThread()
      .catch((error: unknown) => {
        console.error("[relay] starting a new thread failed", { error });
      });
    focusEditor();
  };

  const cancelClear = () => {
    setConfirmingClear(false);
    focusEditor();
  };

  const {
    runSlashCommand,
    mentionRequest: slashMentionRequest,
    clearMentionRequest: clearSlashMentionRequest,
    completeTargetPick,
  } = useSlashCommandRunner({
    attachedItems: doc.attachments,
    threadHasMessages,
    translate: (key) => t(key),
    onStartNewConversation: startNewConversation,
  });

  const starterMention = starterRequest
    ? {
        kind: starterRequest.kind,
        hint: t.has(starterRequest.hintKey)
          ? t(starterRequest.hintKey)
          : t(`slash.hint.${starterRequest.kind ?? "tab"}`),
        pinCurrentTab: true,
      }
    : null;
  const targetRequest = slashMentionRequest ?? starterMention;
  const targetPickOpen = targetRequest !== null;

  const slashQuery = slashSession?.query ?? null;
  const slashCommands =
    slashQuery === null
      ? []
      : orderSlashCommands(filterSlashCommands(slashQuery, (key) => t(key)));
  const slashOpen =
    slashSession !== null &&
    slashSession.range.from !== dismissedSlashFrom &&
    slashCommands.length > 0 &&
    !confirmingClear;
  const mentionOpen =
    online &&
    !confirmingClear &&
    (targetPickOpen ||
      (mentionSession !== null &&
        mentionSession.range.from !== dismissedMentionFrom));

  const handleSlashSelect = (command: SlashCommand) => {
    const session = slashSession;
    setLauncherOpen(false);
    const result = runSlashCommand(command);
    if (result.type === "clear-confirm") {
      session?.insert([]);
      setConfirmingClear(true);
      return;
    }
    // Starting a new conversation empties the editor, trigger text included.
    if (result.type === "new-thread") return;
    insertContent(commandPillContent(command.id, command.name), session);
  };

  const handleMentionSelect = (chip: ContextChip) => {
    if (targetPickOpen) {
      attach(chip, null);
      completeTargetPick();
      setStarterRequest(null);
      return;
    }
    attach(chip, mentionSession);
  };

  const closeTargetPick = () => {
    clearSlashMentionRequest();
    setStarterRequest(null);
    focusEditor();
  };

  const handleMentionClose = () => {
    if (targetPickOpen) {
      closeTargetPick();
      return;
    }
    if (mentionSession) setDismissedMentionFrom(mentionSession.range.from);
  };

  const commandPrompt = (id: SlashCommand["id"]) => {
    const key = SLASH_COMMANDS.find((c) => c.id === id)?.promptKey;
    return key ? t(key) : undefined;
  };

  const handleSubmit = () => {
    if (!online || generating) return;
    const current = handleRef.current?.getSerialized();
    if (!current || !isSendable(current)) return;
    const store = createZustandStoreAccess();
    const outgoing = withDeletedPills(
      current,
      (chip) => !isStillAttached(store, chip),
    );
    // Staged before onSend so the attachments are exactly this message's pills.
    useRelayStore.getState().stageOutgoing(outgoing);
    onSend(
      toOutgoingText(outgoing, {
        promptFor: commandPrompt,
        deletedNote: (label) => t("composer.pill.stale", { name: label }),
      }),
    );
    handleRef.current?.clear();
  };

  const handleKeyDown = (event: KeyboardEvent): boolean => {
    if (slashOpen && menuRef.current?.handleKeyDown(event)) return true;
    if (mentionOpen && mentionKeyRef.current?.(event)) return true;
    if (event.key !== "ArrowUp" || doc.text !== "" || !lastUserText) {
      return false;
    }
    event.preventDefault();
    replaceContent(lastUserText);
    return true;
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
              onDismiss={() => {
                if (slashSession) {
                  setDismissedSlashFrom(slashSession.range.from);
                }
              }}
            />
          </div>
        ) : null}
        {mentionOpen ? (
          <div className="absolute inset-x-0 bottom-full z-10 mb-1">
            <MentionMenu
              query={targetPickOpen ? "" : (mentionSession?.query ?? "")}
              searchable={targetPickOpen}
              kind={targetPickOpen ? (targetRequest?.kind ?? null) : null}
              hint={targetPickOpen ? targetRequest?.hint : undefined}
              pinCurrentTab={
                targetPickOpen ? targetRequest?.pinCurrentTab : true
              }
              anchor="composer"
              keyHandlerRef={mentionKeyRef}
              onActiveChange={setMentionOptionId}
              onSelect={handleMentionSelect}
              onClose={handleMentionClose}
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
          <PromptEditor
            handleRef={handleRef}
            extensions={extensions}
            label={t("composerLabel")}
            placeholder={t("composerPlaceholder")}
            disabled={!online}
            activeDescendantId={mentionOpen ? mentionOptionId : null}
            onReady={handleReady}
            onChange={handleChange}
            onSend={handleSubmit}
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
            <div className="ml-auto flex items-center gap-1">
              <MicButton
                onInsertText={(text) =>
                  handleRef.current?.insertTextAtCaret(text)
                }
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
                  disabled={!generating && (!online || !hasContent)}
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
