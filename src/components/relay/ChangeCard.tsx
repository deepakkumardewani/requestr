"use client";

import {
  FilesIcon,
  FileTextIcon,
  FolderIcon,
  LayersIcon,
  type LucideIcon,
  SettingsIcon,
  SquareArrowOutUpRightIcon,
  Undo2Icon,
  WorkflowIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import {
  type ChangeEntity,
  type ChangeLog,
  type ChangeView,
  createZustandWorkspaceWriter,
  getRelayChangeLog,
  type UndoBlockReason,
} from "@/lib/relay/changeLog";
import {
  buildChangesSummary,
  type OpenState,
} from "@/lib/relay/changesSummary";
import { RELAY_COARSE_TOUCH_CLASS } from "@/lib/relay/constants";
import {
  expandInTree,
  type OpenTarget,
  pushRoute,
  routeForTarget,
} from "@/lib/relay/openEntity";
import { createZustandStoreAccess } from "@/lib/relay/storeAccess";
import { isRelayToolName, RELAY_TOOL_SCHEMAS } from "@/lib/relay/tools/schemas";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useSidebarRevealStore } from "@/stores/useSidebarRevealStore";
import { ComposerTip } from "./ComposerTip";
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
  settings: SettingsIcon,
};

const STATUS_KEY_SEPARATOR = " ";

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

/** The cached views of several changes; re-renders when any status moves or a late load lands. */
export function useChangeViews(
  log: ChangeLog,
  changeIds: readonly string[],
): ChangeView[] {
  // A joined string is a stable snapshot, so the store read never loops.
  useSyncExternalStore(
    log.subscribe,
    () =>
      changeIds
        .map((id) => `${id}:${log.getView(id)?.status ?? "unloaded"}`)
        .join(STATUS_KEY_SEPARATOR),
    () => changeIds.join(STATUS_KEY_SEPARATOR),
  );
  // A restored thread has no cached changes; fetch them once. The key keeps the
  // effect from re-running when the caller passes a fresh array each render.
  const idsKey = changeIds.join(STATUS_KEY_SEPARATOR);
  useEffect(() => {
    for (const id of idsKey.split(STATUS_KEY_SEPARATOR)) {
      if (id && !log.getView(id)) void log.load(id);
    }
  }, [log, idsKey]);
  return changeIds.flatMap((id) => log.getView(id) ?? []);
}

/**
 * Subscribes the caller to every list an Open target can disappear from, so a
 * delete made elsewhere (sidebar, editor) re-renders it and the summary model
 * re-reads the live stores.
 */
export function useSubscribeToEntityLists(): void {
  useCollectionsStore((state) => state.collections);
  useCollectionsStore((state) => state.folders);
  useCollectionsStore((state) => state.requests);
  useEnvironmentsStore((state) => state.environments);
  useChainStore((state) => state.chains);
}

/** Runs an Open: requests open as a tab, the tree kinds are revealed in the sidebar, the rest are routes (CONV-05). */
export function useOpenTarget(): (target: OpenTarget) => void {
  const router = useRouter();
  return (target) => {
    if (target.kind === "collection" || target.kind === "folder") {
      // State first: the router push is a no-op when already on the workspace home.
      expandInTree(createZustandStoreAccess(), target.kind, target.id);
      useSidebarRevealStore.getState().reveal(target.id);
    }
    const href = routeForTarget(target);
    if (href) {
      pushRoute(href, router.push);
      return;
    }
    const request = useCollectionsStore
      .getState()
      .requests.find((item) => item.id === target.id);
    if (request) createZustandWorkspaceWriter().openRequest(request);
  };
}

type ChangeRowActionsProps = {
  undone: boolean;
  pending: boolean;
  onUndo: () => void;
  open: OpenState | undefined;
  onOpen: (target: OpenTarget) => void;
};

/** The icon-only Undo and Open of a change row; the label is the accessible name and the tooltip. */
export function ChangeRowActions({
  undone,
  pending,
  onUndo,
  open,
  onOpen,
}: ChangeRowActionsProps) {
  const t = useTranslations("relay.changes");
  if (undone)
    return <span data-testid="relay-change-undone">{t("undone")}</span>;
  const undoLabel = pending ? t("undoing") : t("undo");
  return (
    <>
      <ComposerTip label={undoLabel}>
        <Button
          type="button"
          size="icon-xs"
          variant="outline"
          aria-label={undoLabel}
          className={RELAY_COARSE_TOUCH_CLASS}
          disabled={pending}
          onClick={onUndo}
        >
          <Undo2Icon aria-hidden />
        </Button>
      </ComposerTip>
      {open ? (
        <ComposerTip label={t("open")}>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={t("open")}
            className={RELAY_COARSE_TOUCH_CLASS}
            onClick={() => onOpen(open.target)}
          >
            <SquareArrowOutUpRightIcon aria-hidden />
          </Button>
        </ComposerTip>
      ) : null}
    </>
  );
}

/** Shared frame of a change row: one compact line, with notes underneath only when there are any. */
export const CHANGE_CARD_CLASS = "rounded-md border bg-card text-xs";
export const CHANGE_ROW_CLASS = "flex h-7 items-center gap-1.5 px-2";
export const CHANGE_NOTE_CLASS = "px-2 pb-1";

type ChangeCardProps = {
  change: ChangeOutput;
  /** Defaults to the app-wide log; specs pass their own. */
  log?: ChangeLog;
};

export function ChangeCard({ change: output, log }: ChangeCardProps) {
  const t = useTranslations("relay.changes");
  const activeLog = log ?? getRelayChangeLog();
  const view = useChangeView(activeLog, output.changeId);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<UndoBlockReason | null>(null);
  const openTarget = useOpenTarget();
  useSubscribeToEntityLists();
  const open = view
    ? buildChangesSummary([view], createZustandStoreAccess()).rows.find(
        (row) => row.open,
      )?.open
    : null;

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
      className={`${CHANGE_CARD_CLASS} ${undone ? "text-muted-foreground" : ""}`}
    >
      <div className={CHANGE_ROW_CLASS}>
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span
          className={`min-w-0 flex-1 truncate ${undone ? "line-through" : ""}`}
          title={summary}
        >
          {summary}
        </span>
        <ChangeRowActions
          undone={undone}
          pending={pending}
          onUndo={() => void handleUndo()}
          open={open}
          onOpen={openTarget}
        />
      </div>
      {output.needsValue.length > 0 && !undone ? (
        <p data-testid="relay-change-needs-value" className={CHANGE_NOTE_CLASS}>
          {t("needsValue", { keys: output.needsValue.join(", ") })}
        </p>
      ) : null}
      {reason ? (
        <p
          role="status"
          data-testid="relay-change-blocked"
          className={`${CHANGE_NOTE_CLASS} text-destructive`}
        >
          {t(`blocked.${reason}`)}
        </p>
      ) : null}
    </div>
  );
}
