"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import {
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageActions as MessageActionsRow,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  countStepsSinceLastUser,
  type RelayChatStatus,
  type ToolResolution,
} from "@/hooks/useRelayChat";
import { deriveActivity } from "@/lib/relay/activity";
import {
  RELAY_MAX_STEPS,
  RELAY_VIRTUALIZE_THRESHOLD,
} from "@/lib/relay/constants";
import { deriveFollowUps } from "@/lib/relay/followUps";
import { messageText } from "@/lib/relay/messageText";
import { useRelayStore } from "@/stores/useRelayStore";
import { UserMessageBody } from "./AttachmentPillRow";
import { EmptyState } from "./EmptyState";
import { FollowUpChips } from "./FollowUpChips";
import { MessageActions } from "./MessageActions";
import { MessageParts } from "./MessageParts";
import { RelayActivityIndicator } from "./RelayActivityIndicator";
import { UserMessageActions } from "./UserMessageActions";

type RelayConversationProps = {
  messages: UIMessage[];
  status: RelayChatStatus;
  /** Assistant message cut short by an error or lost connection. */
  interruptedMessageId: string | null;
  onRegenerate: () => void;
  /** Replaces the user message `messageId` and everything after it with `text`. */
  onEditResend: (messageId: string, text: string) => void;
  /** Sends a follow-up chip's prompt as a new message. */
  onSendPrompt: (prompt: string) => void;
  /** Answers a Confirmation or question card. */
  onResolveTool: (toolCallId: string, resolution: ToolResolution) => void;
  "aria-label": string;
};

/** First-paint height guess for an unmeasured row; real heights replace it. */
const RELAY_ESTIMATED_MESSAGE_PX = 96;
const RELAY_VIRTUAL_OVERSCAN = 6;
/**
 * Opaque in light and dark (the outline variant is translucent in dark mode)
 * and above messages, so scrolled text never shows through the pill.
 */
const JUMP_PILL_CLASS =
  "z-20 border-border bg-popover shadow-lg hover:bg-muted dark:bg-popover dark:hover:bg-muted";
/** Gutter so the pill never covers the last message. */
const MESSAGE_LIST_BOTTOM_GUTTER_CLASS = "pb-14";

/** True once the step cap, not the model, ended the turn (CONV-06). */
function hitStepLimit(messages: UIMessage[]): boolean {
  return (
    lastAssistantMessageIsCompleteWithToolCalls({ messages }) &&
    countStepsSinceLastUser(messages) >= RELAY_MAX_STEPS
  );
}

function StreamingCaret() {
  return (
    <span
      aria-hidden
      data-testid="relay-caret"
      className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground align-text-bottom motion-reduce:animate-none"
    />
  );
}

type MessageItemProps = {
  message: UIMessage;
  turnId: string;
  isLast: boolean;
  isLastUser: boolean;
  status: RelayChatStatus;
  interrupted: boolean;
  onRegenerate: () => void;
  onEditResend: RelayConversationProps["onEditResend"];
  onResolveTool: RelayConversationProps["onResolveTool"];
};

function MessageItem({
  message,
  turnId,
  isLast,
  isLastUser,
  status,
  interrupted,
  onRegenerate,
  onEditResend,
  onResolveTool,
}: MessageItemProps) {
  const t = useTranslations("relay");
  const generating = status === "submitted" || status === "streaming";
  const isAssistant = message.role === "assistant";
  const streaming = isAssistant && isLast && status === "streaming";
  const text = messageText(message);
  const settled = !(isLast && generating);
  const showAnswerActions = isAssistant && settled && text.length > 0;
  const showEdit = isLastUser && !generating && text.length > 0;
  return (
    <Message
      from={isAssistant ? "assistant" : "user"}
      data-testid={`relay-message-${message.role}`}
    >
      <MessageContent>
        {isAssistant ? (
          <MessageParts
            message={message}
            turnId={turnId}
            settled={settled}
            onResolveTool={onResolveTool}
          />
        ) : (
          <UserMessageBody text={text} metadata={message.metadata} />
        )}
        {streaming ? <StreamingCaret /> : null}
        {interrupted ? (
          <p className="text-xs text-muted-foreground">{t("interrupted")}</p>
        ) : null}
      </MessageContent>
      {showAnswerActions ? (
        <MessageActions
          markdown={text}
          onRegenerate={isLast ? onRegenerate : undefined}
        />
      ) : null}
      {showEdit ? (
        <MessageActionsRow>
          <UserMessageActions
            text={text}
            onResend={(edited) => onEditResend(message.id, edited)}
          />
        </MessageActionsRow>
      ) : null}
    </Message>
  );
}

/** Id of the user message that opened each message's turn, in one pass. */
function turnIdsFor(messages: UIMessage[]): string[] {
  let current = "";
  return messages.map((message) => {
    if (message.role === "user") current = message.id;
    return current || message.id;
  });
}

type VirtualMessageListProps = {
  messages: UIMessage[];
  renderItem: (index: number) => ReactNode;
};

/** Windowed message list for long threads; heights are measured as rows render. */
function VirtualMessageList({ messages, renderItem }: VirtualMessageListProps) {
  const { scrollRef } = useStickToBottomContext();
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => RELAY_ESTIMATED_MESSAGE_PX,
    getItemKey: (index) => messages[index].id,
    overscan: RELAY_VIRTUAL_OVERSCAN,
  });
  return (
    <div
      data-testid="relay-virtual-messages"
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((item) => (
        <div
          key={item.key}
          data-index={item.index}
          ref={virtualizer.measureElement}
          className="absolute top-0 left-0 w-full pb-4"
          style={{ transform: `translateY(${item.start}px)` }}
        >
          {renderItem(item.index)}
        </div>
      ))}
    </div>
  );
}

export function RelayConversation({
  messages,
  status,
  interruptedMessageId,
  onRegenerate,
  onEditResend,
  onSendPrompt,
  onResolveTool,
  "aria-label": ariaLabel,
}: RelayConversationProps) {
  const t = useTranslations("relay");
  const lastId = messages.at(-1)?.id;
  const lastUserId = messages.findLast((m) => m.role === "user")?.id;
  const generating = status === "submitted" || status === "streaming";
  const turnIds = turnIdsFor(messages);
  const activity = deriveActivity(messages, status);
  // Set for the whole turn, including while a card waits and the chat reads "ready".
  const turnInFlight = useRelayStore((s) => s.liveTurn !== null);
  const followUps = generating ? [] : deriveFollowUps(messages);

  const renderItem = (index: number) => {
    const message = messages[index];
    return (
      <MessageItem
        key={message.id}
        message={message}
        turnId={turnIds[index]}
        isLast={message.id === lastId}
        isLastUser={message.id === lastUserId}
        status={status}
        interrupted={message.id === interruptedMessageId}
        onRegenerate={onRegenerate}
        onEditResend={onEditResend}
        onResolveTool={onResolveTool}
      />
    );
  };

  return (
    <>
      {/* Separate from the log so streamed tokens are not re-read; only the state change is announced. */}
      <p role="status" className="sr-only" data-testid="relay-announcer">
        {generating ? t("typing") : ""}
      </p>
      <Conversation
        aria-live="polite"
        aria-label={ariaLabel}
        data-testid="relay-messages"
      >
        <ConversationContent className={MESSAGE_LIST_BOTTOM_GUTTER_CLASS}>
          {messages.length === 0 ? <EmptyState /> : null}
          {messages.length > RELAY_VIRTUALIZE_THRESHOLD ? (
            <VirtualMessageList messages={messages} renderItem={renderItem} />
          ) : (
            messages.map((_, index) => renderItem(index))
          )}
          {!generating && !turnInFlight && hitStepLimit(messages) ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid="relay-step-limit"
            >
              {t("turn.stepLimit")}
            </p>
          ) : null}
          <FollowUpChips keys={followUps} onSelect={onSendPrompt} />
          {turnInFlight || activity ? (
            <RelayActivityIndicator activity={activity} />
          ) : null}
        </ConversationContent>
        <ConversationScrollButton
          label={t("jumpToLatest")}
          className={JUMP_PILL_CLASS}
          data-testid="relay-jump-latest"
        />
      </Conversation>
    </>
  );
}
