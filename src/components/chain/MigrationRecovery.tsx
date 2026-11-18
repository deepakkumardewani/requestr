"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { MigrationError } from "@/lib/chainMigration";

type Props = {
  error: MigrationError;
  onRetry: () => void;
  onOpenReadOnly: () => void;
};

/** Rendered instead of the chain canvas when hydration surfaces a `MigrationError`. */
export function MigrationRecovery({ error, onRetry, onOpenReadOnly }: Props) {
  const t = useTranslations("chain");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="size-10 text-destructive" aria-hidden="true" />
      <h2 className="text-lg font-semibold">{t("migrationFailedTitle")}</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {t("migrationFailedDescription")}
      </p>
      <p className="max-w-md text-xs text-muted-foreground">{error.message}</p>
      <div className="flex gap-3">
        <Button onClick={onRetry}>{t("retry")}</Button>
        <Button variant="outline" onClick={onOpenReadOnly}>
          {t("openReadOnly")}
        </Button>
      </div>
    </div>
  );
}
