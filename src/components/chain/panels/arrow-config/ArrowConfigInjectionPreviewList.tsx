"use client";

import { useTranslations } from "next-intl";
import { memo } from "react";
import type { ChainInjection } from "@/types/chain";

const PREVIEW_TARGET_LABEL_KEYS = {
  url: "injectionPreviewTargetUrl",
  path: "injectionPreviewTargetPath",
  header: "injectionPreviewTargetHeader",
  body: "injectionPreviewTargetBody",
} as const satisfies Record<ChainInjection["targetField"], string>;

export type InjectionPreviewRow = ChainInjection & { rowId: string };

type ArrowConfigInjectionPreviewListProps = {
  injections: InjectionPreviewRow[];
  sourceRequestName?: string;
  buildPreview: (inj: ChainInjection) => string;
  jsonPathToVarName: (path: string) => string;
};

/** Preview block listing each configured injection (extract → inject). */
function ArrowConfigInjectionPreviewListInner({
  injections,
  sourceRequestName,
  buildPreview,
  jsonPathToVarName,
}: ArrowConfigInjectionPreviewListProps) {
  const t = useTranslations("chain");
  if (!injections.some((inj) => inj.sourceJsonPath && inj.targetKey)) {
    return null;
  }

  return (
    <div className="rounded-md border border-border/50 bg-muted/30 px-4 py-3 flex flex-col gap-2.5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        {t("injectionPreviewTitle")}
      </p>

      {injections.map((inj, idx) => {
        if (!inj.sourceJsonPath || !inj.targetKey) return null;
        const varName = jsonPathToVarName(inj.sourceJsonPath);
        const preview = buildPreview(inj);
        return (
          <div key={inj.rowId} className="flex flex-col gap-1">
            {injections.length > 1 && (
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {t("injectionPreviewInjectionN", { index: idx + 1 })}
              </span>
            )}
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {t("injectionPreviewExtract")}
              </span>
              <p className="text-xs font-mono">
                <span className="text-primary">{inj.sourceJsonPath}</span>
                <span className="text-muted-foreground">
                  {" "}
                  {t("injectionPreviewFrom")}{" "}
                </span>
                <span className="text-foreground">
                  {sourceRequestName ?? t("injectionPreviewSourceFallback")}
                </span>
              </p>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {t(PREVIEW_TARGET_LABEL_KEYS[inj.targetField])}
              </span>
              <p className="text-xs font-mono text-foreground break-all">
                {preview}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {t.rich("injectionPreviewReplaced", {
                placeholder: `{{${varName}}}`,
                code: (chunks) => (
                  <span className="font-mono text-emerald-400/80">
                    {chunks}
                  </span>
                ),
              })}
            </p>
            {idx < injections.length - 1 && (
              <div className="h-px bg-border/40 mt-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export const ArrowConfigInjectionPreviewList = memo(
  ArrowConfigInjectionPreviewListInner,
);
