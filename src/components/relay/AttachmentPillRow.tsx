"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  type AttachmentMeta,
  readAttachmentMetadata,
} from "@/lib/relay/attachments";
import type { ResolvedEntity } from "@/lib/relay/entityLinks";
import { redactValue } from "@/lib/relay/redact";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import { isStillAttached } from "@/lib/relay/tools/workspaceRead";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { EntityPill, EntityPillStatic } from "./EntityPill";

const DEFAULT_TAB_METHOD = "GET";

/** A tab has no workspace page of its own, so it is shown as the request it holds. */
function toEntity(attachment: AttachmentMeta): ResolvedEntity {
  const name = redactValue(attachment.label);
  if (attachment.kind === "request" || attachment.kind === "tab") {
    return {
      kind: "request",
      id: attachment.id,
      name,
      method: attachment.method ?? DEFAULT_TAB_METHOD,
    };
  }
  return { kind: attachment.kind, id: attachment.id, name };
}

type PillState = { attachment: AttachmentMeta; deleted: boolean };

/** Each attachment with whether its entity still exists; a tab keeps its pill like the composer's. */
function useAttachmentStates(
  attachments: readonly AttachmentMeta[],
): PillState[] {
  // Subscribed only so the memo recomputes when an attached entity is deleted.
  const collections = useCollectionsStore((s) => s.collections);
  const requests = useCollectionsStore((s) => s.requests);
  const environments = useEnvironmentsStore((s) => s.environments);
  const chains = useChainStore((s) => s.chains);

  return useMemo(() => {
    const store = createZustandStoreAccess();
    return attachments.map((attachment) => ({
      attachment,
      deleted: !isStillAttached(store, attachment),
    }));
  }, [attachments, collections, requests, environments, chains]);
}

function DeletedPill({ attachment }: { attachment: AttachmentMeta }) {
  const t = useTranslations("relay");
  const message = t("composer.pill.stale", {
    name: redactValue(attachment.label),
  });
  return (
    <span
      title={message}
      role="img"
      aria-label={message}
      data-testid="relay-attachment-pill-deleted"
      className="inline-flex max-w-full opacity-60 grayscale"
    >
      <EntityPillStatic entity={toEntity(attachment)} />
    </span>
  );
}

function LivePill({ attachment }: { attachment: AttachmentMeta }) {
  const entity = toEntity(attachment);
  // A tab id is not an entity id, so a tab pill cannot navigate.
  return attachment.kind === "tab" ? (
    <EntityPillStatic entity={entity} />
  ) : (
    <EntityPill entity={entity} />
  );
}

/** What the user attached to a sent message, shown under its text (BUG-01). */
export function AttachmentPillRow({ metadata }: { metadata: unknown }) {
  const t = useTranslations("relay");
  const attachments = useMemo(
    () => readAttachmentMetadata(metadata),
    [metadata],
  );
  const states = useAttachmentStates(attachments);
  if (states.length === 0) return null;
  return (
    <ul
      aria-label={t("context.label")}
      data-testid="relay-attachment-pills"
      className="mt-1 flex min-w-0 flex-wrap gap-1.5"
    >
      {states.map(({ attachment, deleted }) => (
        <li key={`${attachment.kind}:${attachment.id}`} className="min-w-0">
          {deleted ? (
            <DeletedPill attachment={attachment} />
          ) : (
            <LivePill attachment={attachment} />
          )}
        </li>
      ))}
    </ul>
  );
}
