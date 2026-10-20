# P2.3 contrast fix (a2c)
Root cause: two issues.
1. Spec bug: SHELL-09 read the svg's transparent backgroundColor (rgba(0,0,0,0)) as black and regex-parsed oklch colours, giving 1.67. Helper now resolves the first opaque ancestor background and normalises colours through a canvas pixel.
2. Real app bug exposed: EmptyState logo used text-primary, 2.61:1. Changed to text-foreground (theme token).
Files: e2e/qa/relay/relay-polish-shell.spec.ts (helper, test.fail() removed, Locator import), src/components/relay/EmptyState.tsx, EmptyState.spec.tsx, agent_docs/relay-polish/TASKS.md (P2.3 Log).
Evidence: playwright relay-polish-shell.spec.ts --repeat-each=3: 33 passed. vitest src/components/relay: 35 files, 500 passed. typecheck: only pre-existing error in src/components/layout/TabBar.spec.tsx (ResizeObserver mock, not touched).
