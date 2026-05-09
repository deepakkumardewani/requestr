"use client";

import { ArrowRight, Database, GitBranch, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { modKey } from "@/lib/platform";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";

const SAMPLE_REQUESTS: Array<{
  id: string;
  title: string;
  description: string;
  method: "GET" | "POST" | "CHAIN";
  url: string;
}> = [
  {
    id: "get-api",
    title: "GET a public API",
    description: "See how Requestly works with a real API call",
    method: "GET",
    url: "https://dummyjson.com/products/1",
  },
  {
    id: "post-json",
    title: "POST with JSON body",
    description: "Send structured data and see the response",
    method: "POST",
    url: "https://httpbin.org/post",
  },
  {
    id: "chain-requests",
    title: "Chain two requests together",
    description: "Use responses from one request as input to the next",
    method: "CHAIN",
    url: "#",
  },
];

type Shortcut = {
  keys: string[];
  labelKey:
    | "newTab"
    | "closeTab"
    | "sendRequest"
    | "saveRequest"
    | "commandPalette"
    | "keyboardShortcuts"
    | "newCollection";
};

function getShortcuts(): Shortcut[] {
  const mod = modKey();
  return [
    { keys: ["Ctrl", "T"], labelKey: "newTab" },
    { keys: ["Ctrl", "W"], labelKey: "closeTab" },
    { keys: [mod, "↵"], labelKey: "sendRequest" },
    { keys: [mod, "S"], labelKey: "saveRequest" },
    { keys: [mod, "K"], labelKey: "commandPalette" },
    { keys: [mod, "/"], labelKey: "keyboardShortcuts" },
    { keys: ["Ctrl", "N"], labelKey: "newCollection" },
  ];
}

function KeyBadge({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      {label}
    </kbd>
  );
}

function SampleRequestCard({
  sample,
}: {
  sample: (typeof SAMPLE_REQUESTS)[number];
}) {
  const openTab = useTabsStore((s) => s.openTab);
  const createCollection = useCollectionsStore((s) => s.createCollection);
  const router = useRouter();

  function handleClick() {
    if (sample.method === "CHAIN") {
      const collection = createCollection("Demo Chain");
      router.push(`/chain/${collection.id}`);
      return;
    }
    // Type assertion is safe here since we check for CHAIN above
    openTab({ method: sample.method as "GET" | "POST", url: sample.url });
  }

  const Icon =
    sample.method === "GET"
      ? Database
      : sample.method === "POST"
        ? Plus
        : GitBranch;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 hover:border-border/60 transition-colors text-left"
      data-testid={`sample-request-${sample.id}`}
    >
      <div className="mt-0.5 shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{sample.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {sample.description}
        </p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0 mt-0.5" />
    </button>
  );
}

export function EmptyState() {
  const t = useTranslations();
  const tShortcuts = useTranslations("shortcuts");
  const openTab = useTabsStore((s) => s.openTab);
  const setKeyboardShortcutsOpen = useUIStore(
    (s) => s.setKeyboardShortcutsOpen,
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      {/* Main CTA */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">
            Send a request. Build a workflow.
          </p>
          <p className="text-sm text-muted-foreground">
            Press Ctrl+T to start, or explore a sample below.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => openTab()}
          data-testid="new-tab-btn"
          className="mt-2"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t("common.newRequest")}
        </Button>
      </div>

      {/* Sample request cards */}
      <div className="grid w-full max-w-md gap-2.5">
        {SAMPLE_REQUESTS.map((sample) => (
          <SampleRequestCard key={sample.id} sample={sample} />
        ))}
      </div>

      {/* Keyboard shortcuts */}
      <div className="flex flex-col gap-2 text-center">
        <button
          type="button"
          onClick={() => setKeyboardShortcutsOpen(true)}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {t("common.keyboardShortcuts")}
        </button>
        <div className="flex flex-col gap-1.5">
          {getShortcuts().map((s) => (
            <div
              key={s.labelKey}
              className="flex items-center justify-between gap-8"
            >
              <span className="text-xs text-muted-foreground">
                {tShortcuts(s.labelKey)}
              </span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <KeyBadge key={k} label={k} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
