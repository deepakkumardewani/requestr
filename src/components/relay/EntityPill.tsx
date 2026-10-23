"use client";

import {
  FolderIcon,
  GlobeIcon,
  type LucideIcon,
  WorkflowIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { METHOD_BADGE_CLASSES } from "@/lib/constants";
import {
  type ChangeSpec,
  type CommitOutcome,
  createZustandWorkspaceWriter,
} from "@/lib/relay/changeLog";
import type { EntityLinkKind, ResolvedEntity } from "@/lib/relay/entityLinks";
import { openEntity } from "@/lib/relay/openEntity";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import { cn } from "@/lib/utils";
import type { HttpMethod } from "@/types";

/** The accent shared by pills and file-like inline code (FR-181). */
export const ENTITY_ACCENT_CLASS = "text-primary";

const KIND_ICONS: Record<Exclude<EntityLinkKind, "request">, LucideIcon> = {
  collection: FolderIcon,
  environment: GlobeIcon,
  chain: WorkflowIcon,
};

const PILL_CLASS =
  "inline-flex max-w-full items-center gap-1 rounded-full border border-current/30 bg-muted px-2 py-0.5 align-baseline text-xs font-medium";

/** A pill click is a plain navigation: unlike the tool, it is not a Relay change to undo. */
async function applyWithoutLogging(spec: ChangeSpec): Promise<CommitOutcome> {
  spec.mutate();
  return { ok: true, data: {} };
}

function PillIcon({ entity }: { entity: ResolvedEntity }) {
  if (entity.kind !== "request") {
    const Icon = KIND_ICONS[entity.kind];
    return <Icon aria-hidden className="size-3.5 shrink-0" />;
  }
  const method = entity.method as HttpMethod;
  return (
    <span
      data-testid="relay-pill-method"
      className={cn(
        "rounded px-1 font-mono text-[0.7rem] font-semibold",
        METHOD_BADGE_CLASSES[method],
      )}
    >
      {method}
    </span>
  );
}

type EntityPillProps = { entity: ResolvedEntity };

/** A resolvable `relay://` link: opens the entity in the workspace on click. */
export function EntityPill({ entity }: EntityPillProps) {
  const t = useTranslations("relay");
  const router = useRouter();

  const handleOpen = async () => {
    const outcome = await openEntity(entity.kind, entity.id, {
      store: createZustandStoreAccess(),
      writer: createZustandWorkspaceWriter(),
      commit: applyWithoutLogging,
    });
    if (!outcome.ok) {
      console.error("[relay] open entity failed", entity.kind, outcome.error);
      return;
    }
    if (typeof outcome.data.href === "string") router.push(outcome.data.href);
  };

  return (
    <button
      type="button"
      data-testid="relay-entity-pill"
      data-kind={entity.kind}
      aria-label={t("pill.open", {
        kind: t(`pill.kind.${entity.kind}`),
        name: entity.name,
      })}
      onClick={handleOpen}
      className={cn(
        PILL_CLASS,
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ENTITY_ACCENT_CLASS,
      )}
    >
      <PillIcon entity={entity} />
      <span className="truncate">{entity.name}</span>
    </button>
  );
}

/** The pill's look without the click: shows what an attached item looks like. */
export function EntityPillStatic({ entity }: EntityPillProps) {
  return (
    <span
      data-testid="relay-entity-pill-static"
      data-kind={entity.kind}
      className={cn(PILL_CLASS, ENTITY_ACCENT_CLASS)}
    >
      <PillIcon entity={entity} />
      <span className="truncate">{entity.name}</span>
    </span>
  );
}
