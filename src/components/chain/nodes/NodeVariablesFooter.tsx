"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

/** Matches the same `{{var}}` placeholder shape used by `resolveRequest`'s resolution/detection logic. */
const VAR_REF_REGEX = /\{\{(\w+)\}\}/g;

/** Extracts every distinct `{{var}}` name referenced across the given text fields, in first-seen order. */
export function extractVariableRefs(texts: string[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(VAR_REF_REGEX)) {
      found.add(match[1]);
    }
  }
  return [...found];
}

type NodeVariablesFooterProps = {
  /** Raw text fields (url, header values, body, etc.) to scan for `{{var}}` references. */
  texts: string[];
  /** Names that resolve right now — chain input keys unioned with active-environment variable keys. */
  resolvedNames: string[];
};

/** Node-canvas footer listing every input/env variable a node references, with an unresolved indicator. */
export function NodeVariablesFooter({
  texts,
  resolvedNames,
}: NodeVariablesFooterProps) {
  const t = useTranslations("chain");
  const names = extractVariableRefs(texts);
  if (names.length === 0) return null;

  const resolvedSet = new Set(resolvedNames);
  const unresolvedCount = names.filter((name) => !resolvedSet.has(name)).length;

  return (
    <div
      data-testid="node-variables-footer"
      className="group/vars relative flex w-full items-center gap-1 border-t border-border/50 px-2 py-1 text-[10px] text-muted-foreground"
    >
      <span>{t("nodeVariablesFooterCount", { count: names.length })}</span>
      {unresolvedCount > 0 && (
        <span
          data-testid="node-variables-footer-unresolved"
          className="flex items-center gap-0.5 text-amber-500"
        >
          <AlertTriangle className="h-2.5 w-2.5" />
          {t("nodeVariablesFooterUnresolvedBadge", { count: unresolvedCount })}
        </span>
      )}

      <ul
        data-testid="node-variables-footer-list"
        className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 hidden flex-col gap-0.5 rounded border border-border bg-popover px-2 py-1 font-mono text-[10px] shadow-md group-hover/vars:flex"
      >
        {names.map((name) => (
          <li
            key={name}
            className={resolvedSet.has(name) ? undefined : "text-amber-400"}
          >
            {`{{${name}}}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
