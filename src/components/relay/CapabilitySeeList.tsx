"use client";

import {
  DatabaseIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  PaperclipIcon,
  SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  ENTITY_LINK_KINDS,
  type ResolvedEntity,
} from "@/lib/relay/entityLinks";
import { EntityPillStatic } from "./EntityPill";

type SeeItem = {
  id: "attached" | "index" | "lookups" | "envValues" | "secrets";
  icon: ReactNode;
};

const ICON_CLASS = "mt-0.5 size-4 shrink-0 text-muted-foreground";

const SEE_ITEMS: readonly SeeItem[] = [
  {
    id: "attached",
    icon: <PaperclipIcon aria-hidden className={ICON_CLASS} />,
  },
  { id: "index", icon: <DatabaseIcon aria-hidden className={ICON_CLASS} /> },
  { id: "lookups", icon: <SearchIcon aria-hidden className={ICON_CLASS} /> },
  {
    id: "envValues",
    icon: <KeyRoundIcon aria-hidden className={ICON_CLASS} />,
  },
  {
    id: "secrets",
    icon: <LockKeyholeIcon aria-hidden className={ICON_CLASS} />,
  },
];

const SAMPLE_METHOD = "GET";

/** The "What Relay can see" list: what reaches the model, and what never does (RP-207). */
export function CapabilitySeeList() {
  const t = useTranslations("relay");
  // Placeholder entities that show what an attached item looks like.
  const samples: ResolvedEntity[] = ENTITY_LINK_KINDS.map((kind) => ({
    kind,
    id: `sample-${kind}`,
    name: t(`pill.kind.${kind}`),
    ...(kind === "request" ? { method: SAMPLE_METHOD } : {}),
  }));

  return (
    <ul
      data-testid="relay-capability-see-list"
      className="flex flex-col gap-3 p-3"
    >
      {SEE_ITEMS.map(({ id, icon }) => (
        <li
          key={id}
          data-testid={`relay-capability-see-${id}`}
          className="flex gap-2 text-sm"
        >
          {icon}
          <div className="flex min-w-0 flex-col gap-1.5">
            <span>{t(`capabilities.see.${id}`)}</span>
            {id === "attached" ? (
              <span className="flex flex-wrap gap-1">
                {samples.map((entity) => (
                  <EntityPillStatic key={entity.kind} entity={entity} />
                ))}
              </span>
            ) : null}
            {id === "envValues" ? (
              <Link
                href="/settings"
                data-testid="relay-capability-settings-link"
                className="w-fit text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("capabilities.see.settingsLink")}
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
