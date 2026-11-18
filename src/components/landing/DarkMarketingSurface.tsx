import type { ReactNode } from "react";

/**
 * Marketing pages that share the landing's look are always dark: the `dark`
 * class scopes the app's dark tokens to this subtree, whatever theme the
 * visitor picked elsewhere. Route layouts opt in by wrapping their children,
 * so pages that stay themeable (compare, legal, the app) never see it.
 */
export function DarkMarketingSurface({ children }: { children: ReactNode }) {
  return (
    <div className="dark min-h-screen bg-background text-foreground [color-scheme:dark]">
      {children}
    </div>
  );
}
