import type { ContextChip, ContextChipKind } from "./chips";
import type { RedactContext } from "./redact";
import type { StoreAccess } from "./storeAccess";
import { executeTool, relayToolRegistry } from "./tools/registry";
import { COLLECTION_DEPTH_MAX } from "./tools/schemas";
import { describeActiveContext, UNTRUSTED_NOTICE } from "./tools/workspaceRead";

/** Largest resolved detail block sent with one user message. */
export const RELAY_ATTACHMENT_DETAIL_MAX_CHARS = 32_000;

export const ATTACHMENT_DETAIL_OPEN = "<<<untrusted-attachment-detail>>>";
export const ATTACHMENT_DETAIL_CLOSE = "<<<end-untrusted-attachment-detail>>>";
export const ATTACHMENT_DETAIL_TRUNCATED_NOTE =
  "Detail truncated: only ids and names are listed for the items below. Ask the user for more or read them with the tools.";

const ATTACHMENT_KINDS: readonly ContextChipKind[] = [
  "tab",
  "request",
  "chain",
  "collection",
  "environment",
];

/** What a stored user message remembers about an attachment; the data itself is resolved per request. */
export type AttachmentMeta = {
  id: string;
  kind: ContextChipKind;
  label: string;
  method?: string;
};

export const noLongerExists = (label: string): string =>
  `${label} no longer exists`;

function methodFor(store: StoreAccess, chip: ContextChip): string | undefined {
  if (chip.kind === "request") {
    return store.requests().find((r) => r.id === chip.id)?.method;
  }
  if (chip.kind !== "tab") return undefined;
  const tab = store.activeTab();
  return tab?.tabId === chip.id && "method" in tab ? tab.method : undefined;
}

export function buildAttachmentMetadata(
  chips: readonly ContextChip[],
  store: StoreAccess,
): AttachmentMeta[] {
  return chips.map((chip) => {
    const method = methodFor(store, chip);
    return {
      id: chip.id,
      kind: chip.kind,
      label: chip.label,
      ...(method ? { method } : {}),
    };
  });
}

function isAttachmentMeta(value: unknown): value is AttachmentMeta {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.label === "string" &&
    ATTACHMENT_KINDS.includes(item.kind as ContextChipKind)
  );
}

/** Reads `metadata.attachments` defensively: threads restored from storage are untyped. */
export function readAttachmentMetadata(metadata: unknown): AttachmentMeta[] {
  const list = (metadata as { attachments?: unknown } | null | undefined)
    ?.attachments;
  return Array.isArray(list) ? list.filter(isAttachmentMeta) : [];
}

type DetailContext = { store: StoreAccess; redact: RedactContext };

type ToolCall = readonly [name: string, input: Record<string, unknown>];

const TOOL_BY_KIND: Record<string, (id: string) => ToolCall> = {
  request: (id) => ["get_request", { requestId: id }],
  collection: (id) => [
    "get_collection",
    { collectionId: id, depth: COLLECTION_DEPTH_MAX },
  ],
  environment: (id) => ["get_environment", { environmentId: id }],
  chain: (id) => ["get_chain", { chainId: id }],
};

async function readWithTool(
  kind: keyof typeof TOOL_BY_KIND,
  id: string,
  context: DetailContext,
) {
  const [name, input] = TOOL_BY_KIND[kind](id);
  return executeTool(relayToolRegistry, name, input, context);
}

async function resolveTab(
  attachment: AttachmentMeta,
  context: DetailContext,
): Promise<string> {
  const active = describeActiveContext(context.store, context.redact).activeTab;
  if (active?.tabId !== attachment.id) {
    return JSON.stringify({ tabId: attachment.id, name: attachment.label });
  }
  const saved = active.requestId
    ? await readWithTool("request", active.requestId, context)
    : null;
  return JSON.stringify({
    tab: active,
    ...(saved?.ok ? { request: saved.data } : {}),
  });
}

/** One attachment as the model should read it; a missing entity reads "<label> no longer exists". */
async function resolveAttachment(
  attachment: AttachmentMeta,
  context: DetailContext,
): Promise<string> {
  if (attachment.kind === "tab") return resolveTab(attachment, context);
  const outcome = await readWithTool(attachment.kind, attachment.id, context);
  return outcome.ok
    ? JSON.stringify(outcome.data)
    : noLongerExists(attachment.label);
}

const identityLine = (attachment: AttachmentMeta): string =>
  `- ${attachment.kind} ${attachment.id}: ${attachment.label}`;

function section(attachment: AttachmentMeta, detail: string): string {
  return `${identityLine(attachment)}\n${detail}`;
}

/**
 * The resolved data for this turn's attachments, fenced as untrusted. Items
 * are kept whole in attach order until the budget is spent; the rest degrade
 * to ids and names so the turn is never dropped.
 */
export async function buildAttachmentDetail(
  attachments: readonly AttachmentMeta[],
  context: DetailContext,
): Promise<string> {
  if (attachments.length === 0) return "";
  const resolved = await Promise.all(
    attachments.map((item) => resolveAttachment(item, context)),
  );
  const kept: string[] = [];
  const degraded: string[] = [];
  let used = 0;
  attachments.forEach((attachment, index) => {
    const text = section(attachment, resolved[index]);
    if (
      degraded.length === 0 &&
      used + text.length <= RELAY_ATTACHMENT_DETAIL_MAX_CHARS
    ) {
      kept.push(text);
      used += text.length;
      return;
    }
    degraded.push(identityLine(attachment));
  });
  const overflow =
    degraded.length > 0 ? [ATTACHMENT_DETAIL_TRUNCATED_NOTE, ...degraded] : [];
  return [
    ATTACHMENT_DETAIL_OPEN,
    UNTRUSTED_NOTICE,
    "The user attached these items to this message:",
    ...kept,
    ...overflow,
    ATTACHMENT_DETAIL_CLOSE,
  ].join("\n");
}
