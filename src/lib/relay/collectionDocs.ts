import type { CollectionSummary } from "./collectionSummary";
import {
  DEFAULT_REDACT_CONTEXT,
  type RedactContext,
  redactUrl,
} from "./redact";

/**
 * Markdown documentation for a collection (FR-194). It is rendered only from
 * the capped `summarizeCollection` output (FR-127) and every URL is redacted,
 * so the text is safe to show and to copy.
 */

export type DocsOptions = { title?: string; redact?: RedactContext };

export function buildCollectionDocs(
  summary: CollectionSummary,
  { title = "Collection", redact = DEFAULT_REDACT_CONTEXT }: DocsOptions = {},
): string {
  const lines = [
    `# ${title}`,
    "",
    `${summary.total} request${summary.total === 1 ? "" : "s"}`,
    "",
    ...summary.items.map(
      (item) =>
        `- **${item.method}** ${item.name}: \`${redactUrl(item.url, redact)}\``,
    ),
  ];
  if (summary.more) lines.push("", summary.more);
  return lines.join("\n");
}
