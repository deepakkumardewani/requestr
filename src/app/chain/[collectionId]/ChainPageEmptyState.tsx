"use client";

import { GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";

type ChainPageEmptyStateProps = {
  onAddApi: () => void;
};

export function ChainPageEmptyState({ onAddApi }: ChainPageEmptyStateProps) {
  return (
    <div
      data-testid="chain-empty-state"
      className="flex h-full items-center justify-center"
    >
      <div className="text-center">
        <GitBranch className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          No APIs in this chain
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Use the Add API button to add requests from your collections or
          history.
        </p>
        <Button
          data-testid="chain-add-api-btn"
          variant="outline"
          size="sm"
          className="mt-4 gap-1.5 text-xs"
          onClick={onAddApi}
        >
          Add API
        </Button>
      </div>
    </div>
  );
}
