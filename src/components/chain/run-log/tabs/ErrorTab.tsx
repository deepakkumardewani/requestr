"use client";

import { useTranslations } from "next-intl";
import type { RunStep } from "@/lib/chainRunHistory";
import type { ErrorKind } from "@/lib/chainRunner/types";

const ERROR_KIND_LABELS: Record<ErrorKind, string> = {
  extraction: "ExtractionError",
  injection: "InjectionError",
  network: "NetworkError",
  assertion: "AssertionError",
  subchain_depth_exceeded: "SubchainDepthExceededError",
  generic: "Error",
};

type ErrorTabProps = {
  step: RunStep;
  /** Not yet persisted on RunStep — passed separately when available. */
  errorKind?: ErrorKind;
};

export function ErrorTab({ step, errorKind }: ErrorTabProps) {
  const t = useTranslations("chain");

  if (!step.error) {
    return (
      <p className="text-xs text-muted-foreground">{t("runLogErrorEmpty")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      {errorKind && (
        <span className="font-medium text-destructive">
          {t("runLogErrorKindLabel")}: {ERROR_KIND_LABELS[errorKind]}
        </span>
      )}
      <div className="rounded border border-destructive/30 bg-destructive/10 p-2">
        <p className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-destructive">
          {step.error}
        </p>
      </div>
    </div>
  );
}
