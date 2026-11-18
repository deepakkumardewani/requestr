"use client";

import { useTranslations } from "next-intl";
import { useChainErrorMessage } from "@/hooks/useChainErrorMessage";
import type { RunStep } from "@/lib/chainRunHistory";
import type { ErrorKind } from "@/lib/chainRunner/types";

type ErrorTabProps = {
  step: RunStep;
  /** Overrides `step.errorKind`; the persisted value is used when omitted. */
  errorKind?: ErrorKind;
};

export function ErrorTab({ step, errorKind = step.errorKind }: ErrorTabProps) {
  const t = useTranslations("chain");
  const tErrors = useTranslations("errors");
  const chainErrorMessage = useChainErrorMessage();

  if (!step.error && !step.errorCode) {
    return (
      <p className="text-xs text-muted-foreground">{t("runLogErrorEmpty")}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      {errorKind && (
        <span className="font-medium text-destructive">
          {t("runLogErrorKindLabel")}: {tErrors(`chain.errorKind.${errorKind}`)}
        </span>
      )}
      <div className="rounded border border-destructive/30 bg-destructive/10 p-2">
        <p className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-destructive">
          {chainErrorMessage(step.errorCode, step.errorParams, step.error)}
        </p>
      </div>
    </div>
  );
}
