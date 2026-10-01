import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { NamespaceProducerSource } from "@/lib/chainValueNamespace";

type AliasCollisionWarningProps = {
  /** Name -> the distinct producers that publish it (from `detectChainAliasCollisions`). */
  collisions: Record<string, NamespaceProducerSource[]>;
};

type SourceKind = NamespaceProducerSource["kind"];

const SOURCE_LABEL_KEY = {
  start: "aliasCollisionSourceStart",
  display: "aliasCollisionSourceDisplay",
  evaluate: "aliasCollisionSourceEvaluate",
  loop: "aliasCollisionSourceLoop",
  loopIndex: "aliasCollisionSourceLoopIndex",
  edge: "aliasCollisionSourceEdge",
} as const satisfies Record<SourceKind, string>;

/** Inline warning listing names that more than one producer writes into the shared namespace. */
export function AliasCollisionWarning({
  collisions,
}: AliasCollisionWarningProps) {
  const t = useTranslations("chain");
  const entries = Object.entries(collisions);
  if (entries.length === 0) return null;

  // Grouped by kind so "3 edges" reads better than three identical labels.
  const describeSources = (sources: NamespaceProducerSource[]) => {
    const counts = new Map<SourceKind, number>();
    for (const { kind } of sources) {
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    return [...counts]
      .map(([kind, count]) => t(SOURCE_LABEL_KEY[kind], { count }))
      .join(", ");
  };

  return (
    <div
      role="alert"
      className="flex gap-2 items-start p-3 rounded-md border border-destructive/50 bg-destructive/5"
    >
      <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
      <div className="text-[10px] text-destructive leading-snug">
        <p className="font-semibold mb-1">{t("aliasCollisionTitle")}</p>
        {entries.map(([alias, sources]) => (
          <p key={alias}>
            {t("aliasCollisionItem", {
              alias,
              sources: describeSources(sources),
              placeholder: `{{${alias}}}`,
            })}
          </p>
        ))}
      </div>
    </div>
  );
}
