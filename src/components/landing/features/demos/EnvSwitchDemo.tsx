"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { interpolateVariables } from "@/lib/utils";
import { DemoFrame, DemoPicker } from "./DemoFrame";
import { useDemoCycle } from "./useDemoCycle";

const CYCLE_MS = 2600;
const SECRET_MASK = "••••••••";
const URL_TEMPLATE = "{{baseUrl}}/users?limit=20";
const HEADER_TEMPLATE = "X-Api-Key: {{apiKey}}";
const SECRET_KEYS: ReadonlySet<string> = new Set(["apiKey"]);
const ENVIRONMENTS = [
  {
    id: "local",
    label: "Local",
    variables: { baseUrl: "http://localhost:4000", apiKey: "dev-key-local" },
  },
  {
    id: "staging",
    label: "Staging",
    variables: {
      baseUrl: "https://staging.api.example.com",
      apiKey: "sk_stg_7f2a91",
    },
  },
  {
    id: "production",
    label: "Production",
    variables: { baseUrl: "https://api.example.com", apiKey: "sk_live_c41e08" },
  },
] as const;

/** Secret values are swapped for a mask unless the visitor shows them. */
export function displayVariables(
  variables: Readonly<Record<string, string>>,
  showSecrets: boolean,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [
      key,
      SECRET_KEYS.has(key) && !showSecrets ? SECRET_MASK : value,
    ]),
  );
}

function ResolvedLine({
  label,
  template,
  value,
}: {
  label: string;
  template: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="truncate font-mono text-xs text-muted-foreground">
        {template}
      </p>
      <p className="truncate font-mono text-sm text-foreground">{value}</p>
    </div>
  );
}

/** One saved request, resolved against whichever environment is active. */
export function EnvSwitchDemo() {
  const cycle = useDemoCycle({
    count: ENVIRONMENTS.length,
    intervalMs: CYCLE_MS,
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const environment = ENVIRONMENTS[cycle.index];
  const variables = displayVariables(environment.variables, showSecrets);
  const SecretIcon = showSecrets ? EyeOffIcon : EyeIcon;

  return (
    <DemoFrame
      label="Environment switching example"
      title={`GET Users · ${environment.label}`}
      frameRef={cycle.ref}
      controls={
        <DemoPicker
          label="Active environment"
          options={ENVIRONMENTS}
          activeIndex={cycle.index}
          onPick={cycle.pick}
        />
      }
    >
      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4" aria-live="polite">
          <ResolvedLine
            label="URL"
            template={URL_TEMPLATE}
            value={interpolateVariables(URL_TEMPLATE, variables)}
          />
          <ResolvedLine
            label="Header"
            template={HEADER_TEMPLATE}
            value={interpolateVariables(HEADER_TEMPLATE, variables)}
          />
        </div>
        <div className="rounded-lg border border-border bg-card/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {environment.label} variables
            </p>
            <button
              type="button"
              aria-pressed={showSecrets}
              aria-label="Show secret values"
              onClick={() => setShowSecrets((shown) => !shown)}
              className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SecretIcon aria-hidden="true" className="size-3.5" />
            </button>
          </div>
          <dl className="space-y-1.5 font-mono text-xs">
            {Object.entries(variables).map(([key, value]) => (
              <div key={key} className="flex min-w-0 gap-2">
                <dt className="shrink-0 text-[var(--method-post)]">{key}</dt>
                <dd className="truncate text-foreground/90">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </DemoFrame>
  );
}
