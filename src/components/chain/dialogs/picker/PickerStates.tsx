"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROW_IDS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/** Placeholder rows shown while collections hydrate from IndexedDB. */
export function PickerSkeleton() {
  const t = useTranslations("chain");
  return (
    <div
      role="status"
      aria-label={t("apiPickerLoading")}
      data-testid="picker-skeleton"
      className="space-y-1 px-3 py-3"
    >
      {SKELETON_ROW_IDS.map((id) => (
        <div key={id} className="flex h-9 items-center gap-3 px-3">
          <Skeleton className="h-5 w-12 shrink-0" />
          <Skeleton className="h-4 min-w-0 flex-1" />
        </div>
      ))}
    </div>
  );
}

type PickerErrorRowProps = { onRetry: () => void };

export function PickerErrorRow({ onRetry }: PickerErrorRowProps) {
  const t = useTranslations("chain");
  return (
    <div
      role="alert"
      data-testid="picker-error"
      className="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm text-muted-foreground"
    >
      <TriangleAlert className="h-6 w-6 text-destructive" aria-hidden />
      <p>{t("apiPickerLoadError")}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        data-testid="picker-retry"
      >
        {t("apiPickerRetry")}
      </Button>
    </div>
  );
}

type PickerErrorBoundaryProps = {
  children: ReactNode;
  /** Re-attempts loading (e.g. re-hydrating collections) before the subtree remounts. */
  onRetry: () => void;
};

type PickerErrorBoundaryState = { failed: boolean };

/** Contains render failures of the list so the dialog stays closable and offers Retry. */
export class PickerErrorBoundary extends Component<
  PickerErrorBoundaryProps,
  PickerErrorBoundaryState
> {
  state: PickerErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): PickerErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "ApiPickerDialog list failed to render",
      error,
      info.componentStack,
    );
  }

  private readonly retry = () => {
    this.props.onRetry();
    this.setState({ failed: false });
  };

  render() {
    return this.state.failed ? (
      <PickerErrorRow onRetry={this.retry} />
    ) : (
      this.props.children
    );
  }
}
