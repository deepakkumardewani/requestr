"use client";

import { ArrowRight } from "lucide-react";
import { track } from "@/lib/analytics/adapter";
import type { SAMPLE_IDS as ANALYTICS_SAMPLE_IDS } from "@/lib/analytics/events";
import { REQUEST_TEMPLATES, templateToTabState } from "@/lib/requestTemplates";
import { cn } from "@/lib/utils";
import { useTabsStore } from "@/stores/useTabsStore";

const SAMPLE_IDS = [
  "rest-get",
  "graphql-query",
  "bearer-auth",
  "webhook-post",
] as const;

/** Template id -> the analytics sample enum, so template names never leave the client. */
const ANALYTICS_SAMPLE_ID: Record<
  (typeof SAMPLE_IDS)[number],
  (typeof ANALYTICS_SAMPLE_IDS)[number]
> = {
  "rest-get": "get_json",
  "graphql-query": "graphql",
  "bearer-auth": "get_json",
  "webhook-post": "post_json",
};

const METHOD_COLOR: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  PATCH: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const SAMPLES = REQUEST_TEMPLATES.filter((t) =>
  (SAMPLE_IDS as readonly string[]).includes(t.id),
);

type SampleRequestCardsProps = {
  className?: string;
};

export function SampleRequestCards({ className }: SampleRequestCardsProps) {
  const openTab = useTabsStore((s) => s.openTab);

  function handleOpen(templateId: string) {
    const template = SAMPLES.find((t) => t.id === templateId);
    if (!template) return;
    openTab(templateToTabState(template));
    track("sample_request_used", {
      sample_id:
        ANALYTICS_SAMPLE_ID[template.id as keyof typeof ANALYTICS_SAMPLE_ID],
    });
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Try a sample request
      </p>
      {SAMPLES.map((template) => (
        <button
          type="button"
          key={template.id}
          onClick={() => handleOpen(template.id)}
          data-testid={`sample-request-${template.id}`}
          className="group flex w-full items-center gap-2 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-left transition-colors hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
              METHOD_COLOR[template.method] ?? "bg-muted text-foreground",
            )}
          >
            {template.method}
          </span>
          <span className="flex-1 truncate text-xs text-foreground">
            {template.name}
          </span>
          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}
