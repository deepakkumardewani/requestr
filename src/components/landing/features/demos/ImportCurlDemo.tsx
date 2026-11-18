"use client";

import { useId, useMemo, useState } from "react";
import type { ParsedCurl } from "@/types";
import { authSummary, summarizeCurl } from "./curlSummary";
import { DemoFrame, DemoPicker } from "./DemoFrame";
import { useDemoCycle } from "./useDemoCycle";

const CYCLE_MS = 3600;
const SAMPLES = [
  {
    id: "post",
    label: "POST with JSON",
    command: `curl -X POST https://api.example.com/orders \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer eyJhbGciOi" \\
  -d '{"sku":"KB-01","quantity":2}'`,
  },
  {
    id: "basic",
    label: "Basic auth",
    command: `curl https://api.example.com/reports?month=05 \\
  -u ada:s3cret \\
  -H "Accept: text/csv"`,
  },
  {
    id: "get",
    label: "GET with headers",
    command: `curl https://api.example.com/users/42 \\
  -H "Accept: application/json" \\
  -H "X-Request-Id: 7f2a91"`,
  },
] as const;

function RequestPreview({ request }: { request: ParsedCurl }) {
  const headers = request.headers.filter((header) => header.key);
  return (
    <dl className="space-y-3 font-mono text-xs">
      <div className="flex min-w-0 items-center gap-2">
        <dt className="sr-only">Method and URL</dt>
        <dd
          style={{ color: `var(--method-${request.method.toLowerCase()})` }}
          className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-semibold"
        >
          {request.method}
        </dd>
        <dd className="truncate text-sm text-foreground">{request.url}</dd>
      </div>
      <div>
        <dt className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          Headers · {headers.length}
        </dt>
        {headers.map((header) => (
          <dd key={header.id} className="truncate text-foreground/90">
            <span className="text-[var(--method-post)]">{header.key}</span>:{" "}
            {header.value}
          </dd>
        ))}
      </div>
      <div>
        <dt className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          Auth
        </dt>
        <dd className="text-foreground/90">{authSummary(request.auth)}</dd>
      </div>
      <div>
        <dt className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          Body · {request.body.type}
        </dt>
        <dd className="truncate text-foreground/90">
          {request.body.content || "—"}
        </dd>
      </div>
    </dl>
  );
}

/** Paste a cURL command and see the request the importer builds from it. */
export function ImportCurlDemo() {
  const cycle = useDemoCycle({ count: SAMPLES.length, intervalMs: CYCLE_MS });
  const [draft, setDraft] = useState<string | null>(null);
  const command = draft ?? SAMPLES[cycle.index].command;
  const summary = useMemo(() => summarizeCurl(command), [command]);
  const inputId = useId();

  function pick(index: number) {
    setDraft(null);
    cycle.pick(index);
  }

  return (
    <DemoFrame
      label="cURL import example"
      title="import · cURL"
      frameRef={cycle.ref}
      controls={
        <DemoPicker
          label="Example commands"
          options={SAMPLES}
          activeIndex={draft === null ? cycle.index : -1}
          onPick={pick}
        />
      }
    >
      <div className="grid sm:grid-cols-2">
        <div className="border-b border-border p-4 sm:border-r sm:border-b-0">
          <label
            htmlFor={inputId}
            className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
          >
            cURL command
          </label>
          <textarea
            id={inputId}
            value={command}
            rows={7}
            spellCheck={false}
            onChange={(event) => {
              cycle.stop();
              setDraft(event.target.value);
            }}
            className="h-44 w-full resize-none rounded-md border border-input bg-input/30 p-3 font-mono text-xs leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div aria-live="polite" className="h-60 overflow-hidden p-4">
          {"error" in summary ? (
            <p className="font-mono text-xs text-[var(--method-delete)]">
              {summary.error}
            </p>
          ) : (
            <RequestPreview request={summary.request} />
          )}
        </div>
      </div>
    </DemoFrame>
  );
}
