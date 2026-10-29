"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { buildAttachmentMetadata } from "@/lib/relay/attachments";
import { type ContextChip, chipKey } from "@/lib/relay/chips";
import type { ResolvedEntity } from "@/lib/relay/entityLinks";
import { redactValue } from "@/lib/relay/redact";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import { isStillAttached } from "@/lib/relay/tools/workspaceRead";
import { cn } from "@/lib/utils";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { EntityPillStatic } from "./EntityPill";
import { ATTACHMENT_PILL_NODE } from "./editorTypes";

const DEFAULT_TAB_METHOD = "GET";

const KIND_LABEL_KEYS = {
  tab: "context.kindTab",
  request: "context.kindRequest",
  chain: "context.kindChain",
  collection: "context.kindCollection",
  environment: "context.kindEnvironment",
} as const satisfies Record<ContextChip["kind"], string>;

/** A tab has no workspace page of its own, so it is shown as the request it holds. */
function toEntity(
  chip: ContextChip,
  method: string | undefined,
): ResolvedEntity {
  const name = redactValue(chip.label);
  if (chip.kind === "request" || chip.kind === "tab") {
    return {
      kind: "request",
      id: chip.id,
      name,
      method: method ?? DEFAULT_TAB_METHOD,
    };
  }
  return { kind: chip.kind, id: chip.id, name };
}

type PillState = { deleted: boolean; method: string | undefined };

/** Whether the entity still exists and, for a request, its method; recomputed as the workspace changes. */
function usePillState(chip: ContextChip): PillState {
  // Subscribed only so the memo recomputes when the attached entity changes or is deleted.
  const collections = useCollectionsStore((s) => s.collections);
  const requests = useCollectionsStore((s) => s.requests);
  const environments = useEnvironmentsStore((s) => s.environments);
  const chains = useChainStore((s) => s.chains);

  return useMemo(() => {
    const store = createZustandStoreAccess();
    return {
      deleted: !isStillAttached(store, chip),
      method: buildAttachmentMetadata([chip], store)[0].method,
    };
  }, [chip, collections, requests, environments, chains]);
}

type AttachmentPillProps = {
  chip: ContextChip;
  deleted: boolean;
  method?: string;
  className?: string;
};

/** The one pill look shared by the composer and the sent bubble (COMP-05). */
export function AttachmentPill({
  chip,
  deleted,
  method,
  className,
}: AttachmentPillProps) {
  const t = useTranslations("relay");
  const name = redactValue(chip.label);
  const label = deleted
    ? t("composer.pill.stale", { name })
    : `${t(KIND_LABEL_KEYS[chip.kind])}: ${name}`;
  return (
    <span
      role="img"
      title={label}
      aria-label={label}
      data-testid="relay-composer-pill"
      data-kind={chip.kind}
      data-stale={deleted}
      className={cn(
        "inline-flex max-w-full align-baseline",
        deleted && "line-through opacity-60 grayscale",
        className,
      )}
    >
      <EntityPillStatic entity={toEntity(chip, method)} />
    </span>
  );
}

function AttachmentPillView({ node }: NodeViewProps) {
  const chip = useMemo<ContextChip>(
    () => ({
      kind: node.attrs.kind,
      id: node.attrs.id,
      label: node.attrs.label,
    }),
    [node.attrs.kind, node.attrs.id, node.attrs.label],
  );
  const { deleted, method } = usePillState(chip);
  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      data-key={chipKey(chip)}
      className="mx-0.5 inline-block max-w-full align-baseline"
    >
      <AttachmentPill chip={chip} deleted={deleted} method={method} />
    </NodeViewWrapper>
  );
}

const PILL_DOM_ATTRIBUTE = "data-relay-attachment-pill";

/** One Backspace removes the whole pill instead of first selecting it. */
export function removePillBeforeCaret(
  editor: NodeViewProps["editor"],
  nodeName: string,
): boolean {
  return editor.commands.command(({ tr }) => {
    const { selection } = tr;
    const before = selection.$from.nodeBefore;
    if (!selection.empty || before?.type.name !== nodeName) return false;
    tr.delete(selection.from - before.nodeSize, selection.from);
    return true;
  });
}

/** The atomic inline node that stands for one attached item in the composer. */
export const AttachmentPillNode = Node.create({
  name: ATTACHMENT_PILL_NODE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      kind: { default: "request" },
      id: { default: "" },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: `span[${PILL_DOM_ATTRIBUTE}]` }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { [PILL_DOM_ATTRIBUTE]: "" }),
    ];
  },

  renderText({ node }) {
    return `@${node.attrs.label}`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentPillView, { as: "span" });
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => removePillBeforeCaret(this.editor, this.name),
    };
  },
});
