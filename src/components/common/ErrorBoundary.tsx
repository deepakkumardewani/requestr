"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { captureScrubbedError } from "@/lib/analytics/adapter";

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Short heading shown above the error message */
  fallbackTitle?: string;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Catches render errors in children so the rest of the app stays usable.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught", error, info.componentStack);
    // Only the error goes out; the component stack is never passed on.
    captureScrubbedError(error, "boundary");
  }

  render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div
          className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center"
          role="alert"
        >
          <p className="text-sm font-medium text-foreground">
            {this.props.fallbackTitle ?? "Something went wrong"}
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            {this.state.error.message}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
