"use client";

import {
  CheckIcon,
  Loader2Icon,
  OctagonAlertIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { RELAY_COARSE_TOUCH_CLASS } from "@/lib/relay/constants";
import type { ConfirmPreview } from "@/lib/relay/tools/registry";
import type { ConfirmRisk } from "./confirmRisk";

type ConfirmCardProps = {
  preview: ConfirmPreview;
  onApprove: () => void;
  onDecline: () => void;
  /** Tool-specific content (a backup's sections, a file chooser) shown above the buttons. */
  extra?: ReactNode;
  /** Holds Approve back until the card has what the tool needs, such as a chosen file. */
  approveDisabled?: boolean;
  /** Why a normally silent tool is asking (Review mode); swaps the generic title. */
  risk?: ConfirmRisk | null;
};

const RISK_TITLE_KEYS = {
  script: "risk.scriptTitle",
  shareValues: "risk.shareValuesTitle",
  tlsOff: "risk.tlsOffTitle",
  baseUrl: "risk.baseUrlTitle",
  header: "risk.headerTitle",
  download: "risk.downloadTitle",
} as const satisfies Record<ConfirmRisk["kind"], string>;

type Translate = ReturnType<typeof useTranslations<"relay.confirm">>;

function titleFor(
  preview: ConfirmPreview,
  t: Translate,
  risk?: ConfirmRisk | null,
): string {
  if (risk) return t(RISK_TITLE_KEYS[risk.kind]);
  const name = preview.targets[0] ?? "";
  switch (preview.action) {
    case "delete":
      return preview.count === 1
        ? t("titleDeleteOne", { name })
        : t("titleDeleteMany", { count: preview.count });
    case "send":
      return t("titleSend", { method: preview.method ?? "" });
    case "run":
      return t("titleRun", { name });
    case "bulkUpdate":
      return t("titleBulk", { count: preview.count });
    case "change":
      return t("change.title");
  }
}

function TargetList({ preview, t }: { preview: ConfirmPreview; t: Translate }) {
  // A single target is already in the title.
  if (preview.action !== "delete" && preview.action !== "bulkUpdate") {
    return null;
  }
  if (preview.targets.length <= 1 && preview.action === "delete") return null;
  const hidden = preview.count - preview.targets.length;
  return (
    <ul className="list-disc pl-5" data-testid="relay-confirm-targets">
      {preview.targets.map((name) => (
        <li key={name} className="break-words">
          {name}
        </li>
      ))}
      {hidden > 0 ? (
        <li className="list-none text-muted-foreground">
          {t("more", { count: hidden })}
        </li>
      ) : null}
    </ul>
  );
}

/** Names and count when the tool has existing targets, else what it is about to do. */
function ChangeSummary({
  preview,
  t,
}: {
  preview: ConfirmPreview;
  t: Translate;
}) {
  const tRoot = useTranslations("relay");
  const hidden = preview.count - preview.targets.length;
  const summary = preview.stepLabel
    ? tRoot(preview.stepLabel.key, preview.stepLabel.params)
    : t("change.description", {
        count: preview.count,
        targets:
          hidden > 0
            ? `${preview.targets.join(", ")}, ${t("more", { count: hidden })}`
            : preview.targets.join(", "),
      });
  return (
    <p className="break-words" data-testid="relay-confirm-change">
      {summary}
    </p>
  );
}

/** One line saying what the risky change touches; needs the subject to read well. */
function riskSummary(risk: ConfirmRisk, t: Translate): string | null {
  const { kind, subject } = risk;
  if (kind === "tlsOff") return t("risk.tlsOffSummary");
  if (!subject) return null;
  if (kind === "script") return t("risk.scriptSummary", { name: subject });
  if (kind === "baseUrl") return t("risk.baseUrlSummary", { baseUrl: subject });
  if (kind === "header") return t("risk.headerSummary", { name: subject });
  return null;
}

function Details({
  preview,
  t,
  risk,
}: {
  preview: ConfirmPreview;
  t: Translate;
  risk?: ConfirmRisk | null;
}) {
  const summary = risk ? riskSummary(risk, t) : null;
  return (
    <div className="space-y-1">
      {summary ? (
        <p className="break-words" data-testid="relay-confirm-risk">
          {summary}
        </p>
      ) : null}
      {preview.action === "change" ? (
        <ChangeSummary preview={preview} t={t} />
      ) : null}
      <TargetList preview={preview} t={t} />
      {preview.childCount ? (
        <p data-testid="relay-confirm-children">
          {t("children", { count: preview.childCount })}
        </p>
      ) : null}
      {preview.action === "send" ? (
        <p data-testid="relay-confirm-host">
          {preview.host
            ? t("sendTo", {
                name: preview.targets[0] ?? "",
                host: preview.host,
              })
            : t("sendToUnknown", { name: preview.targets[0] ?? "" })}
        </p>
      ) : null}
      {preview.hostDiffers && preview.previousHost ? (
        <p
          role="alert"
          data-testid="relay-confirm-host-warning"
          className="flex items-start gap-1.5 font-medium text-amber-700 dark:text-amber-400"
        >
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {t("hostChanged", {
            host: preview.host ?? "",
            previous: preview.previousHost,
          })}
        </p>
      ) : null}
      {preview.fromNode ? (
        <p data-testid="relay-confirm-from">
          {t("runFrom", { node: preview.fromNode })}
        </p>
      ) : null}
      {preview.action === "send" || preview.action === "run" ? (
        <p className="text-muted-foreground" data-testid="relay-confirm-env">
          {preview.environment
            ? t("environment", { environment: preview.environment })
            : t("noEnvironment")}
        </p>
      ) : null}
      {preview.detail ? (
        // Rendered as plain text in a bounded, scrollable box so a long script cannot grow the card.
        <pre
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable for keyboard users
          tabIndex={0}
          role="region"
          aria-label={t("risk.detailLabel")}
          data-testid="relay-confirm-detail"
          className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border bg-background/60 p-2 font-mono"
        >
          {preview.detail}
        </pre>
      ) : null}
      {preview.action === "delete" ? (
        <p className="text-muted-foreground">{t("undoHint")}</p>
      ) : null}
    </div>
  );
}

/** Asks the user to approve one side-effecting tool call before it runs (FR-42). */
export function ConfirmCard({
  preview,
  onApprove,
  onDecline,
  extra,
  approveDisabled = false,
  risk = null,
}: ConfirmCardProps) {
  const t = useTranslations("relay.confirm");
  // The model's next step waits on the answer, so a second click must do nothing.
  const [answered, setAnswered] = useState<"approve" | "decline" | null>(null);
  const danger = preview.severity === "danger";
  const Icon = danger ? OctagonAlertIcon : TriangleAlertIcon;
  const title = titleFor(preview, t, risk);
  const isChange = preview.action === "change";

  function answer(choice: "approve" | "decline") {
    if (answered) return;
    setAnswered(choice);
    if (choice === "approve") onApprove();
    else onDecline();
  }

  return (
    <div
      role="group"
      aria-label={t("cardLabel", { title })}
      data-testid="relay-confirm-card"
      data-action={preview.action}
      data-severity={preview.severity}
      className={`my-1.5 space-y-2 rounded-md border p-2 text-xs ${
        danger
          ? "border-destructive/50 bg-destructive/5"
          : "border-amber-500/50 bg-amber-500/5"
      }`}
    >
      <p className="flex items-center gap-1.5 font-medium text-sm">
        <Icon
          aria-hidden
          className={`size-4 shrink-0 ${danger ? "text-destructive" : ""}`}
        />
        <span className="min-w-0 break-words">{title}</span>
      </p>
      <p role="status" className="sr-only">
        {answered ? "" : t("needed")}
      </p>
      <Details preview={preview} t={t} risk={risk} />
      {extra}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="xs"
          variant={danger ? "destructive" : "default"}
          className={RELAY_COARSE_TOUCH_CLASS}
          disabled={answered !== null || approveDisabled}
          data-testid="relay-confirm-approve"
          onClick={() => answer("approve")}
        >
          {answered === "approve" ? (
            <Loader2Icon
              aria-hidden
              className="animate-spin motion-reduce:animate-none"
            />
          ) : (
            <CheckIcon aria-hidden />
          )}
          {answered === "approve"
            ? t("working")
            : t(isChange ? "change.approve" : "approve")}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          className={RELAY_COARSE_TOUCH_CLASS}
          disabled={answered !== null}
          data-testid="relay-confirm-decline"
          onClick={() => answer("decline")}
        >
          <XIcon aria-hidden />
          {t(isChange ? "change.decline" : "decline")}
        </Button>
      </div>
    </div>
  );
}

/** What stays in the thread after a card was declined, by the user or automatically. */
export function DeclinedNote({ automatic }: { automatic: boolean }) {
  const t = useTranslations("relay.confirm");
  return (
    <p
      data-testid="relay-confirm-declined"
      data-automatic={automatic}
      className="my-1 flex items-center gap-1.5 text-xs text-muted-foreground"
    >
      <XIcon aria-hidden className="size-3.5" />
      {automatic ? t("declinedAutomatically") : t("declined")}
    </p>
  );
}
