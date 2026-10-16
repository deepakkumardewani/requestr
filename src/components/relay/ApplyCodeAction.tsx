"use client";

import { CheckIcon, DownloadIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type ApplyField,
  buildApplyBefore,
  buildApplyPatch,
  resolveApplyAction,
} from "@/lib/relay/applyCode";
import { getRelayChangeLog } from "@/lib/relay/changeLog";
import { RELAY_COARSE_TOUCH_CLASS } from "@/lib/relay/constants";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { ChangeCard } from "./ChangeCard";

const CONFIRM_KEY = {
  body: "confirmBody",
  variables: "confirmVariables",
  draft: "confirmMessage",
} as const satisfies Record<ApplyField, string>;

type Phase =
  | { step: "idle" }
  | { step: "confirming" }
  | { step: "failed" }
  | { step: "applied"; changeId: string; summary: string };

type ApplyCodeActionProps = {
  code: string;
};

/**
 * Puts a reply's code into one field of the active tab after a confirm. The
 * write goes through the change log, so Undo is available; nothing is sent,
 * connected or executed (FR-183, NFR-2).
 */
export function ApplyCodeAction({ code }: ApplyCodeActionProps) {
  const t = useTranslations("relay");
  const hintId = useId();
  const activeTab = useTabsStore(
    (state) =>
      state.tabs.find((tab) => tab.tabId === state.activeTabId) ?? null,
  );
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const action = resolveApplyAction(activeTab, code);

  async function handleConfirm() {
    if (!activeTab || !action.field) return;
    const { field } = action;
    const result = await getRelayChangeLog().apply(
      {
        threadId: useRelayStore.getState().activeThreadId ?? "",
        turnId: `code-apply-${crypto.randomUUID()}`,
        toolCallId: "code-apply",
      },
      {
        entity: "tabRequest",
        entityId: activeTab.tabId,
        summary: t(`apply.${action.label}`),
        before: buildApplyBefore(activeTab),
        mutate: () =>
          useTabsStore
            .getState()
            .updateTabState(
              activeTab.tabId,
              buildApplyPatch(activeTab, field, code),
            ),
      },
    );
    setPhase(
      result.ok
        ? {
            step: "applied",
            changeId: result.change.id,
            summary: result.change.summary,
          }
        : { step: "failed" },
    );
  }

  if (phase.step === "applied") {
    return (
      <ChangeCard
        change={{
          changeId: phase.changeId,
          summary: phase.summary,
          needsValue: [],
        }}
      />
    );
  }

  if (phase.step === "confirming" && action.field) {
    return (
      <div
        role="alertdialog"
        aria-label={t(`apply.${CONFIRM_KEY[action.field]}`)}
        data-testid="relay-apply-confirm"
        className="space-y-1.5 rounded-md border bg-card p-2 text-xs"
      >
        <p className="font-medium">{t(`apply.${CONFIRM_KEY[action.field]}`)}</p>
        <p className="text-muted-foreground">{t("apply.confirmHint")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            className={RELAY_COARSE_TOUCH_CLASS}
            data-testid="relay-apply-cancel"
            onClick={() => setPhase({ step: "idle" })}
          >
            <XIcon aria-hidden />
            {t("apply.confirmCancel")}
          </Button>
          <Button
            type="button"
            size="xs"
            className={RELAY_COARSE_TOUCH_CLASS}
            data-testid="relay-apply-confirm-button"
            onClick={() => void handleConfirm()}
          >
            <CheckIcon aria-hidden />
            {t("apply.confirmApply")}
          </Button>
        </div>
      </div>
    );
  }

  const reason = action.disabledReason
    ? t(`apply.${action.disabledReason}`)
    : undefined;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* A disabled button never shows its own tooltip, so the wrapper carries it. */}
      <span title={reason}>
        <Button
          type="button"
          size="xs"
          variant="outline"
          className={RELAY_COARSE_TOUCH_CLASS}
          disabled={Boolean(reason)}
          aria-describedby={reason ? hintId : undefined}
          data-testid="relay-apply-code"
          onClick={() => setPhase({ step: "confirming" })}
        >
          <DownloadIcon aria-hidden />
          {t(`apply.${action.label}`)}
        </Button>
      </span>
      {reason ? (
        <span id={hintId} className="sr-only">
          {reason}
        </span>
      ) : null}
      {phase.step === "failed" ? (
        <p role="status" className="text-destructive text-xs">
          {t("apply.failed")}
        </p>
      ) : null}
    </div>
  );
}
