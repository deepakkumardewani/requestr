"use client";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  FilesIcon,
  FileTextIcon,
  FolderIcon,
  LayersIcon,
  type LucideIcon,
  SquareArrowOutUpRightIcon,
  Undo2Icon,
  WorkflowIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { buildChangeDiff } from "@/lib/relay/changeDiff";
import {
  type ChangeEntity,
  type ChangeLog,
  type ChangeView,
  createZustandWorkspaceWriter,
  getRelayChangeLog,
  type UndoBlockReason,
} from "@/lib/relay/changeLog";
import { RELAY_COARSE_TOUCH_CLASS } from "@/lib/relay/constants";
import { isRelayToolName, RELAY_TOOL_SCHEMAS } from "@/lib/relay/tools/schemas";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import type { ToolRowPart } from "./ToolRow";

const ENTITY_ICONS: Record<ChangeEntity, LucideIcon> = {
  request: FileTextIcon,
  requests: FilesIcon,
  collection: FolderIcon,
  folder: FolderIcon,
  tree: FolderIcon,
  environment: LayersIcon,
  activeEnvironment: LayersIcon,
  tab: SquareArrowOutUpRightIcon,
  tabRequest: SquareArrowOutUpRightIcon,
  chain: WorkflowIcon,
};

/** Changes that point at requests can be opened in a tab. */
const OPENABLE: ReadonlySet<string> = new Set(["request", "requests", "tab"]);
const BATCH_ID_SEPARATOR = ",";
const BLOCKED_FALLBACK: UndoBlockReason = "edited";

type ChangeOutput = {
  changeId: string;
  summary: string;
  needsValue: string[];
};

/** Reads a finished write call's result; null for read tools, failures and pending calls. */
export function readChangeOutput(part: ToolRowPart): ChangeOutput | null {
  const name = part.type.replace(/^tool-/, "");
  if (!isRelayToolName(name) || RELAY_TOOL_SCHEMAS[name].kind === "read") {
    return null;
  }
  const output = part.output as { ok?: unknown; data?: unknown } | undefined;
  if (part.state !== "output-available" || output?.ok !== true) return null;
  const data = (output.data ?? {}) as Record<string, unknown>;
  if (typeof data.changeId !== "string") return null;
  return {
    changeId: data.changeId,
    summary: typeof data.summary === "string" ? data.summary : "",
    needsValue: Array.isArray(data.needsValue)
      ? data.needsValue.filter((key): key is string => typeof key === "string")
      : [],
  };
}

function useChangeView(log: ChangeLog, changeId: string): ChangeView | null {
  const view = useSyncExternalStore(
    log.subscribe,
    () => log.getView(changeId),
    () => null,
  );
  // A restored thread has no cached change; fetch it from storage once.
  useEffect(() => {
    if (!view) void log.load(changeId);
  }, [log, changeId, view]);
  return view;
}

function openableRequestId(change: ChangeView): string | null {
  if (!OPENABLE.has(change.entity)) return null;
  return change.entityId.split(BATCH_ID_SEPARATOR)[0] || null;
}

function openRequestTab(requestId: string): void {
  const request = useCollectionsStore
    .getState()
    .requests.find((item) => item.id === requestId);
  if (request) createZustandWorkspaceWriter().openRequest(request);
}

function ChangeDetails({ change }: { change: ChangeView }) {
  const t = useTranslations("relay.changes");
  const { rows, hidden } = buildChangeDiff(change.before, change.after);
  if (rows.length === 0) {
    return <p className="pl-6 text-muted-foreground">{t("detailsNone")}</p>;
  }
  return (
    <dl
      data-testid="relay-change-details"
      className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pl-6 font-mono"
    >
      {rows.map((row) => (
        <div key={row.path} className="col-span-2 grid grid-cols-subgrid">
          <dt className="text-muted-foreground">{row.path}</dt>
          <dd className="break-all">
            {row.before !== null ? (
              <span className="text-destructive line-through">
                <span className="sr-only">{t("detailsBefore")}: </span>
                {row.before}
              </span>
            ) : null}{" "}
            {row.after !== null ? (
              <span>
                <span className="sr-only">{t("detailsAfter")}: </span>
                {row.after}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
      {hidden > 0 ? (
        <p className="col-span-2 text-muted-foreground">
          {t("detailsMore", { count: hidden })}
        </p>
      ) : null}
    </dl>
  );
}

type ChangeCardProps = {
  change: ChangeOutput;
  /** Defaults to the app-wide log; specs pass their own. */
  log?: ChangeLog;
};

export function ChangeCard({ change: output, log }: ChangeCardProps) {
  const t = useTranslations("relay.changes");
  const activeLog = log ?? getRelayChangeLog();
  const view = useChangeView(activeLog, output.changeId);
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<UndoBlockReason | null>(null);
  const requestId = view ? openableRequestId(view) : null;
  const canOpen = useCollectionsStore((s) =>
    requestId ? s.requests.some((item) => item.id === requestId) : false,
  );

  const undone = view?.status === "undone";
  const reason =
    failure ??
    (view?.status === "blocked" ? (view.reason ?? BLOCKED_FALLBACK) : null);
  const summary = view?.summary || output.summary;
  // Stored rows type the entity as a plain string, so an unknown one falls back.
  const Icon = ENTITY_ICONS[view?.entity as ChangeEntity] ?? FileTextIcon;

  async function handleUndo() {
    setPending(true);
    const result = await activeLog.undo(output.changeId);
    setPending(false);
    setFailure(result.ok ? null : result.reason);
  }

  return (
    <div
      data-testid="relay-change-card"
      data-status={view?.status ?? "applied"}
      role="group"
      aria-label={t("cardLabel", { summary })}
      className={`my-1.5 space-y-1.5 rounded-md border bg-card p-2 text-xs ${undone ? "text-muted-foreground" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span
          className={`min-w-0 flex-1 truncate ${undone ? "line-through" : ""}`}
          title={summary}
        >
          {summary}
        </span>
        {undone ? (
          <span data-testid="relay-change-undone">{t("undone")}</span>
        ) : (
          <Button
            type="button"
            size="xs"
            variant="outline"
            className={RELAY_COARSE_TOUCH_CLASS}
            disabled={pending}
            onClick={() => void handleUndo()}
          >
            <Undo2Icon aria-hidden />
            {pending ? t("undoing") : t("undo")}
          </Button>
        )}
        {canOpen && requestId && !undone ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className={RELAY_COARSE_TOUCH_CLASS}
            onClick={() => openRequestTab(requestId)}
          >
            <SquareArrowOutUpRightIcon aria-hidden />
            {t("open")}
          </Button>
        ) : null}
      </div>
      {view ? (
        <>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className={`flex items-center gap-1 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${RELAY_COARSE_TOUCH_CLASS}`}
          >
            {expanded ? (
              <ChevronDownIcon aria-hidden className="size-3" />
            ) : (
              <ChevronRightIcon aria-hidden className="size-3" />
            )}
            {expanded ? t("hideDetails") : t("showDetails")}
          </button>
          {expanded ? <ChangeDetails change={view} /> : null}
        </>
      ) : null}
      {output.needsValue.length > 0 && !undone ? (
        <p data-testid="relay-change-needs-value">
          {t("needsValue", { keys: output.needsValue.join(", ") })}
        </p>
      ) : null}
      {reason ? (
        <p
          role="status"
          data-testid="relay-change-blocked"
          className="text-destructive"
        >
          {t(`blocked.${reason}`)}
        </p>
      ) : null}
    </div>
  );
}
