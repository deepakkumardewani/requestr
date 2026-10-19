import type { UIMessage } from "ai";

/** Text from separate model steps must never touch: a blank line keeps paragraphs apart. */
export const TEXT_PART_SEPARATOR = "\n\n";

type MessagePart = UIMessage["parts"][number];

/** Joins the text parts of a message, skipping empty ones and every non-text part. */
export function joinTextParts(parts: readonly MessagePart[]): string {
  return parts
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join(TEXT_PART_SEPARATOR);
}

export function messageText(message: UIMessage): string {
  return joinTextParts(message.parts);
}
