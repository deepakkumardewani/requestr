interface AssertionResultProps {
  /** Status code of the response the assertion ran against. */
  status: number;
  expectedStatus: number;
}

/** The assertion Relay added, evaluated against the real response. */
export function AssertionResult({
  status,
  expectedStatus,
}: AssertionResultProps) {
  const passed = status === expectedStatus;
  return (
    <div
      data-testid="hero-a-assertion"
      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2 font-mono text-xs"
    >
      <span
        className={
          passed
            ? "font-semibold text-emerald-600 dark:text-emerald-400"
            : "font-semibold text-red-400"
        }
      >
        {passed ? "✓ passed" : "✗ failed"}
      </span>
      <span className="text-muted-foreground">status is {expectedStatus}</span>
    </div>
  );
}
