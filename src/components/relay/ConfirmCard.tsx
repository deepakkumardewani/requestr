"use client";

import {
  CheckIcon,
  Loader2Icon,
  OctagonAlertIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RELAY_COARSE_TOUCH_CLASS } from "@/lib/relay/constants";
import type { ConfirmPreview } from "@/lib/relay/tools/registry";

type ConfirmCardProps = {
  preview: ConfirmPreview;
  onApprove: () => void;
  onDecline: () => void;
};

type Translate = ReturnType<typeof useTranslations<"relay.confirm">>;

function titleFor(preview: ConfirmPreview, t: Translate): string {
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

function Details({ preview, t }: { preview: ConfirmPreview; t: Translate }) {
  return (
    <div className="space-y-1">
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
}: ConfirmCardProps) {
  const t = useTranslations("relay.confirm");
  // The model's next step waits on the answer, so a second click must do nothing.
  const [answered, setAnswered] = useState<"approve" | "decline" | null>(null);
  const danger = preview.severity === "danger";
  const Icon = danger ? OctagonAlertIcon : TriangleAlertIcon;
  const title = titleFor(preview, t);

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
      <Details preview={preview} t={t} />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="xs"
          variant={danger ? "destructive" : "default"}
          className={RELAY_COARSE_TOUCH_CLASS}
          disabled={answered !== null}
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
          {answered === "approve" ? t("working") : t("approve")}
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
          {t("decline")}
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
