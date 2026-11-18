import type { UIMessage } from "ai";
import {
  ATTACHMENT_DETAIL_OPEN,
  type AttachmentMeta,
  buildAttachmentDetail,
  readAttachmentMetadata,
} from "./attachments";
import type { RedactContext } from "./redact";
import { withoutSegments } from "./segments";
import type { StoreAccess } from "./storeAccess";
import { withoutTurnTiming } from "./timing";

type OutgoingContext = { store: StoreAccess; redact: RedactContext };

const isDetailPart = (part: UIMessage["parts"][number]): boolean =>
  part.type === "text" && part.text.startsWith(ATTACHMENT_DETAIL_OPEN);

/** An older user message keeps only its attachment list; detail is for the latest turn. */
function toHistoryMessage(message: UIMessage): UIMessage {
  if (message.role !== "user") return message;
  const attachments = readAttachmentMetadata(message.metadata);
  const { metadata: _metadata, ...rest } = message;
  return {
    ...rest,
    parts: message.parts.filter((part) => !isDetailPart(part)),
    ...(attachments.length > 0 ? { metadata: { attachments } } : {}),
  };
}

/** Pill layout is for the bubble only; the server gets the text and the attachment list. */
function withoutSegmentMetadata(message: UIMessage): UIMessage {
  if (message.role !== "user" || message.metadata === undefined) return message;
  return { ...message, metadata: withoutSegments(message.metadata) };
}

function latestUserIndex(messages: readonly UIMessage[]): number {
  return messages.findLastIndex((message) => message.role === "user");
}

/** Attachments of the turn in progress: the latest user message's, and only that. */
export function latestUserAttachments(
  messages: readonly UIMessage[],
): AttachmentMeta[] {
  const latest = latestUserIndex(messages);
  return latest < 0 ? [] : readAttachmentMetadata(messages[latest].metadata);
}

/**
 * The copy of the thread that goes to the server. Resolved attachment detail
 * is rebuilt from the latest user message's metadata on every request (tool
 * round-trips included) and is never stored or resent for older turns.
 */
export async function prepareOutgoingMessages(
  messages: readonly UIMessage[],
  context: OutgoingContext,
): Promise<UIMessage[]> {
  const latest = latestUserIndex(messages);
  // Timing is client-only and would count against the request size cap (CONV-01).
  const prepared = messages.map((message, index) =>
    withoutTurnTiming(
      index === latest
        ? withoutSegmentMetadata(message)
        : toHistoryMessage(message),
    ),
  );
  if (latest < 0) return prepared;
  const attachments = latestUserAttachments(messages);
  const detail = await buildAttachmentDetail(attachments, context);
  if (!detail) return prepared;
  prepared[latest] = {
    ...prepared[latest],
    parts: [
      ...messages[latest].parts.filter((part) => !isDetailPart(part)),
      { type: "text", text: detail },
    ],
  };
  return prepared;
}
