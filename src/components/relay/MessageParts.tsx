"use client";

import type { UIMessage } from "ai";
import { memo } from "react";
import { isToolAwaiting, type ToolResolution } from "@/hooks/useRelayChat";
import { askStateFromPart } from "@/lib/relay/askUserState";
import { summariseSteps } from "@/lib/relay/stepSummary";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import {
  readTurnTiming,
  resolveTurnLabel,
  type TurnTiming,
} from "@/lib/relay/timing";
import {
  previewConfirmation,
  relayToolRegistry,
} from "@/lib/relay/tools/registry";
import {
  RELAY_TOOL_SCHEMAS,
  USER_DECLINED_ERROR,
} from "@/lib/relay/tools/schemas";
import { isCloseTabsTool, previewCloseTabs } from "@/lib/relay/tools/tabs";
import { useRelayStore } from "@/stores/useRelayStore";
import { AskUserCard } from "./AskUserCard";
import { ChangeCard, readChangeOutput } from "./ChangeCard";
import { CloseTabsConfirmCard } from "./CloseTabsConfirmCard";
import { ConfirmCard, DeclinedNote } from "./ConfirmCard";
import { ExportBackupConfirm } from "./ExportBackupConfirm";
import { ImportBackupConfirm } from "./ImportBackupConfirm";
import { RelayMarkdown } from "./RelayMarkdown";
import { isToolPart, ToolRow, type ToolRowPart } from "./ToolRow";
import { TurnChangeBar } from "./TurnChangeBar";
import {
  MIN_STEP_SECONDS_SHOWN,
  ReadsLine,
  ThoughtLine,
  WorkedGroup,
} from "./WorkedGroup";

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
  const onApprove = () => onResolve(callId, { kind: "approve" });
  const onDecline = () => onResolve(callId, { kind: "decline" });
  if (name === "export_backup") {
    const parsed = RELAY_TOOL_SCHEMAS.export_backup.inputSchema.safeParse(
      part.input,
    );
    if (parsed.success) {
      return (
        <ExportBackupConfirm
          preview={preview}
          input={parsed.data}
          onApprove={onApprove}
          onDecline={onDecline}
        />
      );
    }
  }
  if (name === "import_backup") {
    return (
      <ImportBackupConfirm
        preview={preview}
        toolCallId={callId}
        onApprove={onApprove}
        onDecline={onDecline}
      />
    );
  }
  return (
    <ConfirmCard
      preview={preview}
      onApprove={onApprove}
      onDecline={onDecline}
    />
  );
}

/** One tool part as its prompt card, Change Card or plain row. */
function ToolPart({
  part,
  onResolve,
  seconds,
}: {
  part: ToolRowPart;
  onResolve: ResolveTool;
  seconds?: number;
}) {
  const callId = callIdOf(part) ?? "";
  const prompt = promptCard(part, callId, onResolve);
  if (prompt) return <div data-testid="relay-prompt-card">{prompt}</div>;
  const change = readChangeOutput(part);
  if (!change) return <ToolRow part={part} seconds={seconds} />;
  return <ChangeCard change={change} />;
}

type ToolPartEntry = { part: ToolRowPart; index: number };

type PartBlock =
  | { kind: "text"; text: string; key: string }
  | { kind: "thought"; key: string; stepId: string }
  | { kind: "tools"; parts: ToolPartEntry[]; key: string };

/** Groups parts in stream order: one block per text part, one per run of tool parts. */
function toBlocks(parts: readonly MessagePart[]): PartBlock[] {
  const blocks: PartBlock[] = [];
  parts.forEach((part, index) => {
    if (part.type === "text") {
      if (part.text)
        blocks.push({ kind: "text", text: part.text, key: `t${index}` });
      return;
    }
    if (part.type === "reasoning") {
      blocks.push({ kind: "thought", key: `r${index}`, stepId: `p${index}` });
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

const toolStepId = (part: ToolRowPart): string => `t:${callIdOf(part)}`;

/** Whole seconds each finished step took, by step id. */
function stepSecondsOf(turn: TurnTiming | undefined): Map<string, number> {
  const seconds = new Map<string, number>();
  for (const step of turn?.steps ?? []) {
    if (step.endedAt === undefined) continue;
    seconds.set(step.id, Math.floor((step.endedAt - step.startedAt) / 1000));
  }
  return seconds;
}

/** The duration worth showing: always for a thought, else only from a second up. */
const shownSeconds = (seconds: number | undefined): number | undefined =>
  seconds !== undefined && seconds >= MIN_STEP_SECONDS_SHOWN
    ? seconds
    : undefined;

/** A failed call stays its own line so the failure is never folded into a count. */
const isFailedCall = (part: ToolRowPart): boolean =>
  part.state === "output-error" || outputOf(part).ok === false;

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

function hasPendingCard(parts: readonly MessagePart[]): boolean {
  return parts.filter(isToolPart).some((part) => {
    const name = part.type.slice(TOOL_PART_PREFIX.length);
    return (
      part.state === "input-available" &&
      isToolAwaiting(callIdOf(part) ?? "", name, part.input)
    );
  });
}

type BlocksProps = {
  blocks: PartBlock[];
  seconds: Map<string, number>;
  onResolve: ResolveTool;
};

/** The blocks as the live stream shows them: each text, run of tool calls and card where its part is. */
function LiveBlocks({ blocks, seconds, onResolve }: BlocksProps) {
  return blocks.map((block) => {
    if (block.kind === "thought") return null;
    if (block.kind === "text") {
      return <RelayMarkdown key={block.key} text={block.text} />;
    }
    return (
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
            onResolve={onResolve}
            seconds={shownSeconds(seconds.get(toolStepId(part)))}
          />
        ))}
      </div>
    );
  });
}

/** The blocks inside an expanded group: consecutive reads collapse into one line (CONV-04). */
function GroupBlocks({ blocks, seconds, onResolve }: BlocksProps) {
  return blocks.map((block) => {
    if (block.kind === "text") {
      return <RelayMarkdown key={block.key} text={block.text} />;
    }
    if (block.kind === "thought") {
      const took = seconds.get(block.stepId);
      return took === undefined ? null : (
        <ThoughtLine key={block.key} seconds={took} />
      );
    }
    const lines = summariseSteps(
      block.parts.map((entry) => ({
        id: toolStepId(entry.part),
        toolName: isFailedCall(entry.part)
          ? undefined
          : entry.part.type.slice(TOOL_PART_PREFIX.length),
        entry,
      })),
    );
    return (
      <div
        key={block.key}
        data-testid="relay-tool-group"
        className="flex min-w-0 flex-col gap-2"
      >
        {lines.map((line) => {
          if (line.kind === "step") {
            const { entry } = line.step;
            return (
              <ToolPart
                key={callIdOf(entry.part) ?? entry.index}
                part={entry.part}
                onResolve={onResolve}
                seconds={shownSeconds(seconds.get(line.step.id))}
              />
            );
          }
          const total = line.steps.reduce(
            (sum, step) => sum + (seconds.get(step.id) ?? 0),
            0,
          );
          return (
            <ReadsLine
              key={line.steps[0].id}
              segments={line.segments}
              seconds={shownSeconds(total)}
            />
          );
        })}
      </div>
    );
  });
}

/**
 * An assistant message. While its turn runs, each text part, run of tool
 * calls and prompt card sits where its part does, so a card never jumps above
 * the text that introduced it. Once the turn is over, every step folds into one
 * "Worked for" row and only the final answer stays visible (CONV-03). Keys are
 * part indexes, which never shift while streaming.
 */
export const MessageParts = memo(function MessageParts({
  message,
  turnId,
  settled,
  onResolveTool,
}: MessagePartsProps) {
  const live = useRelayStore((s) => s.liveTurn?.messageId === message.id);
  const changeIds = changeIdsOf(message.parts);
  const blocks = toBlocks(message.parts);
  const turn = readTurnTiming(message.metadata);
  const seconds = stepSecondsOf(turn);
  const lastBlock = blocks.at(-1);
  const answer = lastBlock?.kind === "text" ? lastBlock : null;
  const steps = answer ? blocks.slice(0, -1) : blocks;
  const folded =
    settled &&
    !live &&
    !hasPendingCard(message.parts) &&
    steps.some((block) => block.kind === "tools");
  const changeBar =
    changeIds.length > 0 ? (
      <TurnChangeBar turnId={turnId} changeIds={changeIds} settled={settled} />
    ) : null;

  if (!folded) {
    return (
      <>
        <LiveBlocks
          blocks={blocks}
          seconds={seconds}
          onResolve={onResolveTool}
        />
        {changeBar}
      </>
    );
  }
  return (
    <>
      <WorkedGroup label={resolveTurnLabel(turn)}>
        <GroupBlocks
          blocks={steps}
          seconds={seconds}
          onResolve={onResolveTool}
        />
      </WorkedGroup>
      {answer ? <RelayMarkdown text={answer.text} /> : null}
      {changeBar}
    </>
  );
});
