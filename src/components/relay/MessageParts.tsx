"use client";

import type { UIMessage } from "ai";
import { memo } from "react";
import { isToolAwaiting, type ToolResolution } from "@/hooks/useRelayChat";
import { askStateFromPart } from "@/lib/relay/askUserState";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import {
  previewConfirmation,
  relayToolRegistry,
} from "@/lib/relay/tools/registry";
import {
  RELAY_TOOL_SCHEMAS,
  USER_DECLINED_ERROR,
} from "@/lib/relay/tools/schemas";
import { isCloseTabsTool, previewCloseTabs } from "@/lib/relay/tools/tabs";
import { AskUserCard } from "./AskUserCard";
import { ChangeCard, readChangeOutput } from "./ChangeCard";
import { CloseTabsConfirmCard } from "./CloseTabsConfirmCard";
import { ConfirmCard, DeclinedNote } from "./ConfirmCard";
import { RelayMarkdown } from "./RelayMarkdown";
import { isToolPart, ToolRow, type ToolRowPart } from "./ToolRow";
import { TurnChangeBar } from "./TurnChangeBar";

type ResolveTool = (toolCallId: string, resolution: ToolResolution) => void;
type MessagePart = UIMessage["parts"][number];

/** The tool call id, or undefined for parts that carry none. */
function callIdOf(part: ToolRowPart): string | undefined {
  return "toolCallId" in part ? String(part.toolCallId) : undefined;
}

const TOOL_PART_PREFIX = "tool-";

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
function promptCard(part: ToolRowPart, callId: string, onResolve: ResolveTool) {
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
        settled={askStateFromPart(pending, part.output)}
        onChoose={(picked) =>
          onResolve(callId, { kind: "answer", choice: picked })
        }
      />
    );
  }
  if (
    part.state !== "input-available" ||
    !isToolAwaiting(callId, name, part.input)
  ) {
    return null;
  }
  if (isCloseTabsTool(name)) {
    return (
      <CloseTabsConfirmCard
        preview={previewCloseTabs(name, part.input as object)}
        onChoose={(choice) => onResolve(callId, { kind: "answer", choice })}
        onCancel={() => onResolve(callId, { kind: "decline" })}
      />
    );
  }
  const preview = previewConfirmation(
    relayToolRegistry,
    name,
    part.input,
    createZustandStoreAccess(),
  );
  if (!preview) return null;
  if (preview.dirtyTabs?.length) {
    // FR-133: a delete that drops unsaved tabs asks the FR-131 question first.
    return (
      <CloseTabsConfirmCard
        preview={{ dirty: preview.dirtyTabs, pinnedKept: 0, deleting: true }}
        onChoose={(choice) =>
          onResolve(callId, { kind: "answer", choice, approve: true })
        }
        onCancel={() => onResolve(callId, { kind: "decline" })}
      />
    );
  }
  return (
    <ConfirmCard
      preview={preview}
      onApprove={() => onResolve(callId, { kind: "approve" })}
      onDecline={() => onResolve(callId, { kind: "decline" })}
    />
  );
}

/** One tool part as its prompt card, Change Card or plain row. */
function ToolPart({
  part,
  onResolve,
}: {
  part: ToolRowPart;
  onResolve: ResolveTool;
}) {
  const callId = callIdOf(part) ?? "";
  const prompt = promptCard(part, callId, onResolve);
  if (prompt) return <div data-testid="relay-prompt-card">{prompt}</div>;
  const change = readChangeOutput(part);
  if (!change) return <ToolRow part={part} />;
  return <ChangeCard change={change} />;
}

type PartBlock =
  | { kind: "text"; text: string; key: string }
  | {
      kind: "tools";
      parts: { part: ToolRowPart; index: number }[];
      key: string;
    };

/** Groups parts in stream order: one block per text part, one per run of tool parts. */
function toBlocks(parts: readonly MessagePart[]): PartBlock[] {
  const blocks: PartBlock[] = [];
  parts.forEach((part, index) => {
    if (part.type === "text") {
      if (part.text)
        blocks.push({ kind: "text", text: part.text, key: `t${index}` });
      return;
    }
    if (!isToolPart(part)) return;
    const last = blocks.at(-1);
    if (last?.kind === "tools") {
      last.parts.push({ part, index });
      return;
    }
    blocks.push({ kind: "tools", parts: [{ part, index }], key: `g${index}` });
  });
  return blocks;
}

function changeIdsOf(parts: readonly MessagePart[]): string[] {
  return parts
    .filter(isToolPart)
    .flatMap((part) => readChangeOutput(part)?.changeId ?? []);
}

type MessagePartsProps = {
  message: UIMessage;
  turnId: string;
  /** False while this message is still being generated. */
  settled: boolean;
  onResolveTool: ResolveTool;
};

/**
 * An assistant message in stream order: each text part, run of tool calls and
 * prompt card sits where its part does, so a card never jumps above the text
 * that introduced it. Keys are part indexes, which never shift while streaming.
 */
export const MessageParts = memo(function MessageParts({
  message,
  turnId,
  settled,
  onResolveTool,
}: MessagePartsProps) {
  const changeIds = changeIdsOf(message.parts);
  return (
    <>
      {toBlocks(message.parts).map((block) =>
        block.kind === "text" ? (
          <RelayMarkdown key={block.key} text={block.text} />
        ) : (
          <div
            key={block.key}
            data-testid="relay-tool-group"
            className="flex min-w-0 flex-col gap-2"
          >
            {block.parts.map(({ part, index }) => (
              <ToolPart
                // The part index only breaks ties for calls without an id.
                key={callIdOf(part) ?? index}
                part={part}
                onResolve={onResolveTool}
              />
            ))}
          </div>
        ),
      )}
      {changeIds.length > 0 ? (
        <TurnChangeBar
          turnId={turnId}
          changeIds={changeIds}
          settled={settled}
        />
      ) : null}
    </>
  );
});
