"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { JsonPathExplorer } from "@/components/chain/dialogs/JsonPathExplorer";
import { FormattedJsonResponseBody } from "@/components/chain/panels/arrow-config/FormattedJsonResponseBody";
import { CopyButton } from "@/components/chain/panels/CopyButton";
import { Button } from "@/components/ui/button";
import { MAX_BODY_BYTES, type RunStep } from "@/lib/chainRunHistory";
import { cn, formatDuration } from "@/lib/utils";

const TRUNCATION_LIMIT_KB = MAX_BODY_BYTES / 1024;

type OutputTabProps = {
  step: RunStep;
};

/** Parses `body` as JSON, returning `undefined` when it isn't valid JSON. */
function tryParseJson(body: string): object | undefined {
  try {
    const parsed = JSON.parse(body);
    return parsed !== null && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function ResponseHeaders({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0) return null;

  return (
    <ul className="flex flex-col gap-0.5 text-xs">
      {entries.map(([name, value]) => (
        <li key={name} className="flex gap-1.5 font-mono">
          <span className="shrink-0 text-muted-foreground">{name}:</span>
          <span className="break-all text-foreground">{value}</span>
        </li>
      ))}
    </ul>
  );
}

export function OutputTab({ step }: OutputTabProps) {
  const t = useTranslations("chain");
  const [explorerOpen, setExplorerOpen] = useState(false);
  const { response } = step;
  const parsedBody = useMemo(
    () => (response ? tryParseJson(response.body) : undefined),
    [response],
  );

  if (!response) {
    return (
      <p className="text-xs text-muted-foreground">{t("runLogOutputEmpty")}</p>
    );
  }

  // There is no target field in this read-only run-log view, so selecting or
  // dropping a JSONPath here simply copies it to the clipboard for convenience.
  const handleSelectPath = (path: string) => {
    navigator.clipboard.writeText(path).catch((err) => {
      console.error("Clipboard write failed", err);
    });
  };

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-mono font-medium",
            response.status >= 400 ? "text-destructive" : "text-emerald-600",
          )}
        >
          {response.status} {response.statusText}
        </span>
        <span className="text-muted-foreground">
          {formatDuration(response.duration)}
        </span>
      </div>

      <ResponseHeaders headers={response.headers} />

      {response.truncated && (
        <p className="text-muted-foreground">
          {t("runLogOutputTruncated", { kb: TRUNCATION_LIMIT_KB })}
        </p>
      )}

      <div className="flex items-start justify-between gap-2 rounded border border-border bg-muted/30 p-2">
        <FormattedJsonResponseBody body={response.body} />
        <CopyButton text={response.body} />
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-6 self-start text-xs"
        disabled={!parsedBody}
        onClick={() => setExplorerOpen((open) => !open)}
      >
        {t("runLogOutputOpenExplorer")}
      </Button>

      {explorerOpen && parsedBody && (
        <JsonPathExplorer
          data={parsedBody}
          onSelect={handleSelectPath}
          onDrop={handleSelectPath}
        />
      )}
    </div>
  );
}
