"use client";

import { GitBranch } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type ChainPageEmptyStateProps = {
  onAddApi: () => void;
};

export function ChainPageEmptyState({ onAddApi }: ChainPageEmptyStateProps) {
  const t = useTranslations("chain");

  return (
    <div
      data-testid="chain-empty-state"
      className="flex h-full items-center justify-center"
    >
      <div className="text-center">
        <GitBranch className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          {t("chainEmptyStateTitle")}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {t("chainEmptyStateDescription")}
        </p>
        <Button
          data-testid="chain-add-api-btn"
          variant="outline"
          size="sm"
          className="mt-4 gap-1.5 text-xs"
          onClick={onAddApi}
        >
          {t("chainEmptyStateAddApi")}
        </Button>
      </div>
    </div>
  );
}
