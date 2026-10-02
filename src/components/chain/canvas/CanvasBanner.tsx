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
  | "loop-body-unconnected"
  | "loop-body-misses-collect"
  | "subchain-invalid"
  | "start-only";

export type CanvasBannerProps = {
  type: CanvasBannerType;
  nodeNames?: string[];
  onDismiss?: () => void;
};

type BannerConfig = {
  messageKey: string;
  /** Joins the offending node names; omit for banners that carry no node list. */
  nodeSeparator?: string;
  /** `info` is a neutral hint rather than a validation error. */
  tone?: "error" | "info";
};

const BANNER_CONFIG: Record<CanvasBannerType, BannerConfig> = {
  cycle: { messageKey: "cycleBannerMessage", nodeSeparator: " → " },
  merge: { messageKey: "mergeBannerMessage", nodeSeparator: ", " },
  "loop-unpaired": {
    messageKey: "loopUnpairedBannerMessage",
    nodeSeparator: ", ",
  },
  "collect-unresolved": {
    messageKey: "collectUnresolvedBannerMessage",
    nodeSeparator: ", ",
  },
  "loop-body-unconnected": {
    messageKey: "loopBodyUnconnectedBannerMessage",
    nodeSeparator: ", ",
  },
  "loop-body-misses-collect": {
    messageKey: "loopBodyMissesCollectBannerMessage",
    nodeSeparator: ", ",
  },
  "subchain-invalid": {
    messageKey: "subchainInvalidBannerMessage",
    nodeSeparator: ", ",
  },
  "loop-nesting-depth": { messageKey: "loopNestingDepthBannerMessage" },
  "start-only": { messageKey: "startOnlyBanner", tone: "info" },
};

const TONE_CLASSES = {
  error: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-muted text-muted-foreground border-border",
} as const;

export function CanvasBanner({
  type,
  nodeNames = [],
  onDismiss,
}: CanvasBannerProps) {
  const t = useTranslations("chain");
  const { messageKey, nodeSeparator, tone = "error" } = BANNER_CONFIG[type];

  return (
    <div
      data-testid={`canvas-banner-${type}`}
      className={`flex items-center justify-between gap-3 border-b px-4 py-2.5 text-sm ${TONE_CLASSES[tone]}`}
      role="status"
      aria-live="polite"
    >
      <span>
        {t(messageKey)}
        {nodeSeparator !== undefined && (
          <>
            {" "}
            <span className="font-semibold">
              {nodeNames.join(nodeSeparator)}
            </span>
          </>
        )}
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
