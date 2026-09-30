"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export type CanvasBannerType =
  | "cycle"
  | "merge"
  | "loop-unpaired"
  | "collect-unresolved"
  | "loop-nesting-depth"
  | "subchain-invalid";

export type CanvasBannerProps = {
  type: CanvasBannerType;
  nodeNames?: string[];
  onDismiss?: () => void;
};

export function CanvasBanner({
  type,
  nodeNames = [],
  onDismiss,
}: CanvasBannerProps) {
  const t = useTranslations("chain");

  if (type === "cycle") {
    const nodeList = nodeNames.join(" → ");
    return (
      <div
        className="flex items-center justify-between gap-3 bg-destructive/10 px-4 py-2.5 text-sm text-destructive border-b border-destructive/20"
        role="status"
        aria-live="polite"
      >
        <span>
          {t("cycleBannerMessage")}{" "}
          <span className="font-semibold">{nodeList}</span>
        </span>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:bg-destructive/20 hover:text-destructive"
            onClick={onDismiss}
            aria-label={t("dismissBanner")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  if (type === "merge") {
    const nodeList = nodeNames.join(", ");
    return (
      <div
        className="flex items-center justify-between gap-3 bg-destructive/10 px-4 py-2.5 text-sm text-destructive border-b border-destructive/20"
        role="status"
        aria-live="polite"
      >
        <span>
          {t("mergeBannerMessage")}{" "}
          <span className="font-semibold">{nodeList}</span>
        </span>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:bg-destructive/20 hover:text-destructive"
            onClick={onDismiss}
            aria-label={t("dismissBanner")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  if (type === "loop-unpaired") {
    const nodeList = nodeNames.join(", ");
    return (
      <div
        className="flex items-center justify-between gap-3 bg-destructive/10 px-4 py-2.5 text-sm text-destructive border-b border-destructive/20"
        role="status"
        aria-live="polite"
      >
        <span>
          {t("loopUnpairedBannerMessage")}{" "}
          <span className="font-semibold">{nodeList}</span>
        </span>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:bg-destructive/20 hover:text-destructive"
            onClick={onDismiss}
            aria-label={t("dismissBanner")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  if (type === "collect-unresolved") {
    const nodeList = nodeNames.join(", ");
    return (
      <div
        className="flex items-center justify-between gap-3 bg-destructive/10 px-4 py-2.5 text-sm text-destructive border-b border-destructive/20"
        role="status"
        aria-live="polite"
      >
        <span>
          {t("collectUnresolvedBannerMessage")}{" "}
          <span className="font-semibold">{nodeList}</span>
        </span>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:bg-destructive/20 hover:text-destructive"
            onClick={onDismiss}
            aria-label={t("dismissBanner")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  if (type === "subchain-invalid") {
    const nodeList = nodeNames.join(", ");
    return (
      <div
        className="flex items-center justify-between gap-3 bg-destructive/10 px-4 py-2.5 text-sm text-destructive border-b border-destructive/20"
        role="status"
        aria-live="polite"
      >
        <span>
          {t("subchainInvalidBannerMessage")}{" "}
          <span className="font-semibold">{nodeList}</span>
        </span>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:bg-destructive/20 hover:text-destructive"
            onClick={onDismiss}
            aria-label={t("dismissBanner")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  if (type === "loop-nesting-depth") {
    return (
      <div
        className="flex items-center justify-between gap-3 bg-destructive/10 px-4 py-2.5 text-sm text-destructive border-b border-destructive/20"
        role="status"
        aria-live="polite"
      >
        <span>{t("loopNestingDepthBannerMessage")}</span>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:bg-destructive/20 hover:text-destructive"
            onClick={onDismiss}
            aria-label={t("dismissBanner")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return null;
}
