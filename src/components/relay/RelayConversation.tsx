"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import type { UIMessage } from "ai";
import { RefreshCwIcon } from "lucide-react";
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
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ai-elements/message";
import type { RelayChatStatus, ToolResolution } from "@/hooks/useRelayChat";
import {
  RELAY_MAX_STEPS,
  RELAY_STEP_INDICATOR_AFTER,
  RELAY_VIRTUALIZE_THRESHOLD,
} from "@/lib/relay/constants";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import {
  previewConfirmation,
  relayToolRegistry,
} from "@/lib/relay/tools/registry";
import {
  awaitsUser,
  RELAY_TOOL_SCHEMAS,
  USER_DECLINED_ERROR,
} from "@/lib/relay/tools/schemas";
import { AskUserCard } from "./AskUserCard";
import { ChangeCard, readChangeOutput } from "./ChangeCard";
import { ConfirmCard, DeclinedNote } from "./ConfirmCard";
import { ContextChips } from "./ContextChips";
import { EmptyState } from "./EmptyState";
import { RelayMarkdown } from "./RelayMarkdown";
import { isToolPart, ToolRow, type ToolRowPart } from "./ToolRow";
import { TurnChangeBar } from "./TurnChangeBar";

type RelayConversationProps = {
  messages: UIMessage[];
  status: RelayChatStatus;
  /** Assistant message cut short by an error or lost connection. */
  interruptedMessageId: string | null;
  onRegenerate: () => void;
  /** Answers a Confirmation or question card. */
  onResolveTool: (toolCallId: string, resolution: ToolResolution) => void;
  "aria-label": string;
};

const TOOL_PART_PREFIX = "tool-";
const STEP_START_PART = "step-start";
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

/** Model steps taken since the last user message, matching the server's cap. */
function stepsInCurrentTurn(messages: UIMessage[]): number {
  const lastUser = messages.findLastIndex((m) => m.role === "user");
  return messages
    .slice(lastUser + 1)
    .flatMap((m) => m.parts)
    .filter((part) => part.type === STEP_START_PART).length;
}

function messageText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

type ToolOutput = {
  ok?: unknown;
  error?: unknown;
  autoDeclined?: unknown;
  data?: unknown;
};

function outputOf(part: ToolRowPart): ToolOutput {
  return part.state === "output-available" && part.output
    ? (part.output as ToolOutput)
    : {};
}

/**
 * The card for a call that waits on, or was answered by, the user; null for
 * every other tool, which renders as a row or a Change Card.
 */
function promptCard(
  part: ToolRowPart,
  callId: string,
  onResolve: RelayConversationProps["onResolveTool"],
) {
  const name = part.type.slice(TOOL_PART_PREFIX.length);
  const output = outputOf(part);
  if (output.ok === false && output.error === USER_DECLINED_ERROR) {
    return <DeclinedNote automatic={output.autoDeclined === true} />;
  }
  if (name === "ask_user") {
    const ask = RELAY_TOOL_SCHEMAS.ask_user.inputSchema.safeParse(part.input);
    if (!ask.success) return null;
    const choice = (output.data as { choice?: unknown } | undefined)?.choice;
    const pending = part.state === "input-available";
    if (!pending && typeof choice !== "string") return null;
    return (
      <AskUserCard
        question={ask.data.question}
        options={ask.data.options}
        choice={typeof choice === "string" ? choice : undefined}
        onChoose={(picked) =>
          onResolve(callId, { kind: "answer", choice: picked })
        }
      />
    );
  }
  if (part.state !== "input-available" || !awaitsUser(name, part.input)) {
    return null;
  }
  const preview = previewConfirmation(
    relayToolRegistry,
    name,
    part.input,
    createZustandStoreAccess(),
  );
  if (!preview) return null;
  return (
    <ConfirmCard
      preview={preview}
      onApprove={() => onResolve(callId, { kind: "approve" })}
      onDecline={() => onResolve(callId, { kind: "decline" })}
    />
  );
}

/** Tool rows, with a Change Card in place of the row once a write has been applied. */
function toolParts(
  message: UIMessage,
  turnId: string,
  settled: boolean,
  onResolve: RelayConversationProps["onResolveTool"],
) {
  const changeIds: string[] = [];
  const rows = message.parts.filter(isToolPart).map((part, index) => {
    // Tool parts carry a call id; the index only breaks ties for malformed ones.
    const callId = "toolCallId" in part ? String(part.toolCallId) : "";
    const key = callId || index;
    const prompt = promptCard(part, callId, onResolve);
    if (prompt) return <div key={key}>{prompt}</div>;
    const change = readChangeOutput(part);
    if (!change) return <ToolRow key={key} part={part} />;
    changeIds.push(change.changeId);
    return <ChangeCard key={key} change={change} />;
  });
  return (
    <>
      {rows}
      {changeIds.length > 0 ? (
        <TurnChangeBar
          turnId={turnId}
          changeIds={changeIds}
          settled={settled}
        />
      ) : null}
    </>
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
  status: RelayChatStatus;
  interrupted: boolean;
  onRegenerate: () => void;
  onResolveTool: RelayConversationProps["onResolveTool"];
};

function MessageItem({
  message,
  turnId,
  isLast,
  status,
  interrupted,
  onRegenerate,
  onResolveTool,
}: MessageItemProps) {
  const t = useTranslations("relay");
  const generating = status === "submitted" || status === "streaming";
  const isAssistant = message.role === "assistant";
  const streaming = isAssistant && isLast && status === "streaming";
  const canRegenerate = isAssistant && isLast && !generating;
  return (
    <Message
      from={isAssistant ? "assistant" : "user"}
      data-testid={`relay-message-${message.role}`}
    >
      <MessageContent>
        {isAssistant
          ? toolParts(message, turnId, !(isLast && generating), onResolveTool)
          : null}
        {isAssistant ? (
          <RelayMarkdown text={messageText(message)} />
        ) : (
          <p className="whitespace-pre-wrap break-words">
            {messageText(message)}
          </p>
        )}
        {streaming ? <StreamingCaret /> : null}
        {interrupted ? (
          <p className="text-xs text-muted-foreground">{t("interrupted")}</p>
        ) : null}
      </MessageContent>
      {canRegenerate ? (
        <MessageActions>
          <MessageAction
            label={t("regenerate")}
            data-testid="relay-regenerate"
            onClick={onRegenerate}
          >
            <RefreshCwIcon aria-hidden />
          </MessageAction>
        </MessageActions>
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
  onResolveTool,
  "aria-label": ariaLabel,
}: RelayConversationProps) {
  const t = useTranslations("relay");
  const lastId = messages.at(-1)?.id;
  const generating = status === "submitted" || status === "streaming";
  const step = Math.min(stepsInCurrentTurn(messages), RELAY_MAX_STEPS);
  const turnIds = turnIdsFor(messages);

  const renderItem = (index: number) => {
    const message = messages[index];
    return (
      <MessageItem
        key={message.id}
        message={message}
        turnId={turnIds[index]}
        isLast={message.id === lastId}
        status={status}
        interrupted={message.id === interruptedMessageId}
        onRegenerate={onRegenerate}
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
          {step > RELAY_STEP_INDICATOR_AFTER ? (
            <p
              className="text-xs text-muted-foreground"
              data-testid="relay-step-indicator"
            >
              {t("step", { current: step, max: RELAY_MAX_STEPS })}
            </p>
          ) : null}
          {status === "submitted" ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="relay-pending"
            >
              {t("responding")}
              <StreamingCaret />
            </p>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton
          label={t("jumpToLatest")}
          className={JUMP_PILL_CLASS}
          data-testid="relay-jump-latest"
        />
      </Conversation>
      <ContextChips />
    </>
  );
}
